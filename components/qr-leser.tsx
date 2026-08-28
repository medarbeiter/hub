'use client';

// Der QR-Leser des Zugang-Dialogs: die Kamera liest den Einrichtungs-QR-Code,
// den ein Dienst beim Anlegen der Bestätigung in zwei Schritten zeigt — auf dem
// Telefon dieselbe Geste wie in jeder Authenticator-App. Was gelesen wurde,
// entscheidet der Aufrufer; dieses Modul kennt nur Kamera, Bild und Dekodierung.
//
// Drei Wege, absteigend bequem, alle gleichwertig im Ergebnis:
//   1. `BarcodeDetector` des Browsers (Android-Chrome) — Kamera, nativ dekodiert.
//   2. jsQR (reines JS, nachgeladen) — Kamera dort, wo der Browser keinen
//      Detektor hat (Safari auf iOS).
//   3. Ein Bild wählen — wo die Kamera verwehrt ist oder der QR-Code als
//      Bildschirmfoto vorliegt (am Schreibtisch der Regelfall). Mehrere Bilder
//      auf einmal sind erlaubt: der Google-Authenticator-Export kommt ab elf
//      Konten als Serie von QR-Codes, und jede Datei wird der Reihe nach
//      dekodiert und einzeln gemeldet.
// Der Scan ist nie der einzige Weg: das Einfügen von Hand bleibt daneben
// bestehen, wie überall sonst bei Gesten.

import {Banner, Button, HStack, Text, VStack} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';
import {Sinnbild} from './sinnbilder';

declare global {
  interface Window {
    /** Chromium-eigen; Stand heute nicht in lib.dom und nicht in Safari. */
    BarcodeDetector?: new (init?: {formats?: string[]}) => {
      detect(quelle: CanvasImageSource | ImageBitmap): Promise<Array<{rawValue: string}>>;
    };
  }
}

type Dekoder = (quelle: CanvasImageSource, breite: number, hoehe: number) => Promise<string | null>;

/** jsQR über eine Leinwand — der Weg, der überall geht. */
async function jsqrDekoder(): Promise<Dekoder> {
  const {default: jsQR} = await import('jsqr');
  const leinwand = document.createElement('canvas');
  const stift = leinwand.getContext('2d', {willReadFrequently: true});
  return async (quelle, breite, hoehe) => {
    if (!stift || breite === 0 || hoehe === 0) return null;
    // Bildschirmfotos kommen in voller Auflösung; über ~1024 px Kante findet
    // jsQR nicht besser, braucht aber spürbar länger.
    const mass = Math.min(1, 1024 / Math.max(breite, hoehe));
    leinwand.width = Math.round(breite * mass);
    leinwand.height = Math.round(hoehe * mass);
    stift.drawImage(quelle, 0, 0, leinwand.width, leinwand.height);
    const bild = stift.getImageData(0, 0, leinwand.width, leinwand.height);
    return jsQR(bild.data, bild.width, bild.height)?.data ?? null;
  };
}

async function macheDekoder(): Promise<Dekoder> {
  if (typeof window.BarcodeDetector === 'function') {
    try {
      const melder = new window.BarcodeDetector({formats: ['qr_code']});
      return async (quelle) => (await melder.detect(quelle))[0]?.rawValue ?? null;
    } catch {
      // Ein Detektor ohne QR-Unterstützung — weiter mit jsQR.
    }
  }
  return jsqrDekoder();
}

interface QrLeserProps {
  /** Jeder gelesene Inhalt, einmal je Wert. Ob er taugt, weiß der Aufrufer. */
  onErkannt: (text: string) => void;
  /**
   * Vom Aufrufer: „gelesen, aber nicht das Richtige". Bleibt stehen, während
   * weiter gesucht wird — der nächste Treffer ersetzt ihn.
   */
  fehler?: string | null;
}

