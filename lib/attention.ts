// Which past days need a human to look at them — the difference between a
// record that is merely stored and one payroll can rely on.
//
// Split in two: a pure classifier (usable from client components and views
// that already hold the day's segments) and a DB-bound scan over a range.

import {getDb, type Segment, type User} from './db';
import {checkDay, restBetween} from './arbzg';
import {resolveDayTypes} from './daytypes';
import {firstRecordedDate} from './time';
import {addDays, dailySollMinutes, fmtDuration, monthOf, todayISO, type SegmentLike} from './format';

export type IssueKind =
  /** Never clocked out — the day cannot be counted at all. */
  | 'offen'
  /** Provisionally closed by the cutoff sweep, still unconfirmed. */
  | 'unbestaetigt'
  /** A working day with no entry whatsoever. */
  | 'fehlt'
  /** Longer than any plausible shift — almost certainly a forgotten clock-out. */
  | 'unplausibel'
  /** ArbZG §3: more than 10 hours. */
  | 'hoechstzeit'
  /** ArbZG §4: statutory break missing. */
  | 'pause'
  /** ArbZG §5: less than 11 hours between two shifts. */
  | 'ruhezeit';

/** Most urgent first — this is the order the fix flow walks. */
const PRIORITY: IssueKind[] = ['offen', 'unbestaetigt', 'unplausibel', 'fehlt', 'hoechstzeit', 'ruhezeit', 'pause'];

/** Kinds that make the day uncountable, as opposed to a compliance note. */
const NEEDS_CORRECTION: ReadonlySet<IssueKind> = new Set<IssueKind>(['offen', 'unbestaetigt', 'unplausibel', 'fehlt']);

export interface Issue {
  kind: IssueKind;
  date: string;
  /** One German line, ready to render. */
  message: string;
  /** False for advisory ArbZG notes: the record is fine, the day was not. */
  needsCorrection: boolean;
}

export interface DayInput {
  date: string;
  segments: Array<SegmentLike & {auto_closed?: number}>;
  /** The previous calendar day, for the rest-period check. */
  prevSegments?: SegmentLike[];
  sollMin: number;
  /** Urlaub, Krank, Feiertag …: the day is accounted for without stamped time. */
  dayType?: string | null;
}

/**
 * Classify one finished day. `date` must be in the past — a running day has
 * an open entry by design and owes no break yet.
 */
export function dayIssues(day: DayInput): Issue[] {
  const issues: Issue[] = [];
  const add = (kind: IssueKind, message: string) =>
    issues.push({kind, date: day.date, message, needsCorrection: NEEDS_CORRECTION.has(kind)});

  const hasOpen = day.segments.some((s) => s.end_min === null);
  const hasUnconfirmed = day.segments.some((s) => s.auto_closed === 1);

  if (day.segments.length === 0) {
    if (day.sollMin > 0 && !day.dayType) add('fehlt', 'Kein Eintrag an einem Arbeitstag.');
    return issues;
  }
  if (hasOpen) add('offen', 'Ausstempeln wurde vergessen – der Tag hat kein Ende.');
  if (hasUnconfirmed) add('unbestaetigt', 'Automatisch beendet – bitte prüfen und bestätigen.');

  // An open day has no meaningful totals; the checks below would be noise.
  if (hasOpen) return issues;

  const check = checkDay(day.segments, day.date);
  if (check.implausible) {
    add('unplausibel', `${fmtDuration(check.workedMin)} Std. erfasst – bitte prüfen.`);
  } else if (check.capExceeded) {
    add('hoechstzeit', `${fmtDuration(check.workedMin)} Std. – über der Höchstarbeitszeit von 10 Std. (§3 ArbZG).`);
  }
  if (check.deficitMin > 0) {
    add(
      'pause',
      `Pause zu kurz: ${check.countableMin} von ${check.requiredMin} Min. bei ${fmtDuration(check.workedMin)} Std. Arbeit (§4 ArbZG).`,
    );
  }
  if (day.prevSegments) {
    const rest = restBetween(day.prevSegments, day.segments);
    if (rest !== null && rest < 11 * 60) {
      add('ruhezeit', `Nur ${fmtDuration(rest)} Std. Ruhezeit seit dem Vortag – vorgeschrieben sind 11 (§5 ArbZG).`);
    }
  }
  return issues;
}

function sortIssues(issues: Issue[]): Issue[] {
  return issues.sort(
    (a, b) => PRIORITY.indexOf(a.kind) - PRIORITY.indexOf(b.kind) || b.date.localeCompare(a.date),
  );
}

export interface ScanOptions {
  /** First day to look at. Default: start of the previous month. */
  from?: string;
  today?: string;
  /**
   * Days that legitimately have no entry (holidays, Urlaub, Krank). Phase 4
   * fills this in; until then only weekends are excused, via Soll = 0.
   */
  isExcused?: (dateISO: string) => boolean;
}

/**
 * Everything about this employee's finished days that a human should see.
 * Locked months are skipped: nobody can act on them.
 */
export function attentionIssues(user: User, options: ScanOptions = {}): Issue[] {
  const today = options.today ?? todayISO();
  const to = addDays(today, -1);
  const requested = options.from ?? `${monthOf(addDays(`${monthOf(today)}-01`, -1))}-01`;

  // Never claim days are missing from before this employee started recording:
  // the app has no basis to say work was expected then.
  const first = firstRecordedDate(user.id);
  if (!first) return [];
  const from = requested > first ? requested : first;
  if (from > to) return [];

  // One query for the whole range (plus the day before it, for rest periods).
  const rows = getDb()
    .query<Segment, [number, string, string]>(
      'SELECT * FROM segments WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, start_min',
    )
    .all(user.id, addDays(from, -1), to);
  const byDate = new Map<string, Segment[]>();
  for (const row of rows) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }

  const locked = new Set(
    getDb()
      .query<{month: string}, [number]>('SELECT month FROM month_locks WHERE user_id = ?')
      .all(user.id)
      .map((r) => r.month),
  );

  const issues: Issue[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (locked.has(monthOf(date))) continue;
    if (options.isExcused?.(date)) continue;
    issues.push(
      ...dayIssues({
        date,
        segments: byDate.get(date) ?? [],
        prevSegments: byDate.get(addDays(date, -1)) ?? [],
        sollMin: dailySollMinutes(user, date),
      }),
    );
  }
  return sortIssues(issues);
}

/**
 * A predicate for `ScanOptions.isExcused`: days carrying a day type (Urlaub,
 * Krank, Feiertag, …) legitimately have no stamped time.
 */
export function excusedDays(user: User, today: string): (dateISO: string) => boolean {
  // One resolution pass over the widest range the scan can ask for.
  const from = `${monthOf(addDays(`${monthOf(today)}-01`, -1))}-01`;
  const types = resolveDayTypes(user, from, today);
  return (dateISO) => types.has(dateISO);
}

/** Days (not issues) that need correcting, most recent first — the fix queue. */
export function correctionQueue(issues: Issue[]): string[] {
  const dates = new Set(issues.filter((i) => i.needsCorrection).map((i) => i.date));
  return [...dates].sort((a, b) => b.localeCompare(a));
}
