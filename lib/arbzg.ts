// Arbeitszeitgesetz (ArbZG) rules, as pure functions over a day's segments —
// no database access, safe to import from client components.
//
// Everything here is ADVISORY. The app documents what actually happened; it
// never refuses a record because the law was broken. Flags exist so employee
// and Verwaltung can see it and add a reason.

import {daySummary, type SegmentLike} from './format';

/** §4 ArbZG: a break counts only in blocks of at least 15 minutes. */
export const PAUSE_BLOCK_MIN = 15;
/** §3 ArbZG: 8 h base, extendable to 10 h with compensation — 10 h is the hard cap. */
export const CAP_MIN = 10 * 60;
/** Close enough to the cap to say so before it is crossed. */
export const CAP_WARN_MIN = 9 * 60 + 30;
/** §5 ArbZG: 11 h uninterrupted rest between shifts. */
export const REST_MIN = 11 * 60;
/** Beyond this a recorded day is almost certainly a forgotten clock-out. */
export const IMPLAUSIBLE_MIN = 14 * 60;
/** How far ahead the running day warns that a break is about to be due. */
const BREAK_LOOKAHEAD_MIN = 30;

/** §4 ArbZG: required break minutes for a net working time. */
export function requiredBreakMin(workedMin: number): number {
  if (workedMin > 9 * 60) return 45;
  if (workedMin > 6 * 60) return 30;
  return 0;
}

/** Pause minutes that legally count: only blocks of ≥15 minutes. */
export function countablePauseMin(segments: SegmentLike[]): number {
  let total = 0;
  for (const s of segments) {
    if (s.kind !== 'pause' || s.end_min === null) continue;
    const dur = s.end_min - s.start_min;
    if (dur >= PAUSE_BLOCK_MIN) total += dur;
  }
  return total;
}

export interface DayCompliance {
  workedMin: number;
  /** Every recorded pause minute, whether or not it counts legally. */
  pauseMin: number;
  /** Pause minutes in blocks of ≥15 min — the ones §4 accepts. */
  countableMin: number;
  requiredMin: number;
  /** Missing statutory break; >0 is a violation on a closed day. */
  deficitMin: number;
  /** Running day only: the break becomes due within the next half hour. */
  dueSoon: boolean;
  capExceeded: boolean;
  capApproaching: boolean;
  implausible: boolean;
}

/**
 * The ArbZG picture of one day. On a running day the figures are provisional:
 * `deficitMin` is what the employee still owes themselves, not yet a breach.
 */
export function checkDay(
  segments: SegmentLike[],
  dateISO: string,
  nowMin?: number,
  today?: string,
): DayCompliance {
  const summary = daySummary(segments, dateISO, nowMin, today);
  const countable = countablePauseMin(segments);
  const required = requiredBreakMin(summary.workedMin);
  return {
    workedMin: summary.workedMin,
    pauseMin: summary.pauseMin,
    countableMin: countable,
    requiredMin: required,
    deficitMin: Math.max(0, required - countable),
    dueSoon: requiredBreakMin(summary.workedMin + BREAK_LOOKAHEAD_MIN) > countable,
    capExceeded: summary.workedMin > CAP_MIN,
    capApproaching: summary.workedMin >= CAP_WARN_MIN && summary.workedMin <= CAP_MIN,
    implausible: summary.workedMin > IMPLAUSIBLE_MIN,
  };
}

/**
 * Rest between the shift ending on `prevDate` and the one starting on `date`.
 * Returns null when there is no boundary to measure: either day has no work,
 * or the shift runs across midnight (23:xx–24:00 + 00:00–xx:xx is one shift,
 * not a zero-hour rest).
 */
export function restBetween(prevSegments: SegmentLike[], daySegments: SegmentLike[]): number | null {
  const prevWork = prevSegments.filter((s) => s.kind === 'arbeit' && s.end_min !== null);
  const dayWork = daySegments.filter((s) => s.kind === 'arbeit');
  if (prevWork.length === 0 || dayWork.length === 0) return null;
  const lastEnd = Math.max(...prevWork.map((s) => s.end_min!));
  const firstStart = Math.min(...dayWork.map((s) => s.start_min));
  if (lastEnd === 1440 && firstStart === 0) return null; // one shift across midnight
  return 1440 - lastEnd + firstStart;
}

export interface Prognose {
  /** Clock time the day's Soll is reached, breaks included. */
  atMin: number;
  remainingWorkMin: number;
  /** Statutory break still to be taken before that time. */
  outstandingBreakMin: number;
}

/**
 * "When can I go home?" — remaining Soll plus any statutory break not yet
 * taken, projected onto the clock. Null once Soll is reached, when nothing is
 * running, or when the answer would fall past midnight.
 */
export function feierabendPrognose(args: {
  segments: SegmentLike[];
  workedMin: number;
  sollMin: number;
  nowMin: number;
  isRunning: boolean;
}): Prognose | null {
  const {segments, workedMin, sollMin, nowMin, isRunning} = args;
  if (!isRunning) return null;
  const remainingWorkMin = sollMin - workedMin;
  if (remainingWorkMin <= 0) return null;
  // The break is owed against the full day, not against the hours worked so far.
  const outstandingBreakMin = Math.max(0, requiredBreakMin(sollMin) - countablePauseMin(segments));
  const atMin = nowMin + remainingWorkMin + outstandingBreakMin;
  if (atMin >= 1440) return null;
  return {atMin, remainingWorkMin, outstandingBreakMin};
}
