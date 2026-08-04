'use client';

import {Banner, Button, Card, Heading, HStack, StackItem, StatusDot, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {segmentResizeAction} from '@/app/actions';
import {fmtDate, fmtDateLong} from '@/lib/format';
import {AddEntryButton} from './add-entry-button';
import {REMINDER_MIN, useClock} from './clock-provider';
import {DayTimeline, type TimelineSegment} from './day-timeline';
import {SegmentEditor} from './segment-editor';
import {WeekStrip, ZeitkontoCard, type WeekDay} from './week-strip';

interface HeuteViewProps {
  userId: number;
  firstName: string;
  week: WeekDay[];
  zeitkontoMin: number;
  anomalies: Array<{id: number; date: string; start_min: number}>;
  usualStartMin: number | null;
  hasHistory: boolean;
}

/**
 * The Heute surface: live day timeline (left), week + Zeitkonto (right rail).
 * Clock state and stamping live in the ClockProvider/ClockBar — this view
 * only reads from that shared state.
 */
export function HeuteView(props: HeuteViewProps) {
  const clock = useClock();
  const [editing, setEditing] = useState<TimelineSegment | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  const {segments, status, since, summary, nowMin, today} = clock;
  const lateBanner = status !== 'aus' && nowMin >= REMINDER_MIN;

  const onSegmentResize = (segment: TimelineSegment, startMin: number, endMin: number) => {
    startTransition(async () => {
      setActionError(null);
      const result = await segmentResizeAction(segment.id, startMin, endMin);
      if (result.error) setActionError(result.error);
      router.refresh();
    });
  };

  const remaining = clock.sollMin - summary.workedMin;
  const feierabendMin = status !== 'aus' && remaining > 0 && nowMin + remaining < 1440 ? nowMin + remaining : null;

  const statusDot =
    status === 'arbeit' ? (
      <StatusDot variant="accent" label="Eingestempelt" isPulsing />
    ) : status === 'pause' ? (
      <StatusDot variant="warning" label="Pause" isPulsing />
    ) : (
      <StatusDot variant="neutral" label="Ausgestempelt" />
    );

  const openEditor = (segment: TimelineSegment | null) => {
    if (segment && segment.id < 0) return; // optimistic placeholder, not yet saved
    setEditing(segment);
    setEditorOpen(true);
  };

  return (
    <VStack gap={5} padding={5}>
      {props.anomalies.length > 0 && (
        <Banner
          status="warning"
          title={
            props.anomalies.length === 1
              ? `Offener Eintrag vom ${fmtDate(props.anomalies[0]!.date)} – Ausstempeln wurde vergessen.`
              : `${props.anomalies.length} offene Einträge an vergangenen Tagen.`
          }
          description="Bitte korrigieren Sie die Einträge, damit der Monat abgeschlossen werden kann."
          endContent={
            <Button
              label="Jetzt korrigieren"
              variant="secondary"
              size="sm"
              onClick={() => router.push(`/zeiten?tag=${props.anomalies[0]!.date}`)}
            />
          }
        />
      )}

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
          description={`So funktioniert's: Einstempeln startet Ihren Arbeitstag auf der Zeitleiste. Pausen erfassen Sie mit „Pause starten“, den Feierabend mit „Ausstempeln“. Vertippt? Jeder Eintrag lässt sich anklicken und korrigieren – alle Tage finden Sie unter „Meine Zeiten“.`}
        />
      )}

      <HStack gap={5} wrap="wrap" align="start">
        <StackItem size="fill">
          <VStack gap={4} minHeight={0}>
            <HStack justify="between" vAlign="center" gap={3}>
              <VStack gap={0.5}>
                <Heading level={1}>Guten Tag, {props.firstName}</Heading>
                <HStack gap={2} vAlign="center">
                  {statusDot}
                  <Text type="supporting" color="secondary">
                    {fmtDateLong(today)}
                  </Text>
                </HStack>
              </VStack>
              <AddEntryButton onClick={() => openEditor(null)} />
            </HStack>
            {actionError && <Banner status="error" title={actionError} />}
            <Card padding={4}>
              <DayTimeline
                segments={segments}
                date={today}
                isToday
                nowMin={nowMin}
                onSegmentClick={(s) => openEditor(s)}
                onSegmentResize={onSegmentResize}
                feierabendMin={feierabendMin}
                usualStartMin={props.usualStartMin}
              />
            </Card>
            <Text type="supporting" color="secondary">
              <Link href="/zeiten" style={{color: 'var(--color-text-accent)'}}>
                Alle Zeiten ansehen
              </Link>
            </Text>
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
