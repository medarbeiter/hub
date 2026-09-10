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
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {belegAddAction, type ActionState} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {fmtDateLong, fmtDateRange, parseEuro} from '@/lib/format';
import {DatumFeld} from './datum-feld';
import {Sinnbild, umriss, type Sinn} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

export interface BelegArtWahl {
  value: string;
  label: string;
  sinn: Sinn;
}

const ARTEN: BelegArtWahl[] = [
  {value: 'uebernachtung', label: 'Übernachtung', sinn: 'uebernachtung'},
  {value: 'fahrt', label: 'Fahrt', sinn: 'fahrt'},
  {value: 'parken', label: 'Parken', sinn: 'parken'},
  {value: 'ticket', label: 'Ticket', sinn: 'ticket'},
  {value: 'sonstiges', label: 'Sonstiges', sinn: 'sonstiges'},
];

const MAX_MB = 10;

interface BelegDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  reiseId?: number;
  /** Der Reisezeitraum begrenzt das Belegdatum — der Server prüft es noch einmal. */
  vonISO: string;
  bisISO: string;
  /**
   * Derselbe Dialog für den Fahrzeugfall: andere Arten, andere Action, ein
   * anderes Feld, das den Beleg an seinen Gegenstand bindet. Ohne Angabe ist
   * es der Reisebeleg.
   */
  arten?: BelegArtWahl[];
  action?: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  felder?: Record<string, string>;
  untertitel?: string;
}

/**
 * Ein Beleg zu einer Reise. Bewusst kein `<form action=…>`: die Astryx-Felder
 * sind kontrolliert und die Datei liegt als File-Objekt im State, also wird die
 * FormData hier gebaut und die Action wie jede andere imperative Mutation über
 * useTransition aufgerufen.
 */
export function BelegDialog({
  isOpen,
  onOpenChange,
  reiseId,
  vonISO,
  bisISO,
  arten = ARTEN,
  action = belegAddAction,
  felder = {reiseId: String(reiseId ?? 0)},
  untertitel,
}: BelegDialogProps) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [art, setArt] = useState(arten[0]!.value);
  // Ein Tankbeleg ist meist von heute; ein Reisebeleg aus dem Reisezeitraum.
  const [datum, setDatum] = useState(reiseId === undefined ? bisISO : vonISO);
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
      for (const [name, wert] of Object.entries(felder)) fd.set(name, wert);
      fd.set('art', art);
      fd.set('datum', datum);
      fd.set('betrag', betrag);
      fd.set('beschreibung', beschreibung);
      if (datei) fd.set('datei', datei);
      const {error} = await sicher(action)({error: null}, fd);
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
      <DialogHeader title="Beleg hinzufügen" subtitle={untertitel ?? fmtDateRange(vonISO, bisISO)} />
      <VStack gap={4} padding={4}>
        {fehler && <Banner status="error" title={fehler} />}

        <Selector
          label="Art des Belegs"
          options={arten.map((a) => ({value: a.value, label: a.label, icon: umriss(a.sinn)}))}
          value={art}
          onChange={(value) => setArt(value ?? arten[0]!.value)}
        />

        <HStack gap={3} vAlign="start">
          <DatumFeld
            label="Belegdatum"
            value={datum}
            onChange={setDatum}
            min={vonISO}
            max={bisISO}
            placeholder="Datum wählen"
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
          placeholder={reiseId === undefined ? 'z. B. Aral Wandsbek, 42 l' : 'z. B. Hotel Nord, zwei Nächte'}
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
