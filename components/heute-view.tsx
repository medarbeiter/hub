'use client';

import {Banner, Button, Card, Heading, HStack, StackItem, StatusDot, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {useEffect, useRef, useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {segmentResizeAction, stampAction} from '@/app/actions';
import {daySummary, fmtDate, fmtDateLong, fmtTime, nowMinutes} from '@/lib/format';
import type {ClockStatus} from '@/lib/time';
import {DayTimeline, type TimelineSegment} from './day-timeline';
import {SegmentEditor} from './segment-editor';
import {StampCard, type StampAction} from './stamp-card';
import {WeekStrip, ZeitkontoCard, type WeekDay} from './week-strip';

interface HeuteViewProps {
  userId: number;
  firstName: string;
  today: string;
  initialNowMin: number;
  segments: TimelineSegment[];
  status: ClockStatus;
  since: number | null;
  sollMin: number;
  week: WeekDay[];
  zeitkontoMin: number;
  anomalies: Array<{id: number; date: string; start_min: number}>;
  usualStartMin: number | null;
  hasHistory: boolean;
}

/** After this time, a still-running day earns a reminder (in-app + notification). */
const REMINDER_MIN = 19 * 60;

function deriveState(segments: TimelineSegment[]): {status: ClockStatus; since: number | null} {
  const open = segments.find((s) => s.end_min === null);
  if (!open) return {status: 'aus', since: null};
  return {status: open.kind, since: open.start_min};
}

/**
 * The Heute surface: live day timeline (left), stamp card + week + Zeitkonto
 * (right rail; separate instance first on mobile). Stamping is optimistic —
 * the timeline changes the instant the button is pressed.
 */
export function HeuteView(props: HeuteViewProps) {
  const [nowMin, setNowMin] = useState(props.initialNowMin);
  const [editing, setEditing] = useState<TimelineSegment | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [optimistic, setOptimistic] = useState<TimelineSegment[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [lateBanner, setLateBanner] = useState(false);
  const [, startTransition] = useTransition();
  const notifiedRef = useRef(false);
  const router = useRouter();

  // Fresh server data supersedes the optimistic overlay.
  useEffect(() => {
    setOptimistic(null);
  }, [props.segments]);

  const segments = optimistic ?? props.segments;
  const {status, since} = optimistic ? deriveState(segments) : {status: props.status, since: props.since};
  const summary = daySummary(segments, props.today, nowMin, props.today);

  // Live tick + late reminder.
  useEffect(() => {
    setNowMin(nowMinutes());
    const interval = setInterval(() => {
      setNowMin((prev) => {
        const next = nowMinutes();
        if (next < prev) router.refresh(); // midnight rollover
        return next;
      });
    }, 30_000);
    return () => clearInterval(interval);
  }, [router]);

  useEffect(() => {
    if (status === 'aus' || nowMin < REMINDER_MIN) {
      setLateBanner(false);
      return;
    }
    setLateBanner(true);
    if (!notifiedRef.current && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      notifiedRef.current = true;
      new Notification('MedArbeiter – noch eingestempelt?', {
        body: `Sie sind seit ${since !== null ? fmtTime(since) : 'heute'} ${status === 'pause' ? 'in der Pause' : 'eingestempelt'}. Ausstempeln nicht vergessen.`,
        icon: '/logo-mark.png',
      });
    }
  }, [nowMin, status, since]);

  const onStamp = async (action: StampAction): Promise<{error: string | null}> => {
    // Ask for notification permission on the first Einstempeln (user gesture).
    if (action === 'einstempeln' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
      void Notification.requestPermission();
    }
    const now = nowMinutes();
    const closeOpen = (list: TimelineSegment[]) =>
      list
        .map((s) => (s.end_min === null ? {...s, end_min: Math.max(now, s.start_min + 1)} : s))
        .filter((s) => s.end_min === null || s.end_min > s.start_min);
    const openSegment = (kind: 'arbeit' | 'pause'): TimelineSegment => ({
      id: -Date.now(),
      date: props.today,
      kind,
      start_min: now,
      end_min: null,
    });
    const base = props.segments;
    let next: TimelineSegment[] = base;
    if (action === 'einstempeln') next = [...base, openSegment('arbeit')];
    if (action === 'pause') next = [...closeOpen(base), openSegment('pause')];
    if (action === 'fortsetzen') next = [...closeOpen(base), openSegment('arbeit')];
    if (action === 'ausstempeln') next = closeOpen(base);
    setOptimistic(next);
    const result = await stampAction(action);
    if (result.error) {
      setOptimistic(null);
      return result;
    }
    router.refresh();
    return {error: null};
  };

  const onSegmentResize = (segment: TimelineSegment, startMin: number, endMin: number) => {
    startTransition(async () => {
      setActionError(null);
      const result = await segmentResizeAction(segment.id, startMin, endMin);
      if (result.error) setActionError(result.error);
      router.refresh();
    });
  };

  const remaining = props.sollMin - summary.workedMin;
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

  const stampCard = (
    <StampCard
      status={status}
      since={since}
      workedMin={summary.workedMin}
      pauseMin={summary.pauseMin}
      sollMin={props.sollMin}
      onStamp={onStamp}
    />
  );

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

      <span className="nur-mobil">{stampCard}</span>

      <HStack gap={5} wrap="wrap" align="start">
        <StackItem size="fill">
          <VStack gap={4} minHeight={0}>
            <HStack justify="between" vAlign="center" gap={3}>
              <VStack gap={0.5}>
                <Heading level={1}>Guten Tag, {props.firstName}</Heading>
                <HStack gap={2} vAlign="center">
                  {statusDot}
                  <Text type="supporting" color="secondary">
                    {fmtDateLong(props.today)}
                  </Text>
                </HStack>
              </VStack>
              <Button label="Eintrag hinzufügen" variant="ghost" size="sm" onClick={() => openEditor(null)} />
            </HStack>
            {actionError && <Banner status="error" title={actionError} />}
            <Card padding={4}>
              <DayTimeline
                segments={segments}
                date={props.today}
                isToday
                nowMin={nowMin}
                onSegmentClick={(s) => openEditor(s)}
                onSegmentResize={onSegmentResize}
                feierabendMin={feierabendMin}
                usualStartMin={props.usualStartMin}
              />
            </Card>
            <Text type="supporting" color="secondary">
              Einträge anklicken, um sie zu korrigieren – oder Kanten direkt auf der Zeitleiste ziehen.{' '}
              <Link href="/zeiten" style={{color: 'var(--color-text-accent)'}}>
                Alle Zeiten ansehen
              </Link>
            </Text>
          </VStack>
        </StackItem>

        <VStack gap={4} width={340} className="heute-rail">
          <span className="nur-desktop">{stampCard}</span>
          <WeekStrip
            days={props.week.map((d) => (d.date === props.today ? {...d, workedMin: summary.workedMin} : d))}
            today={props.today}
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
        date={editing?.date ?? props.today}
        segment={editing}
      />
    </VStack>
  );
}
