'use client';

/**
 * Die Rechte-Verwaltung — der Abschnitt unter der Rollenverwaltung auf
 * /mitarbeiter, sichtbar nur mit dem Recht `rechte.verwalten`.
 *
 * Hier stehen ausschließlich die eigenen Rechte (lib/eigene-rechte.ts) — die
 * Schlüssel, die eine angebundene App wie medarbeiterAI in ihrer
 * userinfo-Antwort prüft. Die eingebauten Rechte des Hubs sind Code und
 * tauchen hier nicht auf. Der Schlüssel ist der Vertrag mit der App und nach
 * dem Anlegen unveränderlich; Name, Beschreibung, Bereich und Stufe sind
 * Anzeige. Der Server prüft jede Regel ein zweites Mal.
 */
import {
  Banner,
  Button,
  DialogHeader,
  HStack,
  Selector,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {rechtLoeschenAction, rechtSpeichernAction, type ActionState} from '@/app/actions';
import {sicher, sicheresFormular} from '@/lib/aktion';
import {STUFEN, STUFEN_REIHENFOLGE, type RechtEintrag} from '@/lib/rechte';
import {useMelde} from './melde';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

const INITIAL: ActionState = {error: null};

const STUFE_OPTIONS = STUFEN_REIHENFOLGE.map((stufe) => ({value: stufe, label: STUFEN[stufe].label}));

function RechtForm({recht, onDone}: {recht: RechtEintrag | null; onDone: () => void}) {
  const [schluessel, setSchluessel] = useState(recht?.schluessel ?? '');
  const [label, setLabel] = useState(recht?.label ?? '');
  const [beschreibung, setBeschreibung] = useState(recht?.beschreibung ?? '');
  const [bereich, setBereich] = useState(recht?.bereich ?? '');
  const [stufe, setStufe] = useState<string>(recht?.stufe ?? 'weitreichend');
  const [state, formAction, isPending] = useActionState(sicheresFormular(rechtSpeichernAction), INITIAL);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) onDone();
    }
  }, [state, onDone]);

  return (
    <form action={formAction} className="tafel-rumpf">
      <VStack gap={4} padding={4}>
        {state.error && <Banner status="error" title={state.error} />}
        <TextInput
          label="Schlüssel"
          value={schluessel}
          onChange={setSchluessel}
          htmlName={recht ? undefined : 'schluessel'}
          isDisabled={recht !== null}
          placeholder="z. B. ai.reports.read"
          description={
            recht
              ? 'Der Schlüssel ist der Vertrag mit der App und lässt sich nicht ändern.'
              : 'Genau so prüft ihn die angebundene App (rechte.includes(…)) — Kleinbuchstaben, durch Punkte gegliedert.'
          }
        />
        {recht && <input type="hidden" name="schluessel" value={recht.schluessel} />}
        {recht && <input type="hidden" name="vorhanden" value="1" />}
        <TextInput label="Name" value={label} onChange={setLabel} htmlName="label" placeholder="z. B. Berichte sehen" />
        <TextInput
          label="Beschreibung"
          value={beschreibung}
          onChange={setBeschreibung}
          htmlName="beschreibung"
          placeholder="Was das Recht in der App erlaubt."
          description="Steht in der Mitarbeiter- und Rollenverwaltung neben dem Haken."
        />
        <TextInput
          label="Bereich"
          value={bereich}
          onChange={setBereich}
          htmlName="bereich"
          placeholder="z. B. medarbeiterAI"
          description="Die Gruppe in jeder Rechteliste — meist der Name der App."
        />
        <Selector
          label="Stufe"
          options={STUFE_OPTIONS}
          value={stufe}
          onChange={(value) => setStufe(value ?? 'weitreichend')}
          htmlName="stufe"
          description="Wie einschneidend das Recht ist; kritische Rechte tragen eine Marke."
        />
        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => onDone()} />
          <Button
            label={recht ? 'Speichern' : 'Recht anlegen'}
            variant="primary"
            type="submit"
            isLoading={isPending}
          />
        </HStack>
      </VStack>
    </form>
  );
}

