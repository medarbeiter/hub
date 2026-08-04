import {Badge, Card, Heading, HStack, StackItem, StatusDot, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {monthOf, nowMinutes, todayISO} from '@/lib/format';
import {fmtDuration, fmtWeekdayShort} from '@/lib/format';
import {monthRecord} from '@/lib/time';
import {DayDetail} from '@/components/day-detail';
import {MiniTimeline} from '@/components/mini-timeline';
import {MonthSwitcher} from '@/components/month-switcher';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{monat?: string; tag?: string}>;
}

export default async function ZeitenPage({searchParams}: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : monthOf(today);
  const record = monthRecord(user, month);
  const nowMin = nowMinutes();

  const days = [...record.days].reverse();
  const visibleDays = days.filter((d) => d.segments.length > 0 || d.sollMin > 0);
  const requestedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.tag ?? '') ? params.tag! : null;
  const selectedDate =
    requestedDay && requestedDay.startsWith(month)
      ? requestedDay
      : month === monthOf(today)
        ? today
        : (visibleDays[0]?.date ?? `${month}-01`);
  const selected = record.days.find((d) => d.date === selectedDate) ?? {
    date: selectedDate,
    segments: [],
    summary: {workedMin: 0, pauseMin: 0, hasOpen: false},
    sollMin: 0,
  };

  const diffMin = record.workedMin - record.sollMin;

  return (
    <VStack gap={5} padding={5}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Meine Zeiten</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtDuration(record.workedMin)} Std. erfasst · Soll {fmtDuration(record.sollMin)} ·{' '}
            {diffMin >= 0 ? '+' : ''}
            {fmtDuration(diffMin)} Std.
          </Text>
        </VStack>
        <HStack gap={3} vAlign="center">
          {record.locked && <Badge variant="info" label="Monat abgeschlossen" />}
          <MonthSwitcher basePath="/zeiten" month={month} />
        </HStack>
      </HStack>

      <HStack gap={5} wrap="wrap" align="start">
        <VStack gap={0} width={400}>
          <Card padding={0}>
            <VStack gap={0}>
              {visibleDays.map((d) => {
                const isSelected = d.date === selectedDate;
                const isToday = d.date === today;
                const diff = d.summary.workedMin - d.sollMin;
                return (
                  <Link
                    key={d.date}
                    href={`/zeiten?monat=${month}&tag=${d.date}`}
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
              {visibleDays.length === 0 && (
                <VStack padding={5} hAlign="center">
                  <Text type="body" color="secondary">
                    Keine Zeiten in diesem Monat.
                  </Text>
                </VStack>
              )}
            </VStack>
          </Card>
        </VStack>

        <StackItem size="fill">
          <DayDetail
            userId={user.id}
            date={selected.date}
            isToday={selected.date === today}
            nowMin={nowMin}
            segments={selected.segments}
            workedMin={selected.summary.workedMin}
            pauseMin={selected.summary.pauseMin}
            sollMin={selected.sollMin}
            canEdit={!record.locked}
            lockedNote={
              record.locked
                ? 'Dieser Monat ist abgeschlossen. Änderungen sind nur über die Verwaltung möglich.'
                : undefined
            }
          />
        </StackItem>
      </HStack>
    </VStack>
  );
}
