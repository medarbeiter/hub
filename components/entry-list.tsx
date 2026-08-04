'use client';

import {Badge, Button, Card, Divider, HStack, Text, VStack} from '@astryxdesign/core';
import {fmtDuration, fmtTime} from '@/lib/format';
import type {TimelineSegment} from './day-timeline';

interface EntryListProps {
  segments: TimelineSegment[];
  canEdit: boolean;
  onEdit: (segment: TimelineSegment) => void;
}

/** The day's entries as dense rows: time range, Art, duration, note, edit. */
export function EntryList({segments, canEdit, onEdit}: EntryListProps) {
  if (segments.length === 0) return null;
  return (
    <Card padding={0}>
      <VStack gap={0}>
        {segments.map((s, i) => {
          const isOpen = s.end_min === null;
          return (
            <VStack key={s.id} gap={0}>
              {i > 0 && <Divider />}
              <HStack gap={3} vAlign="center" paddingInline={4} paddingBlock={2}>
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
                {s.note && (
                  <Text type="supporting" color="secondary" maxLines={1}>
                    {s.note}
                  </Text>
                )}
                <span style={{marginInlineStart: 'auto'}}>
                  {canEdit && s.id > 0 && (
                    <Button label="Bearbeiten" variant="ghost" size="sm" onClick={() => onEdit(s)} />
                  )}
                </span>
              </HStack>
            </VStack>
          );
        })}
      </VStack>
    </Card>
  );
}
