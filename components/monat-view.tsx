import {Badge, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import type {User} from '@/lib/db';
import {addDays, fmtDuration, mondayOf, monthOf, nowMinutes, todayISO} from '@/lib/format';
import {isMonthLocked, monthRecord, weekRecords} from '@/lib/time';
import {DayDetail} from './day-detail';
import {DayList} from './day-list';
import {MonthSwitcher} from './month-switcher';
import {PeriodSwitcher} from './period-switcher';
import {WeekSwitcher} from './week-switcher';

const LOCKED_NOTE = 'Dieser Monat ist abgeschlossen. Änderungen sind nur über die Verwaltung möglich.';

const EMPTY_DAY = (date: string) => ({
  date,
  segments: [],
  summary: {workedMin: 0, pauseMin: 0, hasOpen: false},
  sollMin: 0,
});

/** The Monat view of "Meine Zeit": month day list + full day detail. */
export function MonatView({user, month, requestedDay}: {user: User; month: string; requestedDay: string | null}) {
  const today = todayISO();
  const record = monthRecord(user, month);
  const nowMin = nowMinutes();

  const days = [...record.days].reverse().filter((d) => d.segments.length > 0 || d.sollMin > 0);
  const selectedDate =
    requestedDay && requestedDay.startsWith(month)
      ? requestedDay
      : month === monthOf(today)
        ? today
        : (days[0]?.date ?? `${month}-01`);
  const selected = record.days.find((d) => d.date === selectedDate) ?? EMPTY_DAY(selectedDate);

  // The month saldo of a running month is only meaningful up to yesterday —
  // today's unfinished hours would read as a deficit every morning.
  const isCurrentMonth = month === monthOf(today);
  const completeRecorded = record.days.filter((d) => d.segments.length > 0 && (!isCurrentMonth || d.date < today));
  const saldoMin = completeRecorded.reduce((sum, d) => sum + d.summary.workedMin - d.sollMin, 0);

  return (
    <VStack gap={5} padding={5}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Meine Zeit</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtDuration(record.workedMin)} Std. erfasst · Soll {fmtDuration(record.sollMin)} ·{' '}
            {saldoMin >= 0 ? '+' : ''}
            {fmtDuration(saldoMin)} Std.
            {isCurrentMonth ? ' bis gestern' : ''}
          </Text>
        </VStack>
        <HStack gap={3} vAlign="center">
          {record.locked && <Badge variant="info" label="Monat abgeschlossen" />}
          <MonthSwitcher basePath="/" month={month} params={{ansicht: 'monat'}} />
        </HStack>
      </HStack>

      <PeriodSwitcher ansicht="monat" tag={selectedDate} monat={month} />

      <HStack gap={5} wrap="wrap" align="start">
        <VStack gap={0} width={400}>
          <DayList
            days={days}
            selectedDate={selectedDate}
            today={today}
            nowMin={nowMin}
            hrefFor={(date) => `/?ansicht=monat&monat=${month}&tag=${date}`}
            emptyText="Keine Zeiten in diesem Monat."
          />
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
            lockedNote={record.locked ? LOCKED_NOTE : undefined}
          />
        </StackItem>
      </HStack>
    </VStack>
  );
}

/** The Woche view: the Mo–So week around `anchor`, same list + detail shell. */
export function WocheView({user, anchor, requestedDay}: {user: User; anchor: string; requestedDay: string | null}) {
  const today = todayISO();
  const nowMin = nowMinutes();
  const monday = mondayOf(anchor);
  const week = weekRecords(user, monday);
  const visible = week.filter((d) => d.date <= today);
  const selectedDate =
    requestedDay && visible.some((d) => d.date === requestedDay)
      ? requestedDay
      : visible.some((d) => d.date === today)
        ? today
        : (visible[visible.length - 1]?.date ?? monday);
  const selected = week.find((d) => d.date === selectedDate) ?? EMPTY_DAY(selectedDate);

  const workedMin = visible.reduce((sum, d) => sum + d.summary.workedMin, 0);
  const sollMin = visible.reduce((sum, d) => sum + d.sollMin, 0);
  const weekOver = addDays(monday, 6) < today;
  const saldoMin = workedMin - sollMin;
  const locked = isMonthLocked(user.id, monthOf(selected.date));

  return (
    <VStack gap={5} padding={5}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Meine Zeit</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtDuration(workedMin)} Std. erfasst · Soll {fmtDuration(sollMin)}
            {weekOver && (
              <>
                {' · '}
                {saldoMin >= 0 ? '+' : ''}
                {fmtDuration(saldoMin)} Std.
              </>
            )}
          </Text>
        </VStack>
        <WeekSwitcher anchor={monday} />
      </HStack>

      <PeriodSwitcher ansicht="woche" tag={selectedDate} />

      <HStack gap={5} wrap="wrap" align="start">
        <VStack gap={0} width={400}>
          <DayList
            days={visible}
            selectedDate={selectedDate}
            today={today}
            nowMin={nowMin}
            hrefFor={(date) => `/?ansicht=woche&tag=${date}`}
            emptyText="Keine Zeiten in dieser Woche."
          />
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
            canEdit={!locked}
            lockedNote={locked ? LOCKED_NOTE : undefined}
          />
        </StackItem>
      </HStack>
    </VStack>
  );
}
