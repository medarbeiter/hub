import {Badge, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import type {User} from '@/lib/db';
import {addDays, fmtDuration, mondayOf, monthOf, nowMinutes, todayISO} from '@/lib/format';
import {firstRecordedDate, isMonthLocked, monthRecord, weekRecords, type DayRecord} from '@/lib/time';
import {dayIssues, type Issue} from '@/lib/attention';
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
  dayType: null,
  dayTypeLabel: null,
});

/**
 * Issues per finished day in a loaded period, plus the correction queue that
 * drives "next open day". Today is excluded: a running day is not a defect.
 */
function periodIssues(days: DayRecord[], today: string, locked: boolean, since: string | null) {
  const byDate = new Map<string, Issue[]>();
  if (locked || !since) return {byDate, queue: [] as string[]};
  days.forEach((day, index) => {
    // Nothing before the employee's first record can be called missing.
    if (day.date >= today || day.date < since) return;
    const issues = dayIssues({
      date: day.date,
      segments: day.segments,
      prevSegments: days[index - 1]?.date === addDays(day.date, -1) ? days[index - 1]!.segments : undefined,
      sollMin: day.sollMin,
      dayType: day.dayType,
    });
    if (issues.length > 0) byDate.set(day.date, issues);
  });
  const queue = [...byDate.entries()]
    .filter(([, issues]) => issues.some((i) => i.needsCorrection))
    .map(([date]) => date)
    .sort((a, b) => b.localeCompare(a));
  return {byDate, queue};
}

/** The next day in the correction queue, resolved to a link on the server. */
function nextIssue(queue: string[], current: string, hrefFor: (date: string) => string) {
  const next = queue.find((d) => d !== current);
  return next ? {date: next, href: hrefFor(next)} : null;
}

/** The Monat view of "Meine Zeit": month day list + full day detail. */
export function MonatView({user, month, requestedDay}: {user: User; month: string; requestedDay: string | null}) {
  const today = todayISO();
  const record = monthRecord(user, month);
  const nowMin = nowMinutes();

  const {byDate: issuesByDate, queue} = periodIssues(record.days, today, record.locked, firstRecordedDate(user.id));
  // Every working day of the period is listed, entries or not — a gap is only
  // visible if the day is on screen.
  const days = [...record.days]
    .reverse()
    .filter((d) => d.segments.length > 0 || d.sollMin > 0 || d.dayType !== null);
  const selectedDate =
    requestedDay && requestedDay.startsWith(month)
      ? requestedDay
      : month === monthOf(today)
        ? today
        : (days[0]?.date ?? `${month}-01`);
  const selected = record.days.find((d) => d.date === selectedDate) ?? EMPTY_DAY(selectedDate);

  // The month saldo of a running month is only meaningful up to yesterday —
  // today's unfinished hours would read as a deficit every morning. Days whose
  // entry was never closed are left out for the same reason: unknown, not zero.
  const isCurrentMonth = month === monthOf(today);
  const countable = record.days.filter(
    (d) =>
      (d.segments.length > 0 || d.dayType !== null) && !d.summary.hasOpen && (!isCurrentMonth || d.date < today),
  );
  const saldoMin = countable.reduce((sum, d) => sum + d.summary.workedMin - d.sollMin, 0);

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
            issuesByDate={issuesByDate}
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
            dayType={selected.dayType}
            dayTypeLabel={selected.dayTypeLabel}
            issues={issuesByDate.get(selected.date)}
            nextIssue={nextIssue(queue, selected.date, (date) => `/?ansicht=monat&monat=${month}&tag=${date}`)}
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

  const countable = visible.filter((d) => !(d.date < today && d.summary.hasOpen));
  const workedMin = countable.reduce((sum, d) => sum + d.summary.workedMin, 0);
  const sollMin = countable.filter((d) => d.segments.length > 0).reduce((sum, d) => sum + d.sollMin, 0);
  const weekOver = addDays(monday, 6) < today;
  const saldoMin = workedMin - sollMin;
  const locked = isMonthLocked(user.id, monthOf(selected.date));
  const {byDate: issuesByDate, queue} = periodIssues(visible, today, locked, firstRecordedDate(user.id));

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
            issuesByDate={issuesByDate}
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
            dayType={selected.dayType}
            dayTypeLabel={selected.dayTypeLabel}
            issues={issuesByDate.get(selected.date)}
            nextIssue={nextIssue(queue, selected.date, (date) => `/?ansicht=woche&tag=${date}`)}
          />
        </StackItem>
      </HStack>
    </VStack>
  );
}
