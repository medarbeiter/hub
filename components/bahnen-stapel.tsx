'use client';

import {Badge, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useEffect, useState} from 'react';
import type {Issue} from '@/lib/attention';
import type {DayTypeKind} from '@/lib/db';
import {
  fmtDuration,
  fmtDurationSigned,
  fmtWeekdayShort,
  hourTicks,
  type Span,
  type TimelineSegment,
} from '@/lib/format';
import {Ausklapp} from './ausklapp';
import {useClockOptional} from './clock-provider';
import {Aufklapppfeil, Sinnbild} from './sinnbilder';
import {TagesVerweis} from './tages-verweis';
import {Tagesbahn} from './tagesbahn';
import {TagesTafel} from './tages-tafel';

export interface StapelGruppe {
  label: string;
  workedMin: number;
  sollMin: number;
}

export interface StapelTag {
  date: string;
  segments: TimelineSegment[];
  workedMin: number;
  pauseMin: number;
  sollMin: number;
  hasOpen: boolean;
  dayType: DayTypeKind | null;
  dayTypeLabel: string | null;
  issues: Issue[];
  plan: {startMin: number; endMin: number} | null;
  isToday: boolean;
  isFuture: boolean;
  /** Rendered as a heading before this day — the calendar week inside a month. */
  gruppeVor?: StapelGruppe;
}

interface BahnenStapelProps {
  userId: number;
  days: StapelTag[];
  span: Span;
  nowMin: number;
  selectedDate: string;
  canEdit: boolean;
  lockedNote?: string;
  /** Everything the stack needs to build its own links — a server component
      cannot hand a function across the boundary. */
  bereich: 'woche' | 'monat';
  basePath: string;
  /** Days needing a correction, most recent first. */
  queue: string[];
}

const SPALTE_TAG = 76;
const SPALTE_SUMME = 112;

const KURZ: Record<string, string> = {
  offen: 'Offen',
  unbestaetigt: 'Prüfen',
  unplausibel: 'Prüfen',
  fehlt: 'Fehlt',
};

/**
 * A period as a stack of day lanes on one shared hour axis — the zoom made
 * literal. Every lane is drawn by the same component the day surface uses, so
 * Monday and Thursday can finally be compared by shape alone; opening a day
 * expands its lane in place into the full editing surface instead of sending
 * the eye to a detail pane on the other side of the screen.
 */
