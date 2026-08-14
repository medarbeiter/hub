'use client';

import {HStack, Text, VStack} from '@astryxdesign/core';
import {useRouter, useSearchParams} from 'next/navigation';
import {useTransition} from 'react';
import {datumsachse} from '@/lib/datumsachse';
import {fmtDateLong} from '@/lib/format';
import {kalendergitter} from '@/lib/kalendergitter';
import {DatumsAchse} from './datums-achse';
import {Monatsgitter, type GitterZelle} from './monatsgitter';

export interface BandTag {
  datum: string;
  routine: number;
  eingriffe: number;
  fehler: number;
}

interface ProtokollBandProps {
  tage: BandTag[];
  vonISO: string;
  bisISO: string;
  heute: string | null;
  /** Der ausgewählte Tag, falls die Liste gerade auf einen gefiltert ist. */
  gewaehlt: string | null;
}

/** Die Höhe der höchsten Säule; darunter wird proportional gerechnet. */
const HOEHE = 56;

/**
 * Was an welchem Tag geschah — und zugleich der Weg zu diesem Tag.
 *
 * Das Band ist die Bühne dieser Seite: nicht Schmuck über einer Liste, sondern
 * die einzige Ansicht, in der ein Ausschlag überhaupt sichtbar wird. Vierzig
 * Korrekturen am letzten Tag eines Monats sind eine Geschichte, die keine
 * einzelne Zeile erzählen kann; hier steht sie als Säule da, und ein Klick
 * filtert die Liste darunter auf diesen Tag.
 *
 * Es läuft auf derselben Datumsachse wie der Teamkalender, das Reisenband und
 * der Abwesenheitsstapel (lib/datumsachse.ts). Keine zweite Zeitleiste: eine
 * Tagesbahn zeichnet Stunden in einem Tag, dies zeichnet Tage in einem Monat.
 *
 * Zwei Steine statt zweier Farben — Gold heißt in diesem Haus gearbeitete Zeit
 * und die Hauptschaltfläche, und ein Protokolleintrag ist weder das eine noch
 * das andere. Der dunklere Stein ist der Eingriff, der hellere die Routine,
 * und was abgewiesen wurde, sitzt als roter Kopf obenauf.
 */
export function ProtokollBand({tage, vonISO, bisISO, heute, gewaehlt}: ProtokollBandProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [, starte] = useTransition();
  const achse = datumsachse(vonISO, bisISO);
  // `tage` sind die Zahlen je Tag (die Eigenschaft), `achsenTage` die
  // Kalendertage des Ausschnitts — auch die leeren, die eine Säule ohne Höhe
  // bekommen, aber anklickbar bleiben.
  const achsenTage = achse.tage;
  const {links, breite} = achse;

  const proTag = new Map(tage.map((t) => [t.datum, t]));
  const hoechste = Math.max(1, ...tage.map((t) => t.routine + t.eingriffe + t.fehler));

  const waehle = (datum: string) => {
    const naechste = new URLSearchParams(params.toString());
    if (naechste.get('tag') === datum) naechste.delete('tag');
    else naechste.set('tag', datum);
    naechste.delete('seite');
    starte(() => router.push(`/protokoll?${naechste.toString()}`));
  };

  const gesamt = tage.reduce((s, t) => s + t.routine + t.eingriffe + t.fehler, 0);

  return (
    <VStack gap={1} className="protokoll-band">
      <span aria-hidden style={{position: 'relative', display: 'block', blockSize: HOEHE}}>
        {achsenTage.map((datum) => {
          const t = proTag.get(datum);
          const summe = (t?.routine ?? 0) + (t?.eingriffe ?? 0) + (t?.fehler ?? 0);
          const istGewaehlt = gewaehlt === datum;
          return (
            <button
              key={datum}
              type="button"
              className="protokoll-saeule"
              data-gewaehlt={istGewaehlt ? 'true' : undefined}
              // Auch ein leerer Tag ist anklickbar: „an dem Tag ist nichts
              // passiert" ist eine Auskunft, keine tote Fläche.
              title={`${fmtDateLong(datum)}: ${summe === 0 ? 'nichts' : `${summe} ${summe === 1 ? 'Eintrag' : 'Einträge'}`}`}
              onClick={() => waehle(datum)}
              style={{insetInlineStart: links(datum), inlineSize: breite(datum, datum)}}
            >
              <span className="protokoll-saeule-spur">
                {t && t.routine > 0 && (
                  <span
                    className="protokoll-teil protokoll-routine"
                    style={{blockSize: `${(t.routine / hoechste) * 100}%`}}
                  />
                )}
                {t && t.eingriffe > 0 && (
                  <span
                    className="protokoll-teil protokoll-eingriff"
                    style={{blockSize: `${(t.eingriffe / hoechste) * 100}%`}}
                  />
                )}
                {t && t.fehler > 0 && (
                  <span
                    className="protokoll-teil protokoll-fehler"
                    style={{blockSize: `${Math.max((t.fehler / hoechste) * 100, 4)}%`}}
                  />
                )}
              </span>
            </button>
          );
        })}
        {heute && (
          <span
            aria-hidden
            className="kalender-heute"
            style={{insetInlineStart: `calc(${links(heute)} + ${breite(heute, heute)} / 2)`}}
          />
        )}
      </span>

      {/* Dieselbe Achse und dieselbe Beschriftungsgrenze wie im Teamkalender:
          im Jahresausschnitt Monatsnamen statt Tageszahlen. */}
      <DatumsAchse achse={achse} />

      {/* Die Legende sagt, was die beiden Steine heißen — und die Zahl daneben,
          worüber man gerade schaut. */}
      <HStack gap={3} vAlign="center" wrap="wrap" paddingBlock={1}>
        <BandLegende klasse="protokoll-eingriff" text="Eingriffe" />
        <BandLegende klasse="protokoll-routine" text="Stempeln & Anmelden" />
        <BandLegende klasse="protokoll-fehler" text="Abgewiesen" />
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {gesamt} {gesamt === 1 ? 'Vorgang' : 'Vorgänge'} im Zeitraum
          {gewaehlt ? ` · gefiltert auf ${fmtDateLong(gewaehlt)}` : ''}
        </Text>
      </HStack>
    </VStack>
  );
}

