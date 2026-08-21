'use client';

import {
  Banner,
  Button,
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
import {sicher, sicheresFormular} from '@/lib/aktion';
import {fmtDateLong, fmtDuration, fmtTime, isoToMin, type TimelineSegment} from '@/lib/format';
import {fmtSpanne, pausenSchnitte, schnittVerlust, type PausenSchnitt} from '@/lib/pausenschnitt';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

interface SegmentEditorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userId: number;
  date: string;
  /** Existing segment to correct, or null to record a new one. */
  segment: TimelineSegment | null;
  /** The day's other entries — for the prefill and the overlap check. */
  tagesSegmente?: TimelineSegment[];
  /** Minutes-from-midnight if this day is today, otherwise null. */
  nowMin?: number | null;
}

const INITIAL: ActionState = {error: null};
const SNAP = 5;

/** Was der Schnitt mit dem Tag macht, in einem Satz. */
function schnittSatz(schnitte: PausenSchnitt[], offenesEnde: number): string {
  const erster = schnitte[0]!;
  const teile =
    schnitte.length > 1
      ? `${schnitte.length} Arbeitseinträge werden dabei gekürzt.`
      : erster.reste.length > 0
        ? `Aus ${fmtSpanne(erster.vorher)} werden ${erster.reste.map(fmtSpanne).join(' und ')}.`
        : `Der Eintrag ${fmtSpanne(erster.vorher)} entfällt dadurch ganz.`;
  return `${teile} Die Arbeitszeit an diesem Tag sinkt um ${fmtDuration(schnittVerlust(schnitte, offenesEnde))} Std.`;
}

/**
 * Where the day is filled in by hand: correcting one entry, or recording one
 * the clock never saw. The lane above is the faster path for the common case;
 * this dialog is the precise one, and the only one a keyboard can reach.
 */