export function BahnenStapel(props: BahnenStapelProps) {
  const router = useRouter();
  const [offen, setOffen] = useState(props.selectedDate);
  useEffect(() => setOffen(props.selectedDate), [props.selectedDate]);

  // Today's lane in a week or month is the same running day the clock strip is
  // showing, so it ticks here too rather than freezing at the server snapshot.
  const clock = useClockOptional();
  const nowMin = clock?.nowMin ?? props.nowMin;
  const days = props.days.map((d) =>
    clock && d.isToday && clock.today === d.date
      ? {
          ...d,
          segments: clock.segments,
          workedMin: clock.summary.workedMin,
          pauseMin: clock.summary.pauseMin,
          hasOpen: clock.summary.hasOpen,
        }
      : d,
  );

  const stunden = hourTicks(props.span);
  const x = (min: number) => `${((min - props.span.from) / (props.span.to - props.span.from)) * 100}%`;

  const hrefFor = (date: string) =>
    `${props.basePath}?${new URLSearchParams({ansicht: props.bereich, tag: date}).toString()}`;

  const nextIssueFor = (current: string) => {
    const next = props.queue.find((d) => d !== current);
    return next ? {date: next, href: hrefFor(next)} : null;
  };

  const istZukunft = (date: string) => days.find((d) => d.date === date)?.isFuture ?? false;

  const umschalten = (date: string) => {
    const naechste = offen === date ? '' : date;
    setOffen(naechste);
    // Keep the selection shareable without a navigation that would discard the
    // expansion we just opened.
    //
    // Für einen künftigen Tag aber nicht: die Tagesansicht zeigt nach vorn
    // nichts und fällt auf heute zurück (`zeitAusUrl`). Die Adresse behauptete
    // dann einen Tag, den die Seite gar nicht zeigt — beim Neuladen landete man
    // wortlos woanders. Seit Abwesenheiten in der Zukunft liegen dürfen, ist
    // das kein Randfall mehr, sondern der Normalfall im Monatsstapel.
    if (naechste && !istZukunft(naechste)) router.replace(hrefFor(naechste), {scroll: false});
  };

  return (
    <VStack gap={0}>
      {/* The axis, labelled once for the whole stack — the lanes carry the rules. */}
      <HStack gap={3} vAlign="center" paddingInline={2}>
        <span style={{inlineSize: SPALTE_TAG, flexShrink: 0}} />
        <StackItem size="fill">
          <span aria-hidden style={{position: 'relative', display: 'block', blockSize: 18}}>
            {stunden.map((h) => (
              <span
                key={h}
                style={{
                  position: 'absolute',
                  insetBlockStart: 0,
                  insetInlineStart: x(h * 60),
                  transform: 'translateX(-50%)',
                }}
              >
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {String(h).padStart(2, '0')}
                </Text>
              </span>
            ))}
          </span>
        </StackItem>
        <span style={{inlineSize: SPALTE_SUMME, flexShrink: 0}} />
        <span style={{inlineSize: 16, flexShrink: 0}} />
      </HStack>

      <VStack as="ol" gap={0} className="bahn-stapel">
        {days.map((day) => {
          const istOffen = offen === day.date;
          const problem = day.issues.find((i) => i.needsCorrection);
          const diff = day.workedMin - day.sollMin;
          const zeigtDiff = !day.isFuture && !day.hasOpen && day.sollMin > 0 && (!day.isToday || diff >= 0);

          return (
            <VStack as="li" key={day.date} gap={0} className="bahn-reihe">
              {day.gruppeVor && (
                <HStack justify="between" vAlign="center" paddingInline={2} paddingBlock={2} gap={3}>
                  <Text type="label" size="sm" color="secondary">
                    {day.gruppeVor.label}
                  </Text>
                  <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                    {fmtDuration(day.gruppeVor.workedMin)} von {fmtDuration(day.gruppeVor.sollMin)} Std.
                  </Text>
                </HStack>
              )}

              {/* Die Datumsspalte steht bewusst außerhalb des Aufklapp-Knopfes:
                  sie ist ein eigenes Ziel (Abwesenheit erfassen), und ein Ziel
                  im anderen wäre weder bedienbar noch beschreibbar.

                  Sie ist seit dem Umbau ein schlichter Verweis und keine
                  Ziehfläche mehr. Die Auswahl mehrerer Tage wohnt jetzt dort,
                  wo sie hingehört: im Monatsgitter auf /abwesenheit, das den
                  gewählten Zeitraum auch zeigt. Damit gibt es auf dieser Fläche
                  nur noch eine Ziehgeste — die der Tagesbahn, die einen Eintrag
                  anlegt — und der schräge Zug entscheidet nichts mehr. */}
              {/* Die Hinterlegung des offenen Tages sitzt an der ganzen Reihe,
                  nicht am Knopf: seit die Datumsspalte ein eigenes Ziel ist,
                  begann die Goldwäsche sonst erst 88 px weiter rechts und ließ
                  das Datum weiß stehen — ein Riss quer durch die Zeile. */}
              <HStack
                gap={0}
                vAlign="center"
                className={['tagesgriff-reihe', istOffen ? 'offen' : null].filter(Boolean).join(' ')}
              >
                <HStack paddingInline={2} paddingBlock={2}>
                  <TagesVerweis datum={day.date} breite={SPALTE_TAG} istHeute={day.isToday} istZukunft={day.isFuture} />
                </HStack>

                <StackItem size="fill">
                  <button
                    type="button"
                    className="eintrag-zeile zeile-interaktiv"
                    aria-expanded={istOffen}
                    onClick={() => umschalten(day.date)}
                    style={{borderRadius: 'var(--radius-inner)'}}
                  >
                    <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2}>
                      <StackItem size="fill">
                        <Tagesbahn
                          date={day.date}
                          segments={day.segments}
                          isToday={day.isToday}
                          nowMin={nowMin}
                          span={props.span}
                          groesse="zeile"
                          plan={day.plan}
                        />
                      </StackItem>

                      <HStack gap={1} vAlign="center" justify="end" wrap="nowrap" width={SPALTE_SUMME}>
                        {/* Die Tagesart trägt hier dasselbe Zeichen wie die Art
                            der Abwesenheit, die sie gesetzt hat — ein Urlaubstag
                            ist im Monatsstapel an der Insel erkennbar, ohne das
                            Wort zu lesen. */}
                        {problem ? (
                          <Badge
                            variant="warning"
                            label={KURZ[problem.kind] ?? 'Prüfen'}
                            icon={<Sinnbild sinn="warnung" groesse="zeile" />}
                          />
                        ) : day.dayTypeLabel ? (
                          <Badge
                            variant="neutral"
                            label={day.dayTypeLabel}
                            icon={day.dayType ? <Sinnbild sinn={day.dayType} groesse="zeile" /> : undefined}
                          />
                        ) : day.segments.length > 0 ? (
                          <>
                            <Text type="body" size="sm" hasTabularNumbers>
                              {fmtDuration(day.workedMin)}
                            </Text>
                            {zeigtDiff && (
                              <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                                ({fmtDurationSigned(diff)})
                              </Text>
                            )}
                          </>
                        ) : (
                          <Text type="supporting" size="sm" color="disabled">
                            {(day.isFuture || day.isToday) && day.sollMin > 0 ? 'geplant' : '–'}
                          </Text>
                        )}
                      </HStack>

                      <Aufklapppfeil offen={istOffen} />
                    </HStack>
                  </button>
                </StackItem>
              </HStack>

              {/* Indented onto the lane column: the day grows out of its own
                  lane rather than appearing as a panel of a different width.
                  `Ausklapp` lässt es die Höhe hinauf- und wieder hinunterlaufen,
                  statt die Zeilen darunter springen zu lassen. */}
              <Ausklapp offen={istOffen}>
                <HStack gap={3} paddingInline={2} paddingBlock={3} align="start">
                  <span style={{inlineSize: SPALTE_TAG, flexShrink: 0}} />
                  <StackItem size="fill">
                  <TagesTafel
                    userId={props.userId}
                    date={day.date}
                    isToday={day.isToday}
                    nowMin={nowMin}
                    segments={day.segments}
                    span={props.span}
                    workedMin={day.workedMin}
                    pauseMin={day.pauseMin}
                    sollMin={day.sollMin}
                    canEdit={props.canEdit && !day.isFuture}
                    lockedNote={props.lockedNote}
                    dayType={day.dayType}
                    dayTypeLabel={day.dayTypeLabel}
                    issues={day.issues}
                    plan={day.plan}
                    kopf="voll"
                    achse="raster"
                    nextIssue={nextIssueFor(day.date)}
                  />
                  </StackItem>
                  <span style={{inlineSize: SPALTE_SUMME + 16 + 12, flexShrink: 0}} />
                </HStack>
              </Ausklapp>

              <Divider />
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}
