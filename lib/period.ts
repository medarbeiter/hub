// One period of "Meine Zeit", however wide: the days, what each of them needs,
// what is merely expected of them, and the totals — computed once, here.
//
// This used to live twice inside the Monat/Woche view component, with two
// slightly different "countable" filters and no shared timeline window, which
// is why a week's days could never be compared against one axis.

import {dayIssues, type Issue} from './attention';
import type {Bereich} from './bereiche';
import {creditedWorkMin} from './daytypes';
import type {User} from './db';
import {
  addDays,
  daysInMonth,
  mondayOf,
  monthOf,
  nowMinutes,
  segmentPoints,
  spanOf,
  todayISO,
  type Span,
} from './format';
import {dayRecord, firstRecordedDate, isMonthLocked, usualStartMin, weekRecords, type DayRecord} from './time';


export interface PeriodDay {
  record: DayRecord;
  issues: Issue[];
  /**
   * What is expected on this day and not recorded yet. Drawn as a dashed
   * ghost, so an untouched Thursday reads as a plan waiting to be filled
   * rather than as a failure.
   */
  plan: {startMin: number; endMin: number} | null;
  isToday: boolean;
  isFuture: boolean;
  /** Counted towards the period's totals. */
  isCountable: boolean;
}

export interface PeriodRecord {
  kind: Exclude<Bereich, 'konto'>;
  /** The day every range is derived from. */
  anchor: string;
  days: PeriodDay[];
  /** Recorded so far, today included — the figure the period is about. */
  workedMin: number;
  /** The whole period's Soll, future days included: the plan being filled. */
  sollMin: number;
  /** Worked − Soll over days that are actually settled. */
  saldoMin: number;
  /** The period is still running, so the saldo covers only its closed days. */
  saldoIsPartial: boolean;
  locked: boolean;
  /** Days needing a correction, most recent first — the fix queue. */
  queue: string[];
  /** The axis every lane in this period shares. */
  span: Span;
}

/** The stretch of the day a plan occupies: the Soll plus its statutory break. */
function planFor(sollMin: number, startMin: number): {startMin: number; endMin: number} {
  return {startMin, endMin: Math.min(1440, startMin + sollMin + (sollMin >= 6 * 60 ? 30 : 0))};
}

function daysOf(user: User, kind: PeriodRecord['kind'], anchor: string): DayRecord[] {
  if (kind === 'tag') return [dayRecord(user, anchor)];
  if (kind === 'woche') return weekRecords(user, anchor);
  // The whole month, future days included: they carry the plan.
  return daysInMonth(monthOf(anchor)).map((d) => dayRecord(user, d));
}

export function periodRecord(
  user: User,
  kind: PeriodRecord['kind'],
  anchor: string,
  nowMin: number = nowMinutes(),
): PeriodRecord {
  const today = todayISO();
  const records = daysOf(user, kind, anchor);
  const since = firstRecordedDate(user.id);
  const locked = isMonthLocked(user.id, monthOf(anchor));
  const gewohnterStart = usualStartMin(user.id) ?? 8 * 60;

  const days: PeriodDay[] = records.map((record, index) => {
    const isToday = record.date === today;
    const isFuture = record.date > today;
    // Nothing before this employee's first record may be called a missing day,
    // and a locked month is nobody's to fix.
    const bewertbar = !locked && since !== null && record.date >= since && record.date < today;
    const issues = bewertbar
      ? dayIssues({
          date: record.date,
          segments: record.segments,
          prevSegments:
            records[index - 1]?.date === addDays(record.date, -1) ? records[index - 1]!.segments : undefined,
          sollMin: record.sollMin,
          dayType: record.dayType,
        })
      : [];
    return {
      record,
      issues,
      plan:
        record.segments.length === 0 && record.dayType === null && record.sollMin > 0 && record.date >= today
          ? planFor(record.sollMin, gewohnterStart)
          : null,
      isToday,
      isFuture,
      // A day counts once it is over, accounted for, and actually finished.
      isCountable:
        record.date < today &&
        (record.segments.length > 0 || record.dayType !== null) &&
        !record.summary.hasOpen,
    };
  });

  const countable = days.filter((d) => d.isCountable);
  const gutschrift = (d: PeriodDay) =>
    creditedWorkMin(user, d.record.date, d.record.dayType, d.record.summary.workedMin);

  // Two different questions, two different sums. The headline figure is "what
  // has been recorded in this period" — today included, or a week in progress
  // would read 0:00 while a lane on screen plainly shows six hours. The saldo
  // is the stricter one: only days that are over and actually finished.
  const workedMin = days.filter((d) => !d.isFuture).reduce((sum, d) => sum + gutschrift(d), 0);
  const sollMin = days.reduce((sum, d) => sum + d.record.sollMin, 0);
  const saldoMin =
    countable.reduce((sum, d) => sum + gutschrift(d), 0) -
    countable.reduce((sum, d) => sum + d.record.sollMin, 0);

  return {
    kind,
    anchor,
    days,
    workedMin,
    sollMin,
    saldoMin,
    saldoIsPartial: days.some((d) => d.isToday || d.isFuture),
    locked,
    queue: days
      .filter((d) => d.issues.some((i) => i.needsCorrection))
      .map((d) => d.record.date)
      .sort((a, b) => b.localeCompare(a)),
    span: spanOf(
      days.flatMap((d) =>
        segmentPoints(d.record.segments, {
          isToday: d.isToday,
          nowMin,
          extra: [d.plan?.startMin, d.plan?.endMin],
        }),
      ),
      kind === 'tag' ? 6 : 8,
    ),
  };
}

/** The anchor a range should open on, given what the URL asked for. */
export function anchorFor(kind: Bereich, requested: string | null, today: string): string {
  const base = requested ?? today;
  if (kind === 'woche') return mondayOf(base);
  if (kind === 'monat') return `${monthOf(base)}-01`;
  return base;
}