export function SegmentEditor({
  isOpen,
  onOpenChange,
  userId,
  date,
  segment,
  tagesSegmente = [],
  nowMin = null,
}: SegmentEditorProps) {
  /**
   * A new entry opens where the day left off: after the last entry, or at the
   * usual start of a day. The end is only prefilled while the day is running —
   * guessing an end for a past day would invent hours, not save typing.
   */
  const vorschlag = () => {
    const enden = tagesSegmente.map((s) => s.end_min ?? s.start_min);
    const beginn = enden.length > 0 ? Math.max(...enden) : 8 * 60;
    const jetzt = nowMin != null ? Math.floor(nowMin / SNAP) * SNAP : null;
    return {
      start: fmtTime(Math.min(beginn, 1440 - SNAP)),
      end: jetzt != null && jetzt > beginn ? fmtTime(jetzt) : '',
    };
  };

  const [kind, setKind] = useState<string>(segment?.kind ?? 'arbeit');
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [note, setNote] = useState<string>(segment?.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [state, formAction, isSaving] = useActionState(sicheresFormular(segmentSaveAction), INITIAL);
  const lastState = useRef(state);

  // Re-sync when a different entry (or a fresh one) is opened.
  useEffect(() => {
    if (!isOpen) return;
    setKind(segment?.kind ?? 'arbeit');
    if (segment) {
      setStart(fmtTime(segment.start_min));
      setEnd(segment.end_min != null ? fmtTime(segment.end_min) : '');
    } else {
      const v = vorschlag();
      setStart(v.start);
      setEnd(v.end);
    }
    setNote(segment?.note ?? '');
    setConfirmDelete(false);
    setDeleteError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segment, isOpen]);

  // Close after a successful save.
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null && isOpen) onOpenChange(false);
    }
  }, [state, isOpen, onOpenChange]);

  const startMin = isoToMin(start);
  const endMin = isoToMin(end);

  /**
   * The same rules the server enforces, said early. The server check stays
   * authoritative — this only spares the round trip and names the conflict.
   * A Pause over Arbeit is not one: it is the cut (lib/pausenschnitt.ts), and
   * gets a warning that says what will happen instead of a block that says
   * what may not.
   */
  const hinweis = (): {ton: 'fehler' | 'warnung'; text: string} | null => {
    if (startMin === null || endMin === null) return null;
    if (endMin <= startMin) return {ton: 'fehler', text: 'Das Ende muss nach dem Beginn liegen.'};
    const offen = nowMin ?? 1440;
    for (const other of tagesSegmente) {
      if (other.id === segment?.id || other.id < 0) continue;
      if (kind === 'pause' && other.kind === 'arbeit') continue;
      const otherEnd = other.end_min ?? offen;
      if (startMin < otherEnd && other.start_min < endMin) {
        return {
          ton: 'fehler',
          text: `Überschneidung mit ${fmtTime(other.start_min)}–${
            other.end_min === null ? 'offen' : fmtTime(other.end_min)
          }.`,
        };
      }
    }
    const schnitte = pausenSchnitte(
      tagesSegmente,
      {kind: kind as 'arbeit' | 'pause', startMin, endMin},
      offen,
      segment?.id,
    );
    if (schnitte.length === 0) return null;
    return {ton: 'warnung', text: schnittSatz(schnitte, offen)};
  };

  const konflikt = hinweis();
  const dauer = startMin !== null && endMin !== null && endMin > startMin ? endMin - startMin : null;
  const isOpenSegment = segment != null && segment.end_min === null;

  return (
    <TafelDialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={440}>
      <DialogHeader title={segment ? 'Eintrag korrigieren' : 'Eintrag hinzufügen'} subtitle={fmtDateLong(date)} />
      <form action={formAction}>
        <VStack gap={4} padding={4}>
          {isOpenSegment && (
            <Banner
              status="warning"
              title="Offener Eintrag"
              description="Dieser Eintrag wurde nie beendet. Trage das tatsächliche Ende ein, um ihn zu korrigieren."
            />
          )}
          {konflikt?.ton === 'warnung' && (
            <Banner
              status="warning"
              title="Die Pause wird aus der Arbeitszeit herausgeschnitten"
              description={konflikt.text}
            />
          )}
          {state.error && <Banner status="error" title={state.error} />}
          {deleteError && <Banner status="error" title={deleteError} />}

          <SegmentedControl label="Art des Eintrags" value={kind} onChange={setKind} layout="fill">
            <SegmentedControlItem value="arbeit" label="Arbeit" icon={<Sinnbild sinn="arbeit" />} />
            <SegmentedControlItem value="pause" label="Pause" icon={<Sinnbild sinn="pause" />} />
          </SegmentedControl>

          <VStack gap={1.5}>
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
            {/* The number the entry is actually about, while it is being typed. */}
            <HStack justify="between" gap={2} vAlign="center">
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {dauer !== null
                  ? `Ergibt ${fmtDuration(dauer)} Std. ${kind === 'arbeit' ? 'Arbeitszeit' : 'Pause'}.`
                  : 'Beginn und Ende im Format HH:MM.'}
              </Text>
              {konflikt?.ton === 'fehler' && (
                <Text type="supporting" color="inherit">
                  <span style={{color: 'var(--color-error)'}}>{konflikt.text}</span>
                </Text>
              )}
            </HStack>
          </VStack>

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
                    icon={<Sinnbild sinn="entfernen" />}
                    onClick={() =>
                      startDelete(async () => {
                        const result = await sicher(segmentDeleteAction)(segment.id);
                        if (result.error) setDeleteError(result.error);
                        else onOpenChange(false);
                      })
                    }
                  />
                </HStack>
              ) : (
                <Button
                  label="Eintrag löschen"
                  variant="ghost"
                  size="sm"
                  /* Siehe reise-tafel.tsx: der Weg ins Löschen trägt die
                     Fehlerfarbe, die Bestätigung die volle Fläche. */
                  style={{color: 'var(--color-error)'}}
                  icon={<Sinnbild sinn="entfernen" />}
                  onClick={() => setConfirmDelete(true)}
                />
              )
            ) : (
              <span />
            )}
            <HStack gap={2}>
              <Button label="Abbrechen" variant="secondary" onClick={() => onOpenChange(false)} />
              <Button
                label="Speichern"
                variant="primary"
                type="submit"
                isLoading={isSaving}
                isDisabled={konflikt?.ton === 'fehler'}
              />
            </HStack>
          </HStack>
        </VStack>
      </form>
    </TafelDialog>
  );
}