export function QrLeser({onErkannt, fehler}: QrLeserProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const dateiRef = useRef<HTMLInputElement>(null);
  const [kamera, setKamera] = useState<'startet' | 'laeuft' | 'verwehrt'>('startet');
  const [bildFehler, setBildFehler] = useState<string | null>(null);
  const [liestBild, setLiestBild] = useState(false);

  // Der Rückruf lebt im Ref, damit der Kameraeffekt nicht bei jedem Render des
  // Elternformulars die Kamera neu verhandelt.
  const erkanntRef = useRef(onErkannt);
  erkanntRef.current = onErkannt;
  const zuletzt = useRef<string | null>(null);
  const dekoder = useRef<Promise<Dekoder> | null>(null);
  const holeDekoder = () => (dekoder.current ??= macheDekoder());

  useEffect(() => {
    let aktiv = true;
    let strom: MediaStream | null = null;
    let takt: ReturnType<typeof setInterval> | undefined;
    let beschaeftigt = false;

    (async () => {
      try {
        strom = await navigator.mediaDevices.getUserMedia({
          video: {facingMode: 'environment'},
          audio: false,
        });
      } catch {
        if (aktiv) setKamera('verwehrt');
        return;
      }
      const video = videoRef.current;
      if (!aktiv || !video) {
        strom.getTracks().forEach((s) => s.stop());
        return;
      }
      video.srcObject = strom;
      try {
        await video.play();
      } catch {
        // Abgebrochen, weil der Dialog schon wieder zu ist — unten aufgeräumt.
      }
      if (!aktiv) return;
      setKamera('laeuft');

      takt = setInterval(async () => {
        if (beschaeftigt || !videoRef.current || videoRef.current.readyState < 2) return;
        beschaeftigt = true;
        try {
          const lese = await holeDekoder();
          const text = await lese(videoRef.current, videoRef.current.videoWidth, videoRef.current.videoHeight);
          if (text && text !== zuletzt.current) {
            zuletzt.current = text;
            erkanntRef.current(text);
          }
        } catch {
          // Der native Detektor mag diese Quelle nicht — ab jetzt jsQR.
          dekoder.current = jsqrDekoder();
        } finally {
          beschaeftigt = false;
        }
      }, 300);
    })();

    return () => {
      aktiv = false;
      if (takt) clearInterval(takt);
      strom?.getTracks().forEach((s) => s.stop());
    };
  }, []);

  const bildLesen = async (dateien: File[]) => {
    setLiestBild(true);
    setBildFehler(null);
    let ohneTreffer = 0;
    for (const datei of dateien) {
      try {
        const bild = await createImageBitmap(datei);
        const lese = await holeDekoder();
        let text: string | null = null;
        try {
          text = await lese(bild, bild.width, bild.height);
        } catch {
          dekoder.current = jsqrDekoder();
          text = await (await holeDekoder())(bild, bild.width, bild.height);
        }
        bild.close();
        if (text) {
          if (text !== zuletzt.current) {
            zuletzt.current = text;
            erkanntRef.current(text);
          }
        } else {
          ohneTreffer++;
        }
      } catch {
        ohneTreffer++;
      }
    }
    if (ohneTreffer > 0) {
      setBildFehler(
        dateien.length === 1
          ? 'Im Bild wurde kein QR-Code gefunden.'
          : `In ${ohneTreffer} von ${dateien.length} Bildern wurde kein QR-Code gefunden.`,
      );
    }
    setLiestBild(false);
  };

  const meldung = fehler ?? bildFehler;

  return (
    <VStack gap={3}>
      {meldung && <Banner status="warning" title={meldung} />}
      {kamera === 'verwehrt' ? (
        <Banner
          status="info"
          title="Keine Kamera verfügbar."
          description="Wähle stattdessen ein Bild mit dem QR-Code, oder füge den Schlüssel von Hand ein."
        />
      ) : (
        <>
          <Text type="supporting" color="secondary">
            Richte die Kamera auf den QR-Code, den der Dienst beim Einrichten zeigt.
          </Text>
          {/* Stumm und inline: iOS spielt Kamerabilder sonst als Vollbildvideo. */}
          <video ref={videoRef} className="qr-video" muted playsInline aria-hidden />
        </>
      )}
      <HStack gap={2}>
        <Button
          label="Bilder mit QR-Code wählen"
          variant="secondary"
          size="sm"
          isLoading={liestBild}
          icon={<Sinnbild sinn="datei" />}
          onClick={() => dateiRef.current?.click()}
        />
      </HStack>
      {/* Bewusst ohne `capture`: so bietet das Telefon Kamera UND Fotoarchiv an. */}
      <input
        ref={dateiRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          const dateien = Array.from(e.target.files ?? []);
          e.target.value = '';
          if (dateien.length > 0) void bildLesen(dateien);
        }}
      />
    </VStack>
  );
}
