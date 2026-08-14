'use client';

import {Badge, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {fmtDuration, fmtTime, type TimelineSegment} from '@/lib/format';
import {Sinnbild} from './sinnbilder';

interface BelegListeProps {
  segments: TimelineSegment[];
  canEdit: boolean;
  onEdit: (segment: TimelineSegment) => void;
  /** A running entry today means "läuft"; on a past day it means "ohne Ende". */
  isToday?: boolean;
  /** Shown in place of the rows when there is nothing to list. */
  leerText?: string;
}

/**
 * The day's entries as dense rows on the page surface — the Belege band.
 * Deliberately not wrapped in a Card: a card around a single row is the
 * container doing the work the divider should do.
 */
export function BelegListe({segments, canEdit, onEdit, isToday = false, leerText}: BelegListeProps) {
  if (segments.length === 0) {
    return leerText ? (
      <HStack paddingBlock={4} paddingInline={1} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="uhrzeit" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          {leerText}
        </Text>
      </HStack>
    ) : null;
  }

  return (
    <VStack gap={0} role="list">
      <Divider />
      {segments.map((s) => {
        const offen = s.end_min === null;
        const label = `${s.kind === 'arbeit' ? 'Arbeit' : 'Pause'} ${fmtTime(s.start_min)}–${
          offen ? 'offen' : fmtTime(s.end_min!)
        }`;
        const zeile = (
          <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={3} wrap="wrap">
            <span style={{inlineSize: 108, flexShrink: 0}}>
              <Text type="body" hasTabularNumbers weight="medium">
                {fmtTime(s.start_min)}–{offen ? '…' : fmtTime(s.end_min!)}
              </Text>
            </span>
            <Badge
              variant={s.kind === 'arbeit' ? 'yellow' : 'neutral'}
              label={s.kind === 'arbeit' ? 'Arbeit' : 'Pause'}
              icon={<Sinnbild sinn={s.kind} groesse="zeile" />}
            />
            {/* "läuft" and "ohne Ende" are different states and must not look
                alike: one is today's clock still running, the other is a day
                that was never closed. Das gefüllte Zeichen gehört dem
                laufenden Eintrag, das Countdown-Zifferblatt dem, der nie
                geschlossen wurde. */}
            {offen ? (
              isToday ? (
                <Badge
                  variant="info"
                  label="läuft"
                  icon={<Sinnbild sinn="uhrzeit" groesse="zeile" />}
                />
              ) : (
                <Badge
                  variant="error"
                  label="ohne Ende"
                  icon={<Sinnbild sinn="ohneEnde" groesse="zeile" />}
                />
              )
            ) : (
              <Text type="supporting" color="secondary" hasTabularNumbers>
                {fmtDuration(s.end_min! - s.start_min)} Std.
              </Text>
            )}
            {s.auto_closed === 1 && (
              <Badge
                variant="warning"
                label="bitte bestätigen"
                icon={<Sinnbild sinn="warnung" groesse="zeile" />}
              />
            )}
            <StackItem size="fill">
              {s.note && (
                <Text type="supporting" color="secondary" maxLines={1}>
                  {s.note}
                </Text>
              )}
            </StackItem>
            {canEdit && s.id > 0 && (
              <Sinnbild sinn="bearbeiten" ton="sekundaer" className="zeitleiste-stift" />
            )}
          </HStack>
        );
        return (
          <VStack key={s.id} gap={0} role="listitem">
            {canEdit && s.id > 0 ? (
              <button
                type="button"
                className="eintrag-zeile zeitleiste-eintrag"
                aria-label={`${label} bearbeiten`}
                onClick={() => onEdit(s)}
              >
                {zeile}
              </button>
            ) : (
              zeile
            )}
            <Divider />
          </VStack>
        );
      })}
    </VStack>
  );
}
