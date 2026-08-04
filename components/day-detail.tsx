'use client';

import {Banner, Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {segmentResizeAction} from '@/app/actions';
import {fmtDateLong, fmtDuration} from '@/lib/format';
import {AddEntryButton} from './add-entry-button';
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
}

/**
 * One day, fully inspectable: the timeline plus the entry list with inline
 * corrections. Shared between "Meine Zeiten" and the manager's team view.
 */
export function DayDetail(props: DayDetailProps) {
  const [editing, setEditing] = useState<TimelineSegment | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [resizeError, setResizeError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
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
        {props.canEdit && <AddEntryButton onClick={() => openEditor(null)} />}
      </HStack>

      {props.lockedNote && <Banner status="info" title={props.lockedNote} />}
      {resizeError && <Banner status="error" title={resizeError} />}

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
          the signed delta appears only once the day is over or Soll is met. */}
      {props.sollMin > 0 && props.segments.length > 0 && (
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {props.isToday && diff < 0 ? (
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
