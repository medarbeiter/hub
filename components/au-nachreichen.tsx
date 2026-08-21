'use client';

import {Banner, Button, DialogHeader, FileInput, HStack, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {auUploadAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

interface AuNachreichenProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  abwesenheitId: number;
  jahr: string;
  /** Woran die Bescheinigung hängt, als Untertitel. */
  zeitraum: string;
}

/**
 * Die Bescheinigung nachreichen. Ein eigener, kleiner Dialog statt eines Feldes
 * im Editor: sie kommt fast immer später als die Meldung — man meldet sich
 * krank, bevor man beim Arzt war.
 */
export function AuNachreichen(props: AuNachreichenProps) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [datei, setDatei] = useState<File | null>(null);

  const speichern = () =>
    start(async () => {
      setFehler(null);
      const fd = new FormData();
      fd.set('abwesenheitId', String(props.abwesenheitId));
      fd.set('jahr', props.jahr);
      if (datei) fd.set('au', datei);
      const {error} = await sicher(auUploadAction)({error: null}, fd);
      if (error) {
        setFehler(error);
        return;
      }
      setDatei(null);
      props.onOpenChange(false);
      router.refresh();
    });

  return (
    <TafelDialog isOpen={props.isOpen} onOpenChange={props.onOpenChange} purpose="form" width={440}>
      <DialogHeader title="Bescheinigung nachreichen" subtitle={props.zeitraum} />
      <VStack gap={4} padding={4}>
        {fehler && <Banner status="error" title={fehler} />}

        <FileInput
          label="Arbeitsunfähigkeitsbescheinigung"
          description="JPG, PNG, WEBP oder PDF, höchstens 10 MB."
          placeholder="Datei wählen"
          mode="dropzone"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          maxSize={10 * 1024 * 1024}
          value={datei}
          onChange={(files) => setDatei(Array.isArray(files) ? (files[0] ?? null) : files)}
        />

        <HStack gap={1.5} vAlign="start">
          <Sinnbild sinn="hinweis" groesse="zeile" ton="sekundaer" />
          <Text type="supporting" size="sm" color="secondary">
            Die Datei ist nur für dich und die Verwaltung einsehbar und wird außerhalb des öffentlichen
            Verzeichnisses abgelegt.
          </Text>
        </HStack>

        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => props.onOpenChange(false)} />
          <Button
            label="Bescheinigung speichern"
            variant="primary"
            icon={<Sinnbild sinn="datei" />}
            isLoading={isPending}
            isDisabled={datei === null}
            onClick={speichern}
          />
        </HStack>
      </VStack>
    </TafelDialog>
  );
}