export function RechteVerwaltung({rechte}: {rechte: RechtEintrag[]}) {
  const [editing, setEditing] = useState<RechtEintrag | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RechtEintrag | null>(null);
  const [isPending, startTransition] = useTransition();
  const melde = useMelde();
  const router = useRouter();

  const loeschen = (recht: RechtEintrag) =>
    startTransition(async () => {
      const result = await sicher(rechtLoeschenAction)(recht.schluessel);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      setConfirmDelete(null);
      router.refresh();
    });

  return (
    <VStack gap={2}>
      <Text type="label" color="secondary">
        Rechte angebundener Apps
      </Text>
      <Text type="supporting" size="sm" color="secondary" as="p">
        Diese Schlüssel prüfen angebundene Anwendungen bei der Anmeldung über MedArbeiter. Ein
        neues Recht steht sofort in jeder Rechteliste und im Katalog; die Rechte des Hubs selbst
        sind fest eingebaut und stehen nicht hier.
      </Text>
      <VStack gap={0}>
        {rechte.length === 0 && (
          <Text type="supporting" size="sm" color="secondary" as="p">
            Noch keine eigenen Rechte angelegt.
          </Text>
        )}
        {rechte.map((recht) => (
          <HStack key={recht.schluessel} gap={2} vAlign="center" justify="between" paddingBlock={2} wrap="wrap">
            <VStack gap={0}>
              <Text weight="medium">{recht.label}</Text>
              <Text type="supporting" size="sm" color="secondary">
                {recht.schluessel}
                {' · '}
                {recht.bereich}
                {recht.stufe === 'kritisch' ? ' · kritisch' : ''}
              </Text>
            </VStack>
            <HStack gap={1} justify="end" vAlign="center" wrap="nowrap">
              <Button
                label="Bearbeiten"
                variant="ghost"
                size="sm"
                icon={<Sinnbild sinn="bearbeiten" />}
                onClick={() => {
                  setEditing(recht);
                  setFormOpen(true);
                }}
              />
              <Button
                label="Löschen"
                variant="ghost"
                size="sm"
                icon={<Sinnbild sinn="entfernen" />}
                onClick={() => setConfirmDelete(recht)}
              />
            </HStack>
          </HStack>
        ))}
      </VStack>
      <span>
        <Button
          label="Recht anlegen"
          variant="secondary"
          icon={<Sinnbild sinn="hinzufuegen" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </span>

      <TafelDialog isOpen={isFormOpen} onOpenChange={setFormOpen} purpose="form" width={440}>
        <DialogHeader
          title={editing ? 'Recht bearbeiten' : 'Recht anlegen'}
          subtitle={
            editing
              ? editing.schluessel
              : 'Ein Schlüssel für eine angebundene App; vergeben wird er über Rollen und Zusatzrechte.'
          }
        />
        {isFormOpen && (
          <RechtForm
            recht={editing}
            onDone={() => {
              setFormOpen(false);
              router.refresh();
            }}
          />
        )}
      </TafelDialog>

      <TafelDialog
        isOpen={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader title="Recht löschen" subtitle={confirmDelete?.schluessel ?? ''} />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Das Recht verschwindet aus allen Rollen und Zusatzrechten; die angebundene App findet
            den Schlüssel ab der nächsten Anmeldung nicht mehr. Protokollzeilen bleiben. Ein Recht
            mit demselben Schlüssel lässt sich jederzeit neu anlegen — die Vergabe kommt dadurch
            nicht zurück.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setConfirmDelete(null)} />
            <Button
              label="Löschen"
              variant="destructive"
              isLoading={isPending}
              icon={<Sinnbild sinn="entfernen" />}
              onClick={() => confirmDelete && loeschen(confirmDelete)}
            />
          </HStack>
        </VStack>
      </TafelDialog>
    </VStack>
  );
}
