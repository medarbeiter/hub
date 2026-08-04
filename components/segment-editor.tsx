'use client';

import {
  Banner,
  Button,
  Dialog,
  DialogHeader,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Text,
  TextInput,
  TimeInput,
  VStack,
} from '@astryxdesign/core';
import {createISOTimeString} from '@astryxdesign/core/utils';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {segmentDeleteAction, segmentSaveAction, type ActionState} from '@/app/actions';
import {fmtDateLong, fmtTime} from '@/lib/format';
import type {TimelineSegment} from './day-timeline';

interface SegmentEditorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userId: number;
  date: string;
  /** Existing segment to correct, or null to create a new entry. */
  segment: TimelineSegment | null;
}

const INITIAL: ActionState = {error: null};

/**
 * Correction dialog: edits one segment in place (or records a new one).
 * An open (running/forgotten) segment requires an end time to be entered —
 * that is exactly how a forgotten clock-out gets fixed.
 */
export function SegmentEditor({isOpen, onOpenChange, userId, date, segment}: SegmentEditorProps) {
  const [kind, setKind] = useState<string>(segment?.kind ?? 'arbeit');
  const [start, setStart] = useState<string>(segment ? fmtTime(segment.start_min) : '');
  const [end, setEnd] = useState<string>(segment?.end_min != null ? fmtTime(segment.end_min) : '');
  const [note, setNote] = useState<string>(segment?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [state, formAction, isSaving] = useActionState(segmentSaveAction, INITIAL);
  const lastState = useRef(state);

  // Re-sync fields when a different segment is opened.
  useEffect(() => {
    setKind(segment?.kind ?? 'arbeit');
    setStart(segment ? fmtTime(segment.start_min) : '');
    setEnd(segment?.end_min != null ? fmtTime(segment.end_min) : '');
    setNote(segment?.note ?? '');
    setConfirmDelete(false);
    setDeleteError(null);
  }, [segment, isOpen]);

  // Close after a successful save.
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null && isOpen) onOpenChange(false);
    }
  }, [state, isOpen, onOpenChange]);

  const isOpenSegment = segment != null && segment.end_min === null;

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={420}>
      <DialogHeader
        title={segment ? 'Eintrag korrigieren' : 'Eintrag hinzufügen'}
        subtitle={fmtDateLong(date)}
      />
      <form action={formAction}>
        <VStack gap={4} padding={4}>
          {isOpenSegment && (
            <Banner
              status="warning"
              title="Offener Eintrag"
              description="Dieser Eintrag wurde nie beendet. Tragen Sie das tatsächliche Ende ein, um ihn zu korrigieren."
            />
          )}
          {state.error && <Banner status="error" title={state.error} />}
          {deleteError && <Banner status="error" title={deleteError} />}

          <SegmentedControl label="Art des Eintrags" value={kind} onChange={setKind} layout="fill">
            <SegmentedControlItem value="arbeit" label="Arbeit" />
            <SegmentedControlItem value="pause" label="Pause" />
          </SegmentedControl>

          <HStack gap={3}>
            <TimeInput
              label="Beginn"
              hourFormat="24h"
              value={start ? (createISOTimeString(start) ?? undefined) : undefined}
              onChange={(v) => setStart(v ?? '')}
              width="100%"
            />
            <TimeInput
              label="Ende"
              hourFormat="24h"
              value={end ? (createISOTimeString(end) ?? undefined) : undefined}
              onChange={(v) => setEnd(v ?? '')}
              width="100%"
            />
          </HStack>

          <TextInput
            label="Notiz"
            value={note}
            onChange={setNote}
            placeholder="z. B. Arzttermin, Dienstgang"
            htmlName="note"
          />

          <input type="hidden" name="segmentId" value={segment?.id ?? ''} />
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="start" value={start} />
          <input type="hidden" name="end" value={end} />

          <HStack gap={2} justify="between" vAlign="center">
            {segment ? (
              confirmDelete ? (
                <HStack gap={2} vAlign="center">
                  <Text type="supporting">Wirklich löschen?</Text>
                  <Button
                    label="Löschen"
                    variant="destructive"
                    size="sm"
                    isLoading={isDeleting}
                    onClick={() =>
                      startDelete(async () => {
                        const result = await segmentDeleteAction(segment.id);
                        if (result.error) setDeleteError(result.error);
                        else onOpenChange(false);
                      })
                    }
                  />
                </HStack>
              ) : (
                <Button label="Eintrag löschen" variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} />
              )
            ) : (
              <span />
            )}
            <HStack gap={2}>
              <Button label="Abbrechen" variant="secondary" onClick={() => onOpenChange(false)} />
              <Button label="Speichern" variant="primary" type="submit" isLoading={isSaving} />
            </HStack>
          </HStack>
        </VStack>
      </form>
    </Dialog>
  );
}
