'use client';

import {Button, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {useEffect, useState} from 'react';
import {Sinnbild} from './sinnbilder';

/**
 * Das Ereignis, mit dem Chromium-Browser anbieten, die Anwendung zu
 * installieren. Es steht nicht in den TypeScript-Standardtypen, weil es kein
 * Standard ist — genau deshalb wird unten auch nie angenommen, dass es kommt.
 */
interface InstallEreignis extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}

const WEGGEKLICKT = 'medarbeiter.app-hinweis.weg';
const TAGE = 'medarbeiter.app-hinweis.tage';
const LETZTER_TAG = 'medarbeiter.app-hinweis.zuletzt';

/** Erst am dritten Tag. Davor hat die Anwendung nichts bewiesen. */
const AB_TAG = 3;

type Weg = 'kein' | 'knopf' | 'ios';

/**
 * „MedArbeiter als App installieren."
 *
 * Drei Regeln, und alle drei sind der Grund, warum dieser Hinweis nicht nervt:
 *
 * 1. **Nur, wenn es wirklich geht.** Entweder der Browser hat
 *    `beforeinstallprompt` angeboten — dann trägt der Hinweis einen Knopf, der
 *    wirklich installiert — oder es ist Safari auf einem iPhone, wo es den
 *    Weg über „Teilen" gibt. In jedem anderen Browser erscheint gar nichts:
 *    jemandem eine Anleitung zu geben, die sein Browser nicht ausführen kann,
 *    ist schlimmer als zu schweigen.
 * 2. **Nicht beim ersten Mal.** Ein Installationsangebot, bevor die Anwendung
 *    irgendetwas geleistet hat, ist Werbung. Ab dem dritten Besuch.
 * 3. **Einmal weggeklickt heißt weg.** Kein „später", kein Wiedervorlegen.
 *
 * Läuft die Anwendung bereits installiert, ist alles hier still: `display-mode`
 * verrät es, und auf iOS zusätzlich `navigator.standalone`.
 */
/** Muss zu `--takt-zug` in globals.css passen — wie in `ausklapp.tsx`. */
const TAKT_ZUG_MS = 360;

