'use client';

import {Card, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {useEffect, useState, type ReactNode} from 'react';
import {Ausklapp} from './ausklapp';
import {PersonZeichen} from './person-zeichen';
import {Aufklapppfeil, Sinnbild, type Sinn} from './sinnbilder';
import type {PersonAngabe} from '@/lib/avatar';

/** Eine rechtsbündige Kennzahlspalte am Zeilenende. */
export interface PruefSpalte {
  kopf: string;
  breite: number;
}

export interface PruefEintrag {
  id: number;
  /** Wer den Vorgang eingereicht hat — der Name bleibt sichtbar. */
  person: string;
  /** Das Profilzeichen derselben Person. */
  personBild?: PersonAngabe | null;
  /** Der Zeitraum, um den es geht — immer in Ziffernbreite. */
  zeitraum: string;
  /** Worum es geht: Anlass oder Art, plus Statusmarken. */
  gegenstand: ReactNode;
  /** Je Kennzahlspalte ein Wert, in derselben Reihenfolge wie `spalten`. */
  werte: ReactNode[];
  /** Was beim Aufklappen erscheint — die Einzelheiten und die Entscheidung. */
  inhalt: ReactNode;
}

interface PruefStapelProps {
  spalten: PruefSpalte[];
  eintraege: PruefEintrag[];
  /** Das Zeichen und die Sätze für den Leerfall. */
  leerSinn?: Sinn;
  leerTitel: string;
  leerText: string;
  /**
   * Ein Vorgang, der von außen benannt wurde (`?offen=`) — aus dem
   * Teamkalender heraus. Er steht offen und wird ins Bild geholt: ein Sprung,
   * der in einer Liste von dreißig Zeilen oben landet, ist keiner.
   */
  zeigeId?: number | null;
}

const SPALTE_PERSON = 168;
const SPALTE_ZEITRAUM = 148;

/**
 * Der Zeilenkörper beider Prüf-Warteschlangen.
 *
 * Spesen und Abwesenheit haben dieselbe Anatomie — wer, welcher Zeitraum,
 * worum es geht, ein oder zwei Kennzahlen, und beim Aufklappen die
 * Entscheidung — und bauten sie bis zum Umbau zweimal: 220 Zeilen in
 * `pruef-liste.tsx`, 296 in `abwesenheit-pruefliste.tsx`, mit eigenen
 * Spaltenbreiten und eigenem Leerfall.
 *
 * Was **nicht** geteilt wird, ist die Entscheidung selbst. Bei den Spesen gibt
 * es „Alle genehmigen", bei den Abwesenheiten bewusst nicht: eine Reise ist
 * geschehen und wird nachgerechnet, ein Urlaubsantrag ist eine Entscheidung
 * über eine Woche, in der jemand fehlen wird. Das ist eine Eigenschaft der
 * Seite und darf keine der Komponente werden.
 */
export function PruefStapel({
  spalten,
  eintraege,
  leerSinn,
  leerTitel,
  leerText,
  zeigeId,
}: PruefStapelProps) {
  // Bei genau einem Vorgang steht die Entscheidung sofort offen: aufklappen,
  // um das Einzige zu sehen, was da ist, wäre ein Klick ohne Frage.
  const [offen, setOffen] = useState<number | null>(
    zeigeId ?? (eintraege.length === 1 ? (eintraege[0]?.id ?? null) : null),
  );

  useEffect(() => {
    if (zeigeId == null) return;
    document.getElementById(`vorgang-${zeigeId}`)?.scrollIntoView({
      block: 'center',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }, [zeigeId]);

  if (eintraege.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn={leerSinn ?? 'pruefen'} groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            {leerTitel}
          </Text>
          <Text type="supporting" color="secondary">
            {leerText}
          </Text>
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack className="tabelle-scroll">
      <Card padding={0}>
        <VStack gap={0}>
          <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
            <span style={{inlineSize: SPALTE_PERSON, flexShrink: 0}}>
              <Text type="label" size="sm" color="secondary">
                Mitarbeiter
              </Text>
            </span>
            <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
              <Text type="label" size="sm" color="secondary">
                Zeitraum
              </Text>
            </span>
            <StackItem size="fill">
              <Text type="label" size="sm" color="secondary">
                Vorgang
              </Text>
            </StackItem>
            {spalten.map((s) => (
              <span key={s.kopf} style={{inlineSize: s.breite, flexShrink: 0, textAlign: 'end'}}>
                <Text type="label" size="sm" color="secondary">
                  {s.kopf}
                </Text>
              </span>
            ))}
            <span style={{inlineSize: 24, flexShrink: 0}} />
          </HStack>

          {eintraege.map((e) => {
            const istOffen = offen === e.id;
            return (
              <VStack key={e.id} gap={0}>
                <Divider />
                {/* Die ganze Zeile bleibt die Fläche, aber sie ist kein Knopf
                    mehr: der Knopf sitzt am Pfeil und legt sich unsichtbar über
                    die Zeile (`.zeilen-knopf::after`). Grund ist das Gesicht —
                    es öffnet seit dem Umbau die Personenkarte, und ein Knopf im
                    Knopf ist kein gültiges HTML. So bleibt beides erreichbar,
                    auch mit der Tastatur: erst das Gesicht, dann die Zeile. */}
                <HStack
                  id={`vorgang-${e.id}`}
                  className="zeilen-flaeche zeile-interaktiv"
                  gap={4}
                  vAlign="center"
                  paddingInline={4}
                  paddingBlock={2}
                >
                  <span className="zeilen-vorn" style={{inlineSize: SPALTE_PERSON, flexShrink: 0}}>
                    <PersonZeichen
                      person={e.personBild ?? null}
                      ersatzName={e.person}
                      groesse="zeile"
                      mitName
                      betont
                    />
                  </span>
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
                    <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                      {e.zeitraum}
                    </Text>
                  </span>
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      {e.gegenstand}
                    </HStack>
                  </StackItem>
                  {spalten.map((s, i) => (
                    <span key={s.kopf} style={{inlineSize: s.breite, flexShrink: 0, textAlign: 'end'}}>
                      {e.werte[i]}
                    </span>
                  ))}
                  <button
                    type="button"
                    className="zeilen-knopf"
                    aria-expanded={istOffen}
                    aria-label={`${e.person}, ${e.zeitraum} – Einzelheiten`}
                    onClick={() => setOffen(istOffen ? null : e.id)}
                  >
                    <Aufklapppfeil offen={istOffen} />
                  </button>
                </HStack>

                <Ausklapp offen={istOffen}>
                  <VStack paddingInline={4} paddingBlock={3}>
                    {e.inhalt}
                  </VStack>
                </Ausklapp>
              </VStack>
            );
          })}
        </VStack>
      </Card>
    </VStack>
  );
}