/**
 * Dasselbe im Monatsgitter: die Dichte je Tag als Säule *in* der Zelle.
 *
 * Als Band waren im August zwei von einunddreißig Spalten belegt — 29 leere
 * Streifen, aus denen sich kein Wochentag ablesen ließ. Im Gitter steht die
 * Säule in ihrem Kalendertag, und die Frage „war das ein Montag" beantwortet
 * die Spalte, in der sie steht. Die zwei Steine und der rote Kopf bleiben
 * unverändert: Gold heißt in diesem Haus gearbeitete Zeit, und ein
 * Protokolleintrag ist weder das noch die Hauptschaltfläche.
 */
export function ProtokollGitter({
  tage,
  monat,
  ruhetage,
  heute,
  gewaehlt,
}: {
  tage: BandTag[];
  monat: string;
  ruhetage: string[];
  heute: string | null;
  gewaehlt: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [, starte] = useTransition();
  const gitter = kalendergitter(monat);
  const ruhe = new Set(ruhetage);

  const proTag = new Map(tage.map((t) => [t.datum, t]));
  const hoechste = Math.max(1, ...tage.map((t) => t.routine + t.eingriffe + t.fehler));

  const waehle = (datum: string) => {
    const naechste = new URLSearchParams(params.toString());
    if (naechste.get('tag') === datum) naechste.delete('tag');
    else naechste.set('tag', datum);
    naechste.delete('seite');
    starte(() => router.push(`/protokoll?${naechste.toString()}`));
  };

  const zelle = (datum: string): GitterZelle => {
    const t = proTag.get(datum);
    const summe = (t?.routine ?? 0) + (t?.eingriffe ?? 0) + (t?.fehler ?? 0);
    if (!t || summe === 0) {
      return {beschriftung: `${fmtDateLong(datum)}: nichts`};
    }
    return {
      zaehler: summe,
      beschriftung: `${fmtDateLong(datum)}: ${summe} ${summe === 1 ? 'Eintrag' : 'Einträge'}${
        t.fehler > 0 ? `, davon ${t.fehler} abgewiesen` : ''
      }`,
      inhalt: (
        <span aria-hidden className="protokoll-zellsaeule">
          {t.routine > 0 && (
            <span
              className="protokoll-teil protokoll-routine"
              style={{blockSize: `${(t.routine / hoechste) * 100}%`}}
            />
          )}
          {t.eingriffe > 0 && (
            <span
              className="protokoll-teil protokoll-eingriff"
              style={{blockSize: `${(t.eingriffe / hoechste) * 100}%`}}
            />
          )}
          {t.fehler > 0 && (
            <span
              className="protokoll-teil protokoll-fehler"
              style={{blockSize: `${Math.max((t.fehler / hoechste) * 100, 8)}%`}}
            />
          )}
        </span>
      ),
    };
  };

  return (
    <VStack gap={2}>
      <Monatsgitter
        gitter={gitter}
        ruhetage={ruhe}
        heute={heute}
        zelle={zelle}
        onTag={waehle}
        aktiverTag={gewaehlt}
        zellhoehe={66}
      />
      <HStack gap={3} vAlign="center" wrap="wrap">
        <BandLegende klasse="protokoll-eingriff" text="Eingriffe" />
        <BandLegende klasse="protokoll-routine" text="Stempeln & Anmelden" />
        <BandLegende klasse="protokoll-fehler" text="Abgewiesen" />
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {tage.reduce((s, t) => s + t.routine + t.eingriffe + t.fehler, 0)} Vorgänge im Zeitraum
          {gewaehlt ? ` · gefiltert auf ${fmtDateLong(gewaehlt)}` : ''}
        </Text>
      </HStack>
    </VStack>
  );
}

function BandLegende({klasse, text}: {klasse: string; text: string}) {
  return (
    <HStack gap={1.5} vAlign="center" wrap="nowrap">
      <span aria-hidden className={`protokoll-marke ${klasse}`} />
      <Text type="supporting" size="sm" color="secondary">
        {text}
      </Text>
    </HStack>
  );
}