export function AppHinweis() {
  const [weg, setWeg] = useState<Weg>('kein');
  const [ereignis, setEreignis] = useState<InstallEreignis | null>(null);
  const [offen, setOffen] = useState(false);
  /** Hängt der Hinweis im Baum? Beim Öffnen sofort, beim Schließen erst nach der Faltung. */
  const [haengt, setHaengt] = useState(false);

  if (offen && !haengt) setHaengt(true);

  useEffect(() => {
    if (offen) return;
    const zeit = setTimeout(() => setHaengt(false), TAKT_ZUG_MS);
    return () => clearTimeout(zeit);
  }, [offen]);

  useEffect(() => {
    // Schon installiert? Dann hat dieser Hinweis keinen Gegenstand.
    const installiert =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      // Safari auf iOS kennt display-mode erst seit Kurzem und hat dafür
      // seit jeher diese eigene Angabe.
      (window.navigator as Navigator & {standalone?: boolean}).standalone === true;
    if (installiert) return;

    if (localStorage.getItem(WEGGEKLICKT) === 'ja') return;

    // Gezählt werden **Tage**, nicht Seitenaufbauten. Wer einmal vormittags
    // dreimal neu lädt, war nicht dreimal da; und in einer Anwendung, die man
    // ohne Neuladen bedient, käme ein Seitenzähler kaum je bei drei an. Der
    // Zähler steigt einmal je Kalendertag.
    const heute = new Date().toISOString().slice(0, 10);
    let tage = Number(localStorage.getItem(TAGE) ?? '0');
    if (localStorage.getItem(LETZTER_TAG) !== heute) {
      tage += 1;
      localStorage.setItem(TAGE, String(tage));
      localStorage.setItem(LETZTER_TAG, heute);
    }
    if (tage < AB_TAG) return;

    const iosSafari =
      /iphone|ipad|ipod/i.test(navigator.userAgent) &&
      /safari/i.test(navigator.userAgent) &&
      !/crios|fxios|edgios/i.test(navigator.userAgent);
    if (iosSafari) {
      setWeg('ios');
      setOffen(true);
    }

    const fangen = (e: Event) => {
      // Den eigenen Zeitpunkt wählen: ohne das zeigt Chrome seine eigene
      // Leiste, und zwar irgendwann.
      e.preventDefault();
      setEreignis(e as InstallEreignis);
      setWeg('knopf');
      setOffen(true);
    };
    window.addEventListener('beforeinstallprompt', fangen);

    // Nach dem Installieren verschwindet der Hinweis von selbst und kommt nie
    // wieder — auch nicht im alten Tab, der noch im Browser läuft.
    const fertig = () => {
      localStorage.setItem(WEGGEKLICKT, 'ja');
      setOffen(false);
    };
    window.addEventListener('appinstalled', fertig);

    return () => {
      window.removeEventListener('beforeinstallprompt', fangen);
      window.removeEventListener('appinstalled', fertig);
    };
  }, []);

  const schliessen = () => {
    localStorage.setItem(WEGGEKLICKT, 'ja');
    setOffen(false);
  };

  const installieren = async () => {
    if (!ereignis) return;
    await ereignis.prompt();
    const {outcome} = await ereignis.userChoice;
    // Auch ein „nein" beendet die Sache: gefragt wurde, die Antwort steht.
    localStorage.setItem(WEGGEKLICKT, 'ja');
    setEreignis(null);
    setOffen(false);
    if (outcome === 'accepted') setWeg('kein');
  };

  // Zugeklappt heißt weg — auch für die Tabulatortaste. `grid-template-rows:
  // 0fr` mit `overflow: hidden` versteckt nur fürs Auge; die beiden
  // Schaltflächen blieben fokussierbar und wären beim Durchtabben als
  // unsichtbare Stationen aufgetaucht. Nach der Faltung werden sie deshalb
  // abgehängt — dasselbe, was `components/ausklapp.tsx` für die Stapel tut.
  if (!haengt) return null;

  return (
    /* Dieselbe Faltung, mit der sich der Navigationseintrag öffnet und mit der
       die Stempelleiste ihre Angaben übergibt: `grid-template-rows` von 0fr auf
       1fr. Keine vierte Bewegungsidee — die dritte Verwendung derselben. */
    <div className="app-hinweis" data-offen={offen ? 'true' : 'false'}>
      <div>
        <VStack className="zeit-blatt" paddingInline={5} paddingBlock={3}>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <Sinnbild sinn="installieren" groesse="gross" ton="akzent" />
            <StackItem size="fill">
              <VStack gap={0.5}>
                <Text type="label" weight="semibold">
                  MedArbeiter auf dem Gerät installieren
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  {weg === 'ios'
                    ? 'In Safari auf „Teilen“ tippen und „Zum Home-Bildschirm“ wählen. Dann stempelst du mit einem Tipp, ohne den Browser zu öffnen.'
                    : 'Dann stempelst du mit einem Klick vom Startbildschirm, ohne erst den Browser zu öffnen.'}
                </Text>
              </VStack>
            </StackItem>
            <HStack gap={2} vAlign="center">
              {weg === 'knopf' && (
                <Button
                  label="Installieren"
                  variant="secondary"
                  size="sm"
                  icon={<Sinnbild sinn="installieren" />}
                  onClick={installieren}
                />
              )}
              <Button
                label="Nicht mehr anzeigen"
                variant="ghost"
                size="sm"
                icon={<Sinnbild sinn="fehler" />}
                onClick={schliessen}
              />
            </HStack>
          </HStack>
        </VStack>
      </div>
    </div>
  );
}
