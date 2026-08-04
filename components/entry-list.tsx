'use client';

import {Badge, Card, Divider, HStack, Text, VStack} from '@astryxdesign/core';
import {Pencil} from 'lucide-react';
import {fmtDuration, fmtTime} from '@/lib/format';
import type {TimelineSegment} from './day-timeline';

interface EntryListProps {
  segments: TimelineSegment[];
  canEdit: boolean;
  onEdit: (segment: TimelineSegment) => void;
}

/**
 * The day's entries as dense rows. The whole row is the edit affordance —
 * a comfortable touch target, and no separate button to overflow a phone.
 */
export function EntryList({segments, canEdit, onEdit}: EntryListProps) {
  if (segments.length === 0) return null;
  return (
    <Card padding={0}>
      <VStack gap={0}>
        {segments.map((s, i) => {
          const isOpen = s.end_min === null;
          const label = `${s.kind === 'arbeit' ? 'Arbeit' : 'Pause'} ${fmtTime(s.start_min)}–${
            isOpen ? 'offen' : fmtTime(s.end_min!)
          }`;
          const row = (
            <HStack gap={3} vAlign="center" paddingInline={4} paddingBlock={3} wrap="wrap">
              <span style={{inlineSize: 110, flexShrink: 0}}>
                <Text type="body" hasTabularNumbers weight="medium">
                  {fmtTime(s.start_min)}–{isOpen ? '…' : fmtTime(s.end_min!)}
                </Text>
              </span>
              <Badge
                variant={s.kind === 'arbeit' ? 'yellow' : 'neutral'}
                label={s.kind === 'arbeit' ? 'Arbeit' : 'Pause'}
              />
              {isOpen ? (
                <Badge variant="warning" label="offen" />
              ) : (
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {fmtDuration(s.end_min! - s.start_min)} Std.
                </Text>
              )}
              {s.auto_closed === 1 && <Badge variant="warning" label="automatisch beendet" />}
              {s.note && (
                <Text type="supporting" color="secondary" maxLines={1}>
                  {s.note}
                </Text>
              )}
              {canEdit && s.id > 0 && (
                <span style={{marginInlineStart: 'auto', display: 'flex', alignItems: 'center'}}>
                  <Pencil className="zeitleiste-stift" size={16} strokeWidth={2} aria-hidden />
                </span>
              )}
            </HStack>
          );
          return (
            <VStack key={s.id} gap={0}>
              {i > 0 && <Divider />}
              {canEdit && s.id > 0 ? (
                <button
                  type="button"
                  className="eintrag-zeile zeitleiste-eintrag"
                  aria-label={`${label} bearbeiten`}
                  onClick={() => onEdit(s)}
                >
                  {row}
                </button>
              ) : (
                row
              )}
            </VStack>
          );
        })}
      </VStack>
    </Card>
  );
}
