'use client';

import {Banner, Card, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {useState} from 'react';
import {fmtDateLong, fmtDuration, fmtDurationSigned, fmtTime} from '@/lib/format';
import {AddEntryButton} from './add-entry-button';
import {REMINDER_MIN, useClock} from './clock-provider';
import {DayStrip} from './day-strip';
import type {TimelineSegment} from './day-timeline';
import {EntryList} from './entry-list';
import {PeriodSwitcher} from './period-switcher';
import {SegmentEditor} from './segment-editor';
import {WeekStrip, ZeitkontoCard, type WeekDay} from './week-strip';

interface HeuteViewProps {
  userId: number;
  firstName: string;
  week: WeekDay[];
  zeitkontoMin: number;
  usualStartMin: number | null;
  hasHistory: boolean;
}

/**
 * The Heute surface, built for the three-second visit: today's total and the
 * Feierabend prognosis in the primary reading position, the day as a compact
 * horizontal strip, entries as dense editable rows. Stamping lives in the
 * sticky ClockBar; this view only reads the shared clock state.
 */
export function HeuteView(props: HeuteViewProps) {
  const clock = useClock();
  const [editing, setEditing] = useState<TimelineSegment | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);

  const {segments, status, summary, nowMin, today, sollMin} = clock;
  const lateBanner = status !== 'aus' && nowMin >= REMINDER_MIN;

  const remaining = sollMin - summary.workedMin;
  // Same projection the clock bar states in words — one calculation, two readings.
  const feierabendMin = clock.prognose?.atMin ?? null;

  const openEditor = (segment: TimelineSegment | null) => {
    if (segment && segment.id < 0) return; // optimistic placeholder, not yet saved
    setEditing(segment);
    setEditorOpen(true);
  };

  // One line under the big figure: how the day stands. The concrete Feierabend
  // time lives in the clock bar, so the figure appears exactly once.
  const stand =
    status === 'aus' && segments.length === 0
      ? 'Noch nicht eingestempelt.'
      : remaining <= 0
        ? `${fmtDurationSigned(-remaining)} Std. über Soll`
        : `noch ${fmtDuration(remaining)} Std. bis zum Soll`;

  return (
    <VStack gap={5} padding={5}>
      {/* Past days needing correction are announced once, app-wide, by the
          AttentionBanner in the layout — not again here. */}
      {lateBanner && (
        <Banner
          status="warning"
          title="Es ist nach 19:00 Uhr und Sie sind noch eingestempelt."
          description="Falls Sie den Feierabend vergessen haben: einfach ausstempeln – oder die Zeit später korrigieren."
        />
      )}

      {!props.hasHistory && segments.length === 0 && (
        <Banner
          status="info"
          title="Willkommen bei der Zeiterfassung"
          description={`So funktioniert's: „Einstempeln“ oben in der Leiste startet Ihren Arbeitstag. Pausen erfassen Sie mit „Pause starten“, den Feierabend mit „Ausstempeln“. Vertippt? Jeder Eintrag lässt sich anklicken und korrigieren.`}
        />
      )}

      <PeriodSwitcher ansicht="heute" />

      <HStack gap={5} wrap="wrap" align="start">
        <StackItem size="fill">
          <VStack gap={4} minHeight={0}>
            <HStack justify="between" vAlign="end" gap={3} wrap="wrap">
              <VStack gap={1}>
                <Text type="supporting" color="secondary">
                  Guten Tag, {props.firstName} · {fmtDateLong(today)}
                </Text>
                <HStack vAlign="end" gap={2}>
                  <Heading level={1} type="display-3" accessibilityLevel={1}>
                    {fmtDuration(summary.workedMin)}
                  </Heading>
                  <Text type="supporting" color="secondary">
                    von {fmtDuration(sollMin)} Std.
                  </Text>
                </HStack>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {summary.pauseMin > 0 && <>Pausen {fmtDuration(summary.pauseMin)} Std. · </>}
                  {stand}
                </Text>
              </VStack>
              <AddEntryButton onClick={() => openEditor(null)} />
            </HStack>

            <Card padding={4}>
              <DayStrip
                segments={segments}
                isToday
                nowMin={nowMin}
                onSegmentClick={(s) => openEditor(s)}
                feierabendMin={feierabendMin}
                usualStartMin={props.usualStartMin}
              />
            </Card>

            <EntryList segments={segments} canEdit onEdit={openEditor} isToday />
            {/* The most common first-open state of the day. It names the one
                thing to do, without pointing at a position the clock bar does
                not keep (top on desktop, bottom on a phone). */}
            {segments.length === 0 && (
              <Text type="body" color="secondary">
                Noch keine Zeiten heute – mit „Einstempeln“ in der Stempelleiste beginnt Ihr Arbeitstag.
                {props.usualStartMin != null && <> Meistens starten Sie gegen {fmtTime(props.usualStartMin)}.</>}
              </Text>
            )}
          </VStack>
        </StackItem>

        <VStack gap={4} width={340} className="heute-rail">
          <WeekStrip
            days={props.week.map((d) => (d.date === today ? {...d, workedMin: summary.workedMin} : d))}
            today={today}
          />
          <Link href="/zeiten/konto" style={{textDecoration: 'none', color: 'inherit'}} className="zeile-interaktiv">
            <ZeitkontoCard balanceMin={props.zeitkontoMin} />
          </Link>
        </VStack>
      </HStack>

      <SegmentEditor
        isOpen={isEditorOpen}
        onOpenChange={setEditorOpen}
        userId={props.userId}
        date={editing?.date ?? today}
        segment={editing}
      />
    </VStack>
  );
}
