import {Badge, Card, StackItem, StatusDot, Text, VStack, HStack} from '@astryxdesign/core';
import Link from 'next/link';
import {fmtDuration, fmtWeekdayShort} from '@/lib/format';
import {MiniTimeline} from './mini-timeline';
import type {SegmentLike} from '@/lib/format';
import type {Issue, IssueKind} from '@/lib/attention';

export interface DayListDay {
  date: string;
  segments: Array<SegmentLike & {id: number}>;
  summary: {workedMin: number; pauseMin: number; hasOpen: boolean};
  sollMin: number;
  dayType?: string | null;
  dayTypeLabel?: string | null;
}

interface DayListProps {
  days: DayListDay[];
  selectedDate: string;
  today: string;
  nowMin: number;
  hrefFor: (date: string) => string;
  emptyText: string;
  /** What each day needs, so gaps are as visible as entries. */
  issuesByDate?: Map<string, Issue[]>;
}

/** Column-width labels for the days that cannot be counted as they stand. */
const SHORT_LABEL: Partial<Record<IssueKind, string>> = {
  offen: 'Offen',
  fehlt: 'Fehlt',
  unbestaetigt: 'Prüfen',
  unplausibel: 'Prüfen',
};

/**
 * The scannable day list: weekday, mini timeline, worked total. Shared by the
 * Woche and Monat views; each row links to its day's detail.
 */
export function DayList({days, selectedDate, today, nowMin, hrefFor, emptyText, issuesByDate}: DayListProps) {
  return (
    <Card padding={0}>
      <VStack gap={0}>
        {days.map((d) => {
          const isSelected = d.date === selectedDate;
          const isToday = d.date === today;
          const diff = d.summary.workedMin - d.sollMin;
          const issues = issuesByDate?.get(d.date) ?? [];
          const blocking = issues.find((i) => i.needsCorrection);
          const advisory = !blocking && issues.length > 0 ? issues[0] : null;
          return (
            <Link
              key={d.date}
              href={hrefFor(d.date)}
              className="zeile-interaktiv"
              style={{
                textDecoration: 'none',
                color: 'inherit',
                display: 'block',
                background: isSelected ? 'var(--color-accent-muted)' : 'transparent',
                boxShadow: isSelected ? 'inset 3px 0 0 var(--color-accent)' : 'none',
                borderBlockEnd: 'var(--border-width) solid var(--color-border)',
              }}
            >
              <HStack gap={3} vAlign="center" paddingInline={4} paddingBlock={2}>
                <span style={{inlineSize: 64, flexShrink: 0}}>
                  <Text type="label" weight={isToday ? 'semibold' : 'normal'} color={isToday ? 'accent' : 'primary'}>
                    {fmtWeekdayShort(d.date)} {Number(d.date.slice(8))}.
                  </Text>
                </span>
                <StackItem size="fill">
                  <MiniTimeline segments={d.segments} isToday={isToday} nowMin={nowMin} height={12} />
                </StackItem>
                <span style={{inlineSize: 104, flexShrink: 0, textAlign: 'end'}}>
                  {blocking ? (
                    <Badge variant="warning" label={SHORT_LABEL[blocking.kind] ?? 'Prüfen'} />
                  ) : d.dayType && d.segments.length === 0 ? (
                    <Badge variant="neutral" label={d.dayTypeLabel ?? 'Abwesend'} />
                  ) : d.segments.length > 0 ? (
                    <HStack gap={2} vAlign="center" justify="end">
                      {advisory && <StatusDot variant="warning" label={advisory.message} />}
                      <Text type="supporting" color="secondary" hasTabularNumbers>
                        {fmtDuration(d.summary.workedMin)}
                        {/* Running day: no signed deficit until Soll is met or the day is over. */}
                        {(!isToday || diff >= 0) && (
                          <>
                            {' '}
                            <span style={{color: diff >= 0 ? 'var(--color-text-accent)' : 'inherit'}}>
                              ({diff >= 0 ? '+' : ''}
                              {fmtDuration(diff)})
                            </span>
                          </>
                        )}
                      </Text>
                    </HStack>
                  ) : (
                    <Text type="supporting" color="disabled">
                      –
                    </Text>
                  )}
                </span>
              </HStack>
            </Link>
          );
        })}
        {days.length === 0 && (
          <VStack padding={5} hAlign="center">
            <Text type="body" color="secondary">
              {emptyText}
            </Text>
          </VStack>
        )}
      </VStack>
    </Card>
  );
}
