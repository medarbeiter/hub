'use client';

import {Avatar, Banner, Button, FileInput, HStack, Heading, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {profilbildAction} from '@/app/actions';
import {AVATAR_MAX_BYTES} from '@/lib/avatar';
import {BildZuschnitt} from './bild-zuschnitt';
import {Sinnbild} from './sinnbilder';

/**
 * Das eigene Profilbild. Es steht **über** der Figurenauswahl und nicht statt
 * ihr: der Bildbogen bleibt der Rückfall, damit ein Konto ohne Foto (und ein
 * gerade entfernter) trotzdem ein Zeichen trägt.
 *
 * Ein eigenes Formular, kein Feld im großen: die Datei liegt als File im State
 * (dieselbe Bauweise wie im Belegdialog und in der Abwesenheit), und ein
 * Hochladen ist eine eigene Handlung mit eigenem Ausgang — nicht etwas, das
 * beim Speichern der Startansicht nebenbei mitgeht.
 *
 * Steht auf dem Profil **und** im Einrichtungsassistenten. Deshalb führt es das
 * Ergebnis selbst mit: der Assistent liegt auf der Zugangsseite, deren Daten er
 * beim Betreten einmal in den State genommen hat, und ein `router.refresh()`
 * erreicht ihn nicht. `stand` hängt zusätzlich an der Bildadresse — die Datei
 * wird unter derselben URL ausgeliefert, und die darf fünf Minuten
 * zwischengespeichert werden (api/avatar). Ohne diesen Zähler zeigte die
 * Vorschau nach dem Ersetzen weiter das alte Bild.
 */
export function ProfilbildFeld({hatBild, userId}: {hatBild: boolean; userId: number}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [datei, setDatei] = useState<File | null>(null);
  const [gezeigt, setGezeigt] = useState(hatBild);
  const [stand, setStand] = useState(0);

  const lauf = (fd: FormData, jetztMitBild: boolean) =>
    start(async () => {
      setFehler(null);
      const {error} = await profilbildAction({error: null}, fd);
      if (error) {
        setFehler(error);
        return;
      }
      setDatei(null);
      setGezeigt(jetztMitBild);
      setStand((n) => n + 1);
      router.refresh();
    });

  const hochladen = (zugeschnitten: File) => {
    const fd = new FormData();
    fd.set('bild', zugeschnitten);
    lauf(fd, true);
  };

  const entfernen = () => {
    const fd = new FormData();
    fd.set('entfernen', 'ja');
    lauf(fd, false);
  };

  return (
    <VStack gap={2}>
      <VStack gap={0.5}>
        <Heading level={3}>Profilbild</Heading>
        <Text type="supporting" color="secondary">
          Ein eigenes Bild ersetzt deine Tierfigur. Es liegt auf dem Server dieser Anwendung, wird nicht
          an Dritte weitergegeben und ist nur für angemeldete Kolleginnen und Kollegen sichtbar.
        </Text>
      </VStack>

      {fehler && <Banner status="error" title={fehler} />}

      <HStack gap={3} vAlign="center" wrap="wrap">
        {gezeigt && (
          <>
            {/* Kein Personenzeichen: hier steht die Datei zur Bearbeitung, nicht
                ein Mensch zum Nachschlagen — dieselbe Grenze wie in der
                Figurenauswahl. Der Avatar beschneidet mittig aufs Quadrat, so
                wie das Bild später überall im Haus steht; ein Hochformat sähe
                sonst hier anders aus als in der Seitenleiste. */}
            <Avatar size={64} src={`/api/avatar/${userId}?stand=${stand}`} alt="" tooltip={false} />
            <Button
              label="Bild entfernen"
              variant="secondary"
              icon={<Sinnbild sinn="entfernen" />}
              isLoading={isPending}
              onClick={entfernen}
            />
          </>
        )}
      </HStack>

      <FileInput
        label={gezeigt ? 'Anderes Bild wählen' : 'Bild wählen'}
        description="JPG, PNG oder WEBP, höchstens 5 MB."
        placeholder="Datei wählen"
        mode="dropzone"
        accept="image/jpeg,image/png,image/webp"
        maxSize={AVATAR_MAX_BYTES}
        value={datei}
        onChange={(dateien) => setDatei(Array.isArray(dateien) ? (dateien[0] ?? null) : dateien)}
      />
      {datei && <BildZuschnitt datei={datei} isPending={isPending} onFertig={hochladen} />}
    </VStack>
  );
}
