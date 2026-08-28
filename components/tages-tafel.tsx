'use client';

import {Banner, Button, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {useRouter} from 'next/navigation';
import {useEffect, useMemo, useState, useTransition} from 'react';
import {segmentConfirmAction, segmentResizeAction, segmentSaveAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import type {Issue} from '@/lib/attention';
import type {DayTypeKind} from '@/lib/db';
import {fmtDate, fmtDateLong, fmtDuration, fmtTime, type Span, type TimelineSegment} from '@/lib/format';
import {AddEntryButton} from './add-entry-button';
import {BelegListe} from './beleg-liste';
import {useMelde} from './melde';
import {SegmentEditor} from './segment-editor';
import {Sinnbild} from './sinnbilder';
import {Tagesbahn} from './tagesbahn';

interface TagesTafelProps {
  userId: number;
  date: string;
  isToday: boolean;
  nowMin: number;
  segments: TimelineSegment[];
  span: Span;
  workedMin: number;
  pauseMin: number;
  sollMin: number;
  canEdit: boolean;
  lockedNote?: string;
  dayType?: DayTypeKind | null;
  dayTypeLabel?: string | null;
  issues?: Issue[];
  plan?: {startMin: number; endMin: number} | null;
  feierabendMin?: number | null;
  /**
   * `voll` names the day and summarises it; `aktionen` shows only the day's own
   * controls, for when the frame's Kopf already names it.
   */
  kopf?: 'voll' | 'aktionen';
  /** `raster` when a surrounding stack already labels the shared hour axis. */
  achse?: 'voll' | 'raster';
  /** The next day needing correction, so several can be fixed in a row. */
  nextIssue?: {date: string; href: string} | null;
  /**
   * Link zum Spesen-Editor für diesen Tag. Null, wenn der Tag nichts zu
   * verreisen hat oder bereits zu einer erfassten Reise gehört.
   */
  spesenHref?: string | null;
}

/**
 * One day at working scale: the lane you can draw and drag on, the entries as
 * rows beneath it, and everything this day needs. The same component serves
 * the Tag range, a day opened inside the Woche/Monat stack, and the manager's
 * view of an employee — so a day looks and behaves identically everywhere.
 */
export function TagesTafel(props: TagesTafelProps) {
  const [editing, setEditing] = useState<TimelineSegment | null>(null);
  const [isEditorOpen, setEditorOpen] = useState(false);
  const melde = useMelde();
  const [, startTransition] = useTransition();
  const [isConfirming, startConfirm] = useTransition();
  const router = useRouter();

  /**
   * Was gerade gezeichnet wurde, bevor der Server es bestätigt hat.
   *
   * Ohne das verschwand die aufgezogene Strecke im Augenblick des Loslassens
   * und kam eine Serverrunde später als Block zurück: die Bahn stand für einen
   * Moment wieder leer da, und wer schnell war, zog dieselbe Zeit ein zweites
   * Mal auf. Der Entwurf trägt eine negative Kennung — dieselbe Vereinbarung,
   * die `openEditor` schon kennt: nicht anklickbar, nicht zu ziehen, bis er
   * eine echte Kennung hat.
   */
  const [entwurf, setEntwurf] = useState<TimelineSegment | null>(null);

  // Die Serverantwort löst den Entwurf ab — auch dann, wenn sie ihn abgelehnt
  // hat: dann steht die Bahn wieder auf dem Stand, der wirklich gilt.
  useEffect(() => setEntwurf(null), [props.segments]);

  const segments = useMemo(
    () => (entwurf ? [...props.segments, entwurf].sort((a, b) => a.start_min - b.start_min) : props.segments),
    [props.segments, entwurf],
  );

  const openEditor = (segment: TimelineSegment | null) => {
    if (segment && segment.id < 0) return; // optimistic placeholder, not yet saved
    setEditing(segment);
    setEditorOpen(true);
  };

  const onResize = (segment: TimelineSegment, startMin: number, endMin: number) => {
    startTransition(async () => {
      const result = await sicher(segmentResizeAction)(segment.id, startMin, endMin);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      router.refresh();
    });
  };

  /** Drawing a stretch on the lane records it straight away, as Arbeit — the
      common case. The row it produces is one click from any correction. */
  const onCreate = (startMin: number, endMin: number) => {
    setEntwurf({
      id: -Date.now(),
      date: props.date,
      kind: 'arbeit',
      start_min: startMin,
      end_min: endMin,
    });
    startTransition(async () => {
      const form = new FormData();
      form.set('userId', String(props.userId));
      form.set('date', props.date);
      form.set('kind', 'arbeit');
      form.set('start', fmtTime(startMin));
      form.set('end', fmtTime(endMin));
      const result = await sicher(segmentSaveAction)({error: null}, form);
      if (result.error) {
        setEntwurf(null);
        melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      }
      router.refresh();
    });
  };

  const diff = props.workedMin - props.sollMin;
  const hasUnfinished = props.segments.some((s) => s.end_min === null);

  return (
    <VStack gap={4}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        {props.kopf === 'voll' ? (
          <VStack gap={0.5}>
            <Heading level={2}>{fmtDateLong(props.date)}</Heading>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {fmtDuration(props.workedMin)} Std. gearbeitet · {fmtDuration(props.pauseMin)} Std. Pause
              {props.sollMin > 0 && <> · Soll {fmtDuration(props.sollMin)}</>}
            </Text>
          </VStack>
        ) : (
          <span />
        )}
        <HStack gap={2} vAlign="center" wrap="wrap">
          {/* Wo früher eine Klappliste mit sechs Wörtern stand, steht jetzt der
              Weg zur Abwesenheit dieses Tages. Die Tagesart wird hier nicht mehr
              gesetzt: sie ist die Projektion einer Spanne, und niemand nimmt
              einen einzelnen Tag frei, ohne zu wissen, ob es zwei werden. Was
              der Tag *ist*, sagt er weiterhin — als Angabe, nicht als Menü. */}
          {/* Die Tagesart selbst steht schon als Marke im Kopf des Zeitraums —
              hier stünde sie ein zweites Mal auf demselben Blatt. Der Knopf
              sagt sie ohnehin mit: „ändern" gibt es nur, wo etwas ist.
              Und er heißt, wie dieselbe Handlung auf /abwesenheit heißt —
              eine Handlung, ein Name. */}
          {props.canEdit && (
            <Link href={`/abwesenheit?von=${props.date}&bis=${props.date}`} style={{textDecoration: 'none'}}>
              <Button
                label={props.dayTypeLabel ? 'Abwesenheit ändern' : 'Abwesenheit erfassen'}
                variant="secondary"
                size="sm"
                icon={<Sinnbild sinn="abwesenheit" />}
              />
            </Link>
          )}
          {/* Der kürzeste Weg von einem auswärts verbrachten Tag zu seiner
              Abrechnung: der Editor öffnet sich mit diesem Datum und bietet die
              Stempelzeiten als Abwesenheit an. */}
          {props.spesenHref && (
            <Link href={props.spesenHref} style={{textDecoration: 'none'}}>
              {/* Dasselbe Zeichen wie „Reisen & Spesen" in der Navigation —
                  der Knopf zeigt, wohin er führt. */}
              <Button
                label="Als Dienstreise abrechnen"
                variant="secondary"
                size="sm"
                icon={<Sinnbild sinn="reise" />}
              />
            </Link>
          )}
          {props.canEdit && <AddEntryButton onClick={() => openEditor(null)} />}
        </HStack>
      </HStack>

      {props.lockedNote && <Banner status="info" title={props.lockedNote} />}

      {props.issues?.map((issue) => (
        <Banner
          key={issue.kind}
          status={issue.needsCorrection ? 'warning' : 'info'}
          title={issue.message}
          description={
            issue.kind === 'unbestaetigt'
              ? 'Die Endzeit wurde automatisch gesetzt. Stimmt sie, bestätige den Eintrag – sonst korrigiere ihn.'
              : issue.needsCorrection
                ? undefined
                : 'Der Eintrag bleibt wie erfasst. Ergänze bei Bedarf eine Notiz mit dem Grund.'
          }
          endContent={
            issue.kind === 'unbestaetigt' && props.canEdit ? (
              <Button
                label="Zeiten bestätigen"
                variant="secondary"
                size="sm"
                isLoading={isConfirming}
                icon={<Sinnbild sinn="bestaetigen" />}
                onClick={() => {
                  const target = props.segments.find((s) => s.auto_closed === 1);
                  if (!target) return;
                  startConfirm(async () => {
                    const result = await sicher(segmentConfirmAction)(target.id);
                    if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
                    router.refresh();
                  });
                }}
              />
            ) : undefined
          }
        />
      ))}

      <VStack paddingBlock={2}>
        <Tagesbahn
          date={props.date}
          segments={segments}
          isToday={props.isToday}
          nowMin={props.nowMin}
          span={props.span}
          groesse="buehne"
          achse={props.achse ?? 'voll'}
          plan={props.plan}
          feierabendMin={props.feierabendMin}
          onSegmentClick={props.canEdit ? openEditor : undefined}
          onSegmentResize={props.canEdit ? onResize : undefined}
          onCreate={props.canEdit ? onCreate : undefined}
        />
      </VStack>

      <BelegListe
        segments={segments}
        canEdit={props.canEdit}
        onEdit={openEditor}
        isToday={props.isToday}
        leerText={
          props.canEdit
            ? props.isToday
              ? 'Noch keine Zeiten heute. „Einstempeln“ in der Stempelleiste startet den Tag, oder ziehe die Zeit direkt auf der Zeitleiste auf.'
              : 'Keine Zeiten an diesem Tag. Ziehe die Zeit auf der Zeitleiste auf oder nutze „Eintrag hinzufügen“.'
            : 'Keine Zeiten an diesem Tag.'
        }
      />

      {/* A running day is framed forward ("noch …"), never as a deficit — the
          signed delta appears only once the day is over or the Soll is met.
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

      {props.nextIssue && (
        <HStack gap={2} vAlign="center">
          <Link href={props.nextIssue.href} style={{textDecoration: 'none'}}>
            <Button
              label={`Nächster offener Tag: ${fmtDate(props.nextIssue.date)}`}
              variant="secondary"
              size="sm"
              icon={<Sinnbild sinn="hin" />}
            />
          </Link>
        </HStack>
      )}

      <SegmentEditor
        isOpen={isEditorOpen}
        onOpenChange={setEditorOpen}
        userId={props.userId}
        date={editing?.date ?? props.date}
        segment={editing}
        tagesSegmente={segments}
        nowMin={props.isToday ? props.nowMin : null}
      />
    </VStack>
  );
}
