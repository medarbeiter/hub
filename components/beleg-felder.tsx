'use client';

import {
  Banner,
  Button,
  DialogHeader,
  FileInput,
  HStack,
  InputGroup,
  InputGroupText,
  Selector,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {DateInput} from '@astryxdesign/core/DateInput';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {belegAddAction} from '@/app/actions';
import {fmtDateLong, fmtDateRange, parseEuro} from '@/lib/format';
import {Sinnbild, umriss} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

const ARTEN = [
  {value: 'uebernachtung', label: 'Übernachtung', icon: umriss('uebernachtung')},
  {value: 'fahrt', label: 'Fahrt', icon: umriss('fahrt')},
  {value: 'parken', label: 'Parken', icon: umriss('parken')},
  {value: 'ticket', label: 'Ticket', icon: umriss('ticket')},
  {value: 'sonstiges', label: 'Sonstiges', icon: umriss('sonstiges')},
];

const MAX_MB = 10;

interface BelegDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  reiseId: number;
  /** Der Reisezeitraum begrenzt das Belegdatum — der Server prüft es noch einmal. */
  vonISO: string;
  bisISO: string;
}

/**
 * Ein Beleg zu einer Reise. Bewusst kein `<form action=…>`: die Astryx-Felder
 * sind kontrolliert und die Datei liegt als File-Objekt im State, also wird die
 * FormData hier gebaut und die Action wie jede andere imperative Mutation über
 * useTransition aufgerufen.
 */
export function BelegDialog({isOpen, onOpenChange, reiseId, vonISO, bisISO}: BelegDialogProps) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [art, setArt] = useState('uebernachtung');
  const [datum, setDatum] = useState(vonISO);
  const [betrag, setBetrag] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [datei, setDatei] = useState<File | null>(null);

  const betragCent = parseEuro(betrag);
  const hinweis =
    betrag.trim() !== '' && betragCent === null
      ? 'Bitte einen Betrag wie 12,50 angeben.'
      : datum < vonISO || datum > bisISO
        ? `Das Belegdatum muss zwischen dem ${fmtDateLong(vonISO)} und dem ${fmtDateLong(bisISO)} liegen.`
        : null;

  const speichern = () =>
    start(async () => {
      setFehler(null);
      const fd = new FormData();
      fd.set('reiseId', String(reiseId));
      fd.set('art', art);
      fd.set('datum', datum);
      fd.set('betrag', betrag);
      fd.set('beschreibung', beschreibung);
      if (datei) fd.set('datei', datei);
      const {error} = await belegAddAction({error: null}, fd);
      if (error) {
        setFehler(error);
        return;
      }
      setBetrag('');
      setBeschreibung('');
      setDatei(null);
      onOpenChange(false);
      router.refresh();
    });

  return (
    <TafelDialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
      <DialogHeader title="Beleg hinzufügen" subtitle={fmtDateRange(vonISO, bisISO)} />
      <VStack gap={4} padding={4}>
        {fehler && <Banner status="error" title={fehler} />}

        <Selector
          label="Art des Belegs"
          options={ARTEN}
          value={art}
          onChange={(value) => setArt(value ?? 'sonstiges')}
        />

        <HStack gap={3} vAlign="start">
          <DateInput
            label="Belegdatum"
            value={datum as never}
            onChange={(value) => setDatum(value ?? vonISO)}
            min={vonISO as never}
            max={bisISO as never}
            placeholder="Datum wählen"
            format={(value) => fmtDateLong(value)}
            width="100%"
          />
          <InputGroup label="Betrag">
            <TextInput label="Betrag" isLabelHidden value={betrag} onChange={setBetrag} placeholder="12,50" />
            <InputGroupText>€</InputGroupText>
          </InputGroup>
        </HStack>

        <TextInput
          label="Beschreibung"
          value={beschreibung}
          onChange={setBeschreibung}
          placeholder="z. B. Hotel Nord, zwei Nächte"
        />

        <FileInput
          label="Beleg als Datei"
          description={`JPG, PNG, WEBP oder PDF, höchstens ${MAX_MB} MB. Ohne Datei geht es auch.`}
          placeholder="Datei wählen"
          mode="dropzone"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          maxSize={MAX_MB * 1024 * 1024}
          value={datei}
          onChange={(files) => setDatei(Array.isArray(files) ? (files[0] ?? null) : files)}
        />

        {hinweis && <Banner status="warning" title={hinweis} />}

        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => onOpenChange(false)} />
          <Button
            label="Beleg speichern"
            variant="primary"
            isLoading={isPending}
            icon={<Sinnbild sinn="beleg" />}
            isDisabled={betragCent === null || hinweis !== null}
            onClick={speichern}
          />
        </HStack>
      </VStack>
    </TafelDialog>
  );
}
