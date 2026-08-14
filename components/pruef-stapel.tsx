'use client';

import {Card, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {useState, type ReactNode} from 'react';
import {Ausklapp} from './ausklapp';
import {Aufklapppfeil, Sinnbild, type Sinn} from './sinnbilder';

/** Eine rechtsbündige Kennzahlspalte am Zeilenende. */
export interface PruefSpalte {
  kopf: string;
  breite: number;
}

export interface PruefEintrag {
  id: number;
  /** Wer den Vorgang eingereicht hat. */
  person: string;
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
export function PruefStapel({spalten, eintraege, leerSinn, leerTitel, leerText}: PruefStapelProps) {
  // Bei genau einem Vorgang steht die Entscheidung sofort offen: aufklappen,
  // um das Einzige zu sehen, was da ist, wäre ein Klick ohne Frage.
  const [offen, setOffen] = useState<number | null>(
    eintraege.length === 1 ? (eintraege[0]?.id ?? null) : null,
  );

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
                <button
                  type="button"
                  className="eintrag-zeile zeile-interaktiv"
                  aria-expanded={istOffen}
                  onClick={() => setOffen(istOffen ? null : e.id)}
                >
                  <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
                    <span style={{inlineSize: SPALTE_PERSON, flexShrink: 0}}>
                      <Text type="body" size="sm" weight="semibold" maxLines={1}>
                        {e.person}
                      </Text>
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
                    <Aufklapppfeil offen={istOffen} />
                  </HStack>
                </button>

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
