'use client';

import {Button, HStack, Selector, Switch, TextInput} from '@astryxdesign/core';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState, useTransition} from 'react';
import {BEREICH_LABEL, ERFASSUNGSARTEN, ERFASSUNG_LABEL, PROTOKOLL_BEREICHE} from '@/lib/protokoll-arten';
import {Sinnbild, umriss} from './sinnbilder';

interface ProtokollFilterProps {
  /** Wer im Protokoll vorkommt — nur die Verwaltung bekommt beide Listen. */
  akteure: Array<{id: number; name: string}>;
  betroffene: Array<{id: number; name: string}>;
  darfNachPersonFiltern: boolean;
}

/**
 * Die Filterleiste. Sie schreibt ausschließlich in die Adresse und hält keinen
 * eigenen Zustand außer dem Suchfeld — dieselbe Regel, nach der die
 * Bereichsleiste arbeitet.
 *
 * Das ist keine Förmlichkeit: ein gefiltertes Protokoll ist genau das, was
 * jemand weiterreicht („schau dir den 31. an"). Läge der Filter im
 * Komponentenzustand, wäre die Adresse eine Lüge und der Verweis wertlos. So
 * überlebt jede Einstellung das Neuladen, den Zurück-Knopf und das Verschicken.
 */
export function ProtokollFilter({akteure, betroffene, darfNachPersonFiltern}: ProtokollFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [laeuft, starte] = useTransition();
  const [suche, setSuche] = useState(params.get('suche') ?? '');

  // Kommt die Seite mit einer anderen Adresse zurück (Zurück-Knopf, ein Klick
  // ins Band), muss das Feld mitziehen.
  useEffect(() => {
    setSuche(params.get('suche') ?? '');
  }, [params]);

  const setze = (aenderungen: Record<string, string | null>) => {
    const naechste = new URLSearchParams(params.toString());
    for (const [schluessel, wert] of Object.entries(aenderungen)) {
      if (wert === null || wert === '') naechste.delete(schluessel);
      else naechste.set(schluessel, wert);
    }
    // Jede Änderung eines Filters führt zurück auf die erste Seite: sonst
    // stünde man auf Seite 7 einer Liste, die nur noch drei Seiten hat.
    naechste.delete('seite');
    starte(() => router.push(`/protokoll?${naechste.toString()}`));
  };

  // `null` und nicht `''`: ein leerer Zeichenkettenwert gilt Astryx als
  // Auswahl, und der Selector zeigte dann sein Lösch-Kreuz neben „Alle
  // Bereiche" — ein Knopf, der nichts zu löschen hat.
  const wert = (name: string) => params.get(name);
  /** Was „zurücksetzen" wegnimmt — der Zeitraum gehört ausdrücklich nicht dazu. */
  const FILTER_SCHLUESSEL = ['bereich', 'akteur', 'person', 'tag', 'suche', 'nur', 'erfassung', 'seite'];
  const hatFilter = FILTER_SCHLUESSEL.some((k) => params.get(k));

  const zuruecksetzen = () => {
    // Nur die Filter fallen, nicht die Ansicht: wer im Juni sucht und
    // zurücksetzt, will den Juni ohne Filter sehen — nicht plötzlich den
    // laufenden Monat.
    const naechste = new URLSearchParams(params.toString());
    for (const k of FILTER_SCHLUESSEL) naechste.delete(k);
    starte(() => router.push(`/protokoll?${naechste.toString()}`));
  };

  return (
    <HStack gap={2} vAlign="end" wrap="wrap" className="protokoll-filter">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setze({suche});
        }}
      >
        <TextInput
          label="Suche"
          isLabelHidden
          placeholder="Gegenstand oder Name …"
          value={suche}
          onChange={setSuche}
          size="sm"
          width={216}
          startIcon={umriss('suchen')}
          hasClear
        />
      </form>

      <Selector
        label="Bereich"
        isLabelHidden
        size="sm"
        width={168}
        placeholder="Alle Bereiche"
        hasClear
        value={wert('bereich')}
        options={PROTOKOLL_BEREICHE.map((b) => ({value: b, label: BEREICH_LABEL[b]}))}
        onChange={(v) => setze({bereich: v})}
      />

      {darfNachPersonFiltern && (
        <>
          <Selector
            label="Betrifft"
            isLabelHidden
            size="sm"
            width={168}
            placeholder="Alle Betroffenen"
            hasSearch
            hasClear
            value={wert('person')}
            options={betroffene.map((p) => ({value: String(p.id), label: p.name}))}
            onChange={(v) => setze({person: v})}
          />
          <Selector
            label="Ausgeführt von"
            isLabelHidden
            size="sm"
            width={168}
            placeholder="Alle Handelnden"
            hasSearch
            hasClear
            value={wert('akteur')}
            options={akteure.map((p) => ({value: String(p.id), label: p.name}))}
            onChange={(v) => setze({akteur: v})}
          />
        </>
      )}

      {/* Wie die Zeit in den Datensatz kam. „Nachgetragen" ist die Frage
          einer Betriebsprüfung in einem Wort: welche Stunden hat niemand
          gestempelt, sondern jemand eingetragen? Zeilen ohne erfasste Zeit
          (eine Genehmigung, eine Einstellung) fallen dabei heraus — gefragt
          ist nach Zeit, nicht nach allem, was am selben Tag geschah. */}
      <Selector
        label="Erfassung"
        isLabelHidden
        size="sm"
        width={168}
        placeholder="Jede Erfassung"
        hasClear
        value={wert('erfassung')}
        options={ERFASSUNGSARTEN.map((a) => ({value: a, label: ERFASSUNG_LABEL[a]}))}
        onChange={(v) => setze({erfassung: v})}
      />

      {/* Die Vorauswahl zeigt Eingriffe. Das Stempeln selbst ist nicht
          versteckt, sondern einen Schalter entfernt — bei fünfzig Leuten sind
          es über tausend Zeilen die Woche, und dazwischen fände niemand die
          eine Korrektur. */}
      <Switch
        label="Auch das Stempeln"
        size="sm"
        value={params.get('nur') === 'alles'}
        onChange={(an) => setze({nur: an ? 'alles' : null})}
      />

      {hatFilter && (
        <Button
          label="Filter zurücksetzen"
          variant="ghost"
          size="sm"
          icon={<Sinnbild sinn="erneut" />}
          isLoading={laeuft}
          onClick={zuruecksetzen}
        />
      )}
    </HStack>
  );
}
