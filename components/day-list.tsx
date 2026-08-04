import {Card, StackItem, StatusDot, Text, VStack, HStack} from '@astryxdesign/core';
import Link from 'next/link';
import {fmtDuration, fmtWeekdayShort} from '@/lib/format';
import {MiniTimeline} from './mini-timeline';
import type {SegmentLike} from '@/lib/format';

export interface DayListDay {
  date: string;
  segments: Array<SegmentLike & {id: number}>;
  summary: {workedMin: number; pauseMin: number; hasOpen: boolean};
  sollMin: number;
}

interface DayListProps {
  days: DayListDay[];
  selectedDate: string;
  today: string;
  nowMin: number;
  hrefFor: (date: string) => string;
  emptyText: string;
}

/**
 * The scannable day list: weekday, mini timeline, worked total. Shared by the
 * Woche and Monat views; each row links to its day's detail.
 */
export function DayList({days, selectedDate, today, nowMin, hrefFor, emptyText}: DayListProps) {
  return (
    <Card padding={0}>
      <VStack gap={0}>
        {days.map((d) => {
          const isSelected = d.date === selectedDate;
          const isToday = d.date === today;
          const diff = d.summary.workedMin - d.sollMin;
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
                <span style={{inlineSize: 88, flexShrink: 0, textAlign: 'end'}}>
                  {d.summary.hasOpen && !isToday ? (
                    <StatusDot variant="warning" label="Offener Eintrag" />
                  ) : d.segments.length > 0 ? (
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
