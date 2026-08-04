'use client';

import {Banner, Button, Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {segmentConfirmAction, segmentResizeAction} from '@/app/actions';
import {fmtDate, fmtDateLong, fmtDuration} from '@/lib/format';
import type {Issue} from '@/lib/attention';
import type {DayTypeKind} from '@/lib/db';
import {AddEntryButton} from './add-entry-button';
import {DayTypeControl} from './day-type-control';
import {DayTimeline, type TimelineSegment} from './day-timeline';
import {EntryList} from './entry-list';
import {SegmentEditor} from './segment-editor';

interface DayDetailProps {
  userId: number;
  date: string;
  isToday: boolean;
  nowMin: number;
  segments: TimelineSegment[];
  workedMin: number;
  pauseMin: number;
  sollMin: number;
  canEdit: boolean;
  lockedNote?: string;
  dayType?: DayTypeKind | null;
  dayTypeLabel?: string | null;
  /** What this day needs, if anything — shown inline above the entries. */
  issues?: Issue[];
  /**
   * The next day needing correction, so several can be fixed in a row.
   * A plain object, not a callback: this component runs on the client.
   */
  nextIssue?: {date: string; href: string} | null;
}

/**
 * One day, fully inspectable: the timeline plus the entry list with inline
 * corrections. Shared between "Meine Zeiten" and the manager's team view.
 */
export function DayDetail(props: DayDetailProps) {
  const [editing, setEditing] = useState<TimelineSegment | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [resizeError, setResizeError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isConfirming, startConfirm] = useTransition();
  const router = useRouter();

  const openEditor = (segment: TimelineSegment | null) => {
    setEditing(segment);
    setEditorOpen(true);
  };

  const onSegmentResize = (segment: TimelineSegment, startMin: number, endMin: number) => {
    startTransition(async () => {
      setResizeError(null);
      const result = await segmentResizeAction(segment.id, startMin, endMin);
      if (result.error) setResizeError(result.error);
      router.refresh();
    });
  };

  const diff = props.workedMin - props.sollMin;
  const hasUnfinished = props.segments.some((s) => s.end_min === null);

  return (
    <VStack gap={4}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={2}>{fmtDateLong(props.date)}</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtDuration(props.workedMin)} Std. gearbeitet · {fmtDuration(props.pauseMin)} Std. Pause
            {props.sollMin > 0 && (
              <>
                {' · Soll '}
                {fmtDuration(props.sollMin)}
              </>
            )}
          </Text>
        </VStack>
        <HStack gap={2} vAlign="center" wrap="wrap">
          <DayTypeControl
            userId={props.userId}
            date={props.date}
            type={props.dayType ?? null}
            computedLabel={props.dayTypeLabel ?? null}
            isDisabled={!props.canEdit}
          />
          {props.canEdit && <AddEntryButton onClick={() => openEditor(null)} />}
        </HStack>
      </HStack>

      {props.lockedNote && <Banner status="info" title={props.lockedNote} />}
      {resizeError && <Banner status="error" title={resizeError} />}
      {confirmError && <Banner status="error" title={confirmError} />}

      {props.issues?.map((issue) => (
        <Banner
          key={issue.kind}
          status={issue.needsCorrection ? 'warning' : 'info'}
          title={issue.message}
          description={
            issue.kind === 'unbestaetigt'
              ? 'Die Endzeit wurde automatisch gesetzt. Stimmt sie, bestätigen Sie den Eintrag – sonst korrigieren Sie ihn.'
              : issue.needsCorrection
                ? undefined
                : 'Der Eintrag bleibt wie erfasst. Ergänzen Sie bei Bedarf eine Notiz mit dem Grund.'
          }
          endContent={
            issue.kind === 'unbestaetigt' && props.canEdit ? (
              <Button
                label="Zeiten bestätigen"
                variant="secondary"
                size="sm"
                isLoading={isConfirming}
                onClick={() => {
                  const target = props.segments.find((s) => s.auto_closed === 1);
                  if (!target) return;
                  startConfirm(async () => {
                    setConfirmError(null);
                    const result = await segmentConfirmAction(target.id);
                    if (result.error) setConfirmError(result.error);
                    router.refresh();
                  });
                }}
              />
            ) : undefined
          }
        />
      ))}

      <Card padding={4}>
        <DayTimeline
          segments={props.segments}
          date={props.date}
          isToday={props.isToday}
          nowMin={props.nowMin}
          onSegmentClick={props.canEdit ? (s) => openEditor(s) : undefined}
          onSegmentResize={props.canEdit ? onSegmentResize : undefined}
          hourPx={40}
        />
      </Card>

      <EntryList segments={props.segments} canEdit={props.canEdit} onEdit={openEditor} />

      {/* A running day is framed forward ("noch …"), never as a deficit —
          the signed delta appears only once the day is over or Soll is met.
          An unfinished past day gets no delta at all: its hours are unknown. */}
      {props.sollMin > 0 && props.segments.length > 0 && (
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {hasUnfinished && !props.isToday ? (
            <>Ohne Ende keine Differenz berechenbar – dieser Tag zählt noch nicht für das Zeitkonto.</>
          ) : props.isToday && diff < 0 ? (
            <>noch {fmtDuration(-diff)} Std. bis zum Soll</>
          ) : (
            <>
              Differenz zum Soll:{' '}
              <span style={{color: diff >= 0 ? 'var(--color-text-accent)' : 'var(--color-text-secondary)'}}>
                {diff >= 0 ? '+' : ''}
                {fmtDuration(diff)} Std.
              </span>
            </>
          )}
        </Text>
      )}

      {/* Fix several days in a row without going back to the list. */}
      {props.nextIssue && (
        <HStack gap={2} vAlign="center">
          <Link href={props.nextIssue.href} style={{textDecoration: 'none'}}>
            <Button label={`Nächster offener Tag: ${fmtDate(props.nextIssue.date)}`} variant="secondary" size="sm" />
          </Link>
        </HStack>
      )}

      <SegmentEditor
        isOpen={isEditorOpen}
        onOpenChange={setEditorOpen}
        userId={props.userId}
        date={props.date}
        segment={editing}
      />
    </VStack>
  );
}
