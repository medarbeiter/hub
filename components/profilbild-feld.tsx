'use client';

import {Banner, Button, FileInput, HStack, Heading, Text, VStack} from '@astryxdesign/core';
import Image from 'next/image';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {profilbildAction} from '@/app/actions';
import {AVATAR_MAX_BYTES} from '@/lib/avatar';
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
 */
export function ProfilbildFeld({hatBild, userId}: {hatBild: boolean; userId: number}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [datei, setDatei] = useState<File | null>(null);

  const lauf = (fd: FormData) =>
    start(async () => {
      setFehler(null);
      const {error} = await profilbildAction({error: null}, fd);
      if (error) {
        setFehler(error);
        return;
      }
      setDatei(null);
      router.refresh();
    });

  const hochladen = () => {
    if (!datei) return;
    const fd = new FormData();
    fd.set('bild', datei);
    lauf(fd);
  };

  const entfernen = () => {
    const fd = new FormData();
    fd.set('entfernen', 'ja');
    lauf(fd);
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
        {hatBild && (
          <Image
            aria-hidden
            alt=""
            className="tieravatar"
            data-gross="true"
            src={`/api/avatar/${userId}`}
            width={1254}
            height={1254}
            sizes="64px"
            unoptimized
          />
        )}
        {hatBild && (
          <Button
            label="Bild entfernen"
            variant="secondary"
            icon={<Sinnbild sinn="entfernen" />}
            isLoading={isPending}
            onClick={entfernen}
          />
        )}
      </HStack>

      <FileInput
        label={hatBild ? 'Anderes Bild wählen' : 'Bild wählen'}
        description="JPG, PNG oder WEBP, höchstens 5 MB."
        placeholder="Datei wählen"
        mode="dropzone"
        accept="image/jpeg,image/png,image/webp"
        maxSize={AVATAR_MAX_BYTES}
        value={datei}
        onChange={(dateien) => setDatei(Array.isArray(dateien) ? (dateien[0] ?? null) : dateien)}
      />
      {datei && (
        <HStack justify="end">
          <Button label="Bild hochladen" variant="primary" isLoading={isPending} onClick={hochladen} />
        </HStack>
      )}
    </VStack>
  );
}
