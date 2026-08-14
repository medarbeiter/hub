'use client';

import {Banner, Badge, VStack} from '@astryxdesign/core';
import {useEffect, useRef, type ReactNode} from 'react';
import type {Issue} from '@/lib/attention';
import type {DayTypeKind} from '@/lib/db';
import {
  fmtDateLong,
  fmtDuration,
  fmtDurationSigned,
  fmtGreeting,
  segmentPoints,
  spanOf,
  type TimelineSegment,
} from '@/lib/format';
import {REMINDER_MIN, useClock} from './clock-provider';
import {useMelde} from './melde';
import {TagesTafel} from './tages-tafel';
import {ZeitRahmen} from './zeit-rahmen';

interface TagAnsichtProps {
  userId: number;
  firstName: string;
  date: string;
  isToday: boolean;
  /** Server snapshot — authoritative for every day that is not today. */
  segments: TimelineSegment[];
  nowMin: number;
  workedMin: number;
  pauseMin: number;
  sollMin: number;
  dayType: DayTypeKind | null;
  dayTypeLabel: string | null;
  issues: Issue[];
  plan: {startMin: number; endMin: number} | null;
  canEdit: boolean;
  lockedNote?: string;
  hasHistory: boolean;
  nextIssue: {date: string; href: string} | null;
  /** Link zum Spesen-Editor für diesen Tag, sonst null. */
  spesenHref: string | null;
  nav: ReactNode;
  kontext: ReactNode;
}

/**
 * The Tag range. It reads the shared clock rather than a server snapshot, so
 * today's figure, lane and Feierabend projection all move together — the same
 * numbers the stamp strip is showing, never a second opinion.
 */
export function TagAnsicht(props: TagAnsichtProps) {
  const clock = useClock();
  const melde = useMelde();
  const live = props.isToday && clock.today === props.date;

  const segments = live ? clock.segments : props.segments;
  const nowMin = live ? clock.nowMin : props.nowMin;
  const workedMin = live ? clock.summary.workedMin : props.workedMin;
  const pauseMin = live ? clock.summary.pauseMin : props.pauseMin;
  const feierabendMin = live ? (clock.prognose?.atMin ?? null) : null;

  const span = spanOf(
    segmentPoints(segments, {
      isToday: live,
      nowMin,
      extra: [feierabendMin, props.plan?.startMin, props.plan?.endMin],
    }),
    6,
  );

  const rest = props.sollMin - workedMin;
  const stand = live
    ? clock.status === 'aus' && segments.length === 0
      ? 'Noch nicht eingestempelt.'
      : rest <= 0
        ? `${fmtDurationSigned(-rest)} Std. über Soll`
        : `noch ${fmtDuration(rest)} Std. bis zum Soll`
    : props.segments.length === 0
      ? props.sollMin > 0
        ? 'Keine Zeiten erfasst.'
        : 'Kein Arbeitstag.'
      : rest === 0
        ? 'Soll genau erfüllt'
        : `${fmtDurationSigned(-rest)} Std. zum Soll`;

  const spaet = live && clock.status !== 'aus' && nowMin >= REMINDER_MIN;
  const willkommen = live && !props.hasHistory && segments.length === 0;

  // Wie der ArbZG-Hinweis der Stempelleiste: kantengetrieben, ersetzt sich an
  // Ort und Stelle statt sich zu stapeln, und geht weg, sobald ausgestempelt
  // wird.
  const spaetSchliessen = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (spaet) {
      spaetSchliessen.current = melde({
        ton: 'warnung',
        titel: 'Es ist nach 19:00 Uhr und du bist noch eingestempelt.',
        text: 'Falls du den Feierabend vergessen hast: einfach ausstempeln – oder die Zeit später korrigieren.',
        dauerhaft: true,
        uniqueID: 'tag-spaet',
      });
    } else {
      spaetSchliessen.current?.();
      spaetSchliessen.current = null;
    }
  }, [spaet, melde]);

  return (
    <ZeitRahmen
      /* Der einzige Kopf der Anwendung, der heute selbst ausspricht: gelaufene
         Zeit gegen das Soll, Pausen, Rest. Solange er im Bild steht, schweigt
         die Stempelleiste dazu. */
      decktHeute={live}
      titel={live ? fmtGreeting(nowMin, props.firstName) : fmtDateLong(props.date)}
      figur={fmtDuration(workedMin)}
      figurEinheit={props.sollMin > 0 ? `von ${fmtDuration(props.sollMin)} Std.` : 'Std.'}
      stand={
        <>
          {pauseMin > 0 && <>Pausen {fmtDuration(pauseMin)} Std. · </>}
          {stand}
        </>
      }
      figurMeta={
        <>
          {props.dayTypeLabel && <Badge variant="neutral" label={props.dayTypeLabel} />}
          {props.lockedNote && <Badge variant="info" label="Monat abgeschlossen" />}
        </>
      }
      nav={props.nav}
      banner={
        willkommen ? (
          <VStack gap={3}>
            <Banner
              status="info"
              title="Willkommen bei MedArbeiter Hub"
              description={`So funktioniert's: „Einstempeln“ in der Leiste startet deinen Arbeitstag, „Pause starten“ unterbricht ihn, „Ausstempeln“ beendet ihn. Zeiten lassen sich jederzeit korrigieren – direkt auf der Zeitleiste oder über die Zeile darunter.`}
            />
          </VStack>
        ) : undefined
      }
      buehne={
        <TagesTafel
          userId={props.userId}
          date={props.date}
          isToday={live}
          nowMin={nowMin}
          segments={segments}
          span={span}
          workedMin={workedMin}
          pauseMin={pauseMin}
          sollMin={props.sollMin}
          canEdit={props.canEdit}
          lockedNote={props.lockedNote}
          dayType={props.dayType}
          dayTypeLabel={props.dayTypeLabel}
          issues={props.issues}
          plan={props.plan}
          feierabendMin={feierabendMin}
          kopf="aktionen"

          nextIssue={props.nextIssue}
          spesenHref={props.spesenHref}
        />
      }
      kontext={props.kontext}
    />
  );
}
