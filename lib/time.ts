import {getDb, type DayTypeKind, type Segment, type User} from './db';
import {autoCloseCutoffMin, mergeWindowMin} from './settings';
import {creditedWorkMin, effectiveSollMin, resolveDayType, resolveDayTypes} from './daytypes';
import {
  addDays,
  dailySollMinutes,
  daySummary,
  daysInMonth,
  fmtTime,
  isoDate,
  mondayOf,
  monthOf,
  nowMinutes,
  todayISO,
  weekdayIndex,
  type DaySummary,
} from './format';

// All times are server-local (Europe/Berlin for this deployment). Segments
// store a calendar date plus minutes-from-midnight and never cross midnight.
// A forgotten clock-out surfaces as an open segment on a past date (anomaly)
// and is fixed by manual correction — with one exception: a segment still
// open from exactly yesterday counts as a running night shift while the
// elapsed time stays plausible (ROLLOVER_MAX_MIN) and is split at midnight on
// the next stamp action. Anything older is never auto-closed.

export {
  addDays,
  dailySollMinutes,
  daySummary,
  daysInMonth,
  fmtTime,
  isoDate,
  mondayOf,
  monthOf,
  nowMinutes,
  todayISO,
  weekdayIndex,
};
export type {DaySummary};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function segmentsForDay(userId: number, dateISO: string): Segment[] {
  return getDb()
    .query<Segment, [number, string]>('SELECT * FROM segments WHERE user_id = ? AND date = ? ORDER BY start_min')
    .all(userId, dateISO);
}

export function openSegmentToday(userId: number, today: string = todayISO()): Segment | null {
  return (
    getDb()
      .query<Segment, [number, string]>('SELECT * FROM segments WHERE user_id = ? AND date = ? AND end_min IS NULL')
      .get(userId, today) ?? null
  );
}

/**
 * A shift longer than this cannot be a running night shift anymore — the open
 * segment is treated as a forgotten clock-out instead. Keeps a one-click
 * "Ausstempeln" from fabricating a whole missed day.
 */
const ROLLOVER_MAX_MIN = 12 * 60;

/**
 * Yesterday's open segment, if it plausibly continues into today (night
 * shift): elapsed time within ROLLOVER_MAX_MIN and nothing recorded today yet.
 */
export function openYesterdayContinuation(
  userId: number,
  now: number = nowMinutes(),
  today: string = todayISO(),
): Segment | null {
  const open = getDb()
    .query<Segment, [number, string]>('SELECT * FROM segments WHERE user_id = ? AND date = ? AND end_min IS NULL')
    .get(userId, addDays(today, -1));
  if (!open) return null;
  if (1440 - open.start_min + now > ROLLOVER_MAX_MIN) return null;
  if (segmentsForDay(userId, today).length > 0) return null;
  return open;
}

/** Open segments on past dates — forgotten clock-outs needing correction. */
export function stalePastOpenSegments(userId: number, today: string = todayISO()): Segment[] {
  const continuation = openYesterdayContinuation(userId, nowMinutes(), today);
  return getDb()
    .query<Segment, [number, string]>(
      'SELECT * FROM segments WHERE user_id = ? AND date < ? AND end_min IS NULL ORDER BY date',
    )
    .all(userId, today)
    .filter((s) => s.id !== continuation?.id);
}

export type ClockStatus = 'aus' | 'arbeit' | 'pause';

export interface ClockState {
  status: ClockStatus;
  /** Start (minutes from midnight) of the currently open segment. */
  since: number | null;
  /** True when the open segment started yesterday (running night shift). */
  sinceYesterday?: boolean;
}

export function clockState(userId: number): ClockState {
  const open = openSegmentToday(userId);
  if (open) return {status: open.kind, since: open.start_min, sinceYesterday: false};
  const continuation = openYesterdayContinuation(userId);
  if (continuation) return {status: continuation.kind, since: continuation.start_min, sinceYesterday: true};
  return {status: 'aus', since: null, sinceYesterday: false};
}

export function isMonthLocked(userId: number, month: string): boolean {
  return (
    getDb()
      .query<{month: string}, [number, string]>('SELECT month FROM month_locks WHERE user_id = ? AND month = ?')
      .get(userId, month) !== null
  );
}

// ---------------------------------------------------------------------------
// Stamping (state machine on today's segments)
// ---------------------------------------------------------------------------

function insertSegment(userId: number, kind: 'arbeit' | 'pause', startMin: number, date: string): void {
  getDb()
    .query('INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, ?, ?)')
    .run(userId, date, kind, startMin);
}

/** Close the open segment; a zero-length segment is removed, not stored. */
function closeSegment(segment: Segment, endMin: number): void {
  const db = getDb();
  if (endMin <= segment.start_min) {
    db.query('DELETE FROM segments WHERE id = ?').run(segment.id);
  } else {
    db.query("UPDATE segments SET end_min = ?, updated_at = datetime('now') WHERE id = ?").run(endMin, segment.id);
  }
}

function reopenSegment(segmentId: number): void {
  getDb().query("UPDATE segments SET end_min = NULL, updated_at = datetime('now') WHERE id = ?").run(segmentId);
}

/**
 * Mis-click protection: a clock-out followed by a clock-in within the merge
 * window continues the previous segment instead of fragmenting the day.
 * Only the day's last closed segment qualifies (reopening an earlier one
 * would overlap whatever came after it).
 */
function reopenIfWithinMergeWindow(userId: number, kind: 'arbeit' | 'pause', now: number, today: string): boolean {
  const last = getDb()
    .query<Segment, [number, string]>(
      'SELECT * FROM segments WHERE user_id = ? AND date = ? AND end_min IS NOT NULL ORDER BY end_min DESC LIMIT 1',
    )
    .get(userId, today);
  if (!last || last.kind !== kind || last.end_min === null) return false;
  const gap = now - last.end_min;
  if (gap < 0 || gap > mergeWindowMin()) return false;
  reopenSegment(last.id);
  return true;
}

/** Split a running night shift at midnight so the state machine only ever sees today. */
function rolloverYesterdayOpen(userId: number, now: number, today: string): void {
  const continuation = openYesterdayContinuation(userId, now, today);
  if (!continuation) return;
  const db = getDb();
  db.transaction(() => {
    db.query("UPDATE segments SET end_min = 1440, updated_at = datetime('now') WHERE id = ?").run(continuation.id);
    db.query('INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, ?, 0)').run(
      userId,
      today,
      continuation.kind,
    );
  })();
}

export function stamp(
  userId: number,
  action: 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln',
  now: number = nowMinutes(),
  today: string = todayISO(),
): string | null {
  rolloverYesterdayOpen(userId, now, today);
  const open = openSegmentToday(userId, today);
  switch (action) {
    case 'einstempeln':
      if (open) return 'Sie sind bereits eingestempelt.';
      if (!reopenIfWithinMergeWindow(userId, 'arbeit', now, today)) insertSegment(userId, 'arbeit', now, today);
      return null;
    case 'pause':
      if (!open || open.kind !== 'arbeit') return 'Pause ist nur während der Arbeitszeit möglich.';
      closeSegment(open, now);
      insertSegment(userId, 'pause', now, today);
      return null;
    case 'fortsetzen': {
      if (!open || open.kind !== 'pause') return 'Es läuft keine Pause.';
      closeSegment(open, now);
      // A pause below the merge window is stamp fumbling, not a real break:
      // drop it and continue the work block it interrupted.
      if (now - open.start_min < mergeWindowMin()) {
        const previous = getDb()
          .query<Segment, [number, string, number]>(
            "SELECT * FROM segments WHERE user_id = ? AND date = ? AND kind = 'arbeit' AND end_min = ? LIMIT 1",
          )
          .get(userId, today, open.start_min);
        if (previous) {
          getDb().query('DELETE FROM segments WHERE id = ?').run(open.id);
          reopenSegment(previous.id);
          return null;
        }
      }
      insertSegment(userId, 'arbeit', now, today);
      return null;
    }
    case 'ausstempeln':
      if (!open) return 'Sie sind nicht eingestempelt.';
      closeSegment(open, now);
      return null;
  }
}

/**
 * Provisionally close entries left open on past days at the configured cutoff
 * and flag them `auto_closed` — they surface as "please confirm", never as
 * accepted fact. Disabled by default (no cutoff configured). Entries that
 * started after the cutoff are left open: guessing an end time for them would
 * invent hours rather than approximate them. Returns how many were closed.
 */
export function autoCloseForgotten(userId: number, today: string = todayISO()): number {
  const cutoff = autoCloseCutoffMin();
  if (cutoff === null) return 0;
  const db = getDb();
  let closed = 0;
  for (const open of stalePastOpenSegments(userId, today)) {
    if (open.start_min >= cutoff) continue;
    if (isMonthLocked(userId, monthOf(open.date))) continue;
    db.query("UPDATE segments SET end_min = ?, auto_closed = 1, updated_at = datetime('now') WHERE id = ?").run(
      cutoff,
      open.id,
    );
    closed++;
  }
  return closed;
}

/** Accept a provisionally closed entry as correct. */
export function confirmAutoClosed(actor: User, segmentId: number): string | null {
  const segment = getDb().query<Segment, [number]>('SELECT * FROM segments WHERE id = ?').get(segmentId);
  if (!segment) return 'Eintrag nicht gefunden.';
  if (!canEdit(actor, segment.user_id)) return 'Keine Berechtigung.';
  if (isMonthLocked(segment.user_id, monthOf(segment.date))) return 'Dieser Monat ist abgeschlossen.';
  getDb()
    .query("UPDATE segments SET auto_closed = 0, edited_by = ?, updated_at = datetime('now') WHERE id = ?")
    .run(actor.id, segmentId);
  return null;
}

/** Client toast shows 30s; the server allows slack for latency and clock skew. */
const UNDO_WINDOW_SEC = 45;

/**
 * Undo a clock-out shortly after it happened by reopening the day's last
 * closed segment. Everything the undo must prove — same user, just closed,
 * nothing recorded since — is derived from the database; no token needed.
 */
export function undoStamp(userId: number, today: string = todayISO()): string | null {
  if (openSegmentToday(userId, today)) return 'Es läuft bereits ein Eintrag.';
  const last = getDb()
    .query<Segment & {recent: number}, [number, string]>(
      `SELECT *, (updated_at >= datetime('now', '-${UNDO_WINDOW_SEC} seconds')) AS recent
       FROM segments WHERE user_id = ? AND date = ? AND end_min IS NOT NULL
       ORDER BY end_min DESC LIMIT 1`,
    )
    .get(userId, today);
  if (!last || !last.recent) return 'Rückgängig ist nicht mehr möglich.';
  reopenSegment(last.id);
  return null;
}

// ---------------------------------------------------------------------------
// Manual entries & corrections
// ---------------------------------------------------------------------------

export interface SegmentInput {
  date: string;
  kind: 'arbeit' | 'pause';
  startMin: number;
  endMin: number;
  note?: string;
}

export function validateSegment(userId: number, input: SegmentInput, excludeId?: number): string | null {
  const {date, startMin, endMin} = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return 'Ungültiges Datum.';
  if (date > todayISO()) return 'Zeiten in der Zukunft können nicht erfasst werden.';
  if (startMin < 0 || startMin >= 1440 || endMin <= 0 || endMin > 1440) return 'Ungültige Uhrzeit.';
  if (endMin <= startMin) return 'Das Ende muss nach dem Beginn liegen.';
  const others = segmentsForDay(userId, date).filter((s) => s.id !== excludeId);
  for (const other of others) {
    const otherEnd = other.end_min ?? (other.date === todayISO() ? nowMinutes() : 1440);
    if (startMin < otherEnd && other.start_min < endMin) {
      return `Überschneidung mit einem vorhandenen Eintrag (${fmtTime(other.start_min)}–${
        other.end_min === null ? 'offen' : fmtTime(other.end_min)
      }).`;
    }
  }
  return null;
}

function canEdit(actor: User, ownerId: number): boolean {
  return actor.role === 'verwaltung' || actor.id === ownerId;
}

export function createSegment(actor: User, userId: number, input: SegmentInput): string | null {
  if (!canEdit(actor, userId)) return 'Keine Berechtigung.';
  if (isMonthLocked(userId, monthOf(input.date))) return 'Dieser Monat ist abgeschlossen.';
  const invalid = validateSegment(userId, input);
  if (invalid) return invalid;
  getDb()
    .query('INSERT INTO segments (user_id, date, kind, start_min, end_min, note, edited_by) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(userId, input.date, input.kind, input.startMin, input.endMin, input.note ?? null, actor.id);
  return null;
}

export function updateSegment(actor: User, segmentId: number, input: SegmentInput): string | null {
  const segment = getDb().query<Segment, [number]>('SELECT * FROM segments WHERE id = ?').get(segmentId);
  if (!segment) return 'Eintrag nicht gefunden.';
  if (!canEdit(actor, segment.user_id)) return 'Keine Berechtigung.';
  if (isMonthLocked(segment.user_id, monthOf(segment.date)) || isMonthLocked(segment.user_id, monthOf(input.date))) {
    return 'Dieser Monat ist abgeschlossen.';
  }
  const invalid = validateSegment(segment.user_id, input, segmentId);
  if (invalid) return invalid;
  // A human just set the times: whatever the sweep guessed is now confirmed.
  getDb()
    .query(
      `UPDATE segments SET date = ?, kind = ?, start_min = ?, end_min = ?, note = ?, edited_by = ?,
       auto_closed = 0, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(input.date, input.kind, input.startMin, input.endMin, input.note ?? null, actor.id, segmentId);
  return null;
}

export function deleteSegment(actor: User, segmentId: number): string | null {
  const segment = getDb().query<Segment, [number]>('SELECT * FROM segments WHERE id = ?').get(segmentId);
  if (!segment) return 'Eintrag nicht gefunden.';
  if (!canEdit(actor, segment.user_id)) return 'Keine Berechtigung.';
  if (isMonthLocked(segment.user_id, monthOf(segment.date))) return 'Dieser Monat ist abgeschlossen.';
  getDb().query('DELETE FROM segments WHERE id = ?').run(segmentId);
  return null;
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

export interface DayRecord {
  date: string;
  segments: Segment[];
  summary: DaySummary;
  /** The Soll that counts for this day — 0 on a paid absence or holiday. */
  sollMin: number;
  dayType: DayTypeKind | null;
  dayTypeLabel: string | null;
}

export function dayRecord(user: User, dateISO: string): DayRecord {
  const segments = segmentsForDay(user.id, dateISO);
  const resolved = resolveDayType(user, dateISO);
  const type = resolved?.type ?? null;
  return {
    date: dateISO,
    segments,
    summary: daySummary(segments, dateISO),
    sollMin: effectiveSollMin(user, dateISO, type),
    dayType: type,
    dayTypeLabel: resolved?.label ?? null,
  };
}

/** The Mo–So week containing anchor, each day with worked vs. soll. */
export function weekRecords(user: User, anchorISO: string): DayRecord[] {
  const monday = mondayOf(anchorISO);
  return Array.from({length: 7}, (_, i) => dayRecord(user, addDays(monday, i)));
}

/**
 * Zeitkonto balance: Σ (worked − soll) over countable days up to and including
 * `through`.
 *
 * Two kinds of day are left out, for opposite reasons. Days with no entry at
 * all are absences (Urlaub, Krankheit) the app does not track, so counting
 * them as −Soll would invent a deficit. Days with an unfinished entry are
 * *uncountable*: their worked time is unknown, and counting the known part
 * would understate it. Both are surfaced elsewhere as needing correction —
 * silence is what would corrupt the balance.
 */
export function zeitkontoBalance(user: User, throughISO: string): number {
  return zeitkontoSummary(user, throughISO).balanceMin;
}

export interface MonthRecord {
  month: string;
  days: DayRecord[];
  workedMin: number;
  sollMin: number;
  locked: boolean;
  openSegments: number;
  /** Past days whose entry was never closed — their hours are unknown. */
  uncountableDays: number;
}

/** A past day with an unfinished entry: its worked time cannot be totalled. */
function isUncountable(day: DayRecord, today: string): boolean {
  return day.date < today && day.summary.hasOpen;
}

export function monthRecord(user: User, month: string): MonthRecord {
  const today = todayISO();
  const days = daysInMonth(month)
    .filter((d) => d <= today)
    .map((d) => dayRecord(user, d));
  // Absence days carry no stamped time but do carry a decision, so they belong
  // in the month's Soll picture (with an effective Soll of 0 or, for
  // Freizeitausgleich, the full Soll being spent).
  const countable = days.filter(
    (d) => (d.segments.length > 0 || d.dayType !== null) && !isUncountable(d, today),
  );
  return {
    month,
    days,
    workedMin: countable.reduce((sum, d) => sum + creditedWorkMin(user, d.date, d.dayType, d.summary.workedMin), 0),
    sollMin: countable.reduce((sum, d) => sum + d.sollMin, 0),
    locked: isMonthLocked(user.id, month),
    openSegments: days.reduce((sum, d) => sum + d.segments.filter((s) => s.end_min === null).length, 0),
    uncountableDays: days.filter((d) => isUncountable(d, today)).length,
  };
}

export function activeUsers(): User[] {
  return getDb()
    .query<User, []>(
      'SELECT id, email, name, role, weekly_minutes, active, created_at, bundesland FROM users WHERE active = 1 ORDER BY name',
    )
    .all();
}

export function getUser(id: number): User | null {
  return (
    getDb()
      .query<User, [number]>(
        'SELECT id, email, name, role, weekly_minutes, active, created_at, bundesland FROM users WHERE id = ?',
      )
      .get(id) ?? null
  );
}

/**
 * The first day this employee ever recorded anything — a stamped day or a
 * decision like Urlaub. Before it the app has no basis to expect work, so no
 * day may be called missing.
 */
export function firstRecordedDate(userId: number): string | null {
  const row = getDb()
    .query<{date: string | null}, [number, number]>(
      `SELECT MIN(date) AS date FROM (
         SELECT MIN(date) AS date FROM segments WHERE user_id = ?
         UNION ALL
         SELECT MIN(date) AS date FROM day_types WHERE user_id = ?
       )`,
    )
    .get(userId, userId);
  return row?.date ?? null;
}

/** True when the user has ever recorded a segment (first-run detection). */
export function hasAnyRecords(userId: number): boolean {
  return (
    getDb().query<{id: number}, [number]>('SELECT id FROM segments WHERE user_id = ? LIMIT 1').get(userId) !== null
  );
}

/**
 * Median first clock-in over the last 10 recorded workdays — feeds the
 * "Meistens starten Sie gegen …" ghost hint on an empty day.
 */
export function usualStartMin(userId: number): number | null {
  const rows = getDb()
    .query<{start: number}, [number]>(
      `SELECT MIN(start_min) AS start FROM segments
       WHERE user_id = ? AND kind = 'arbeit' GROUP BY date ORDER BY date DESC LIMIT 10`,
    )
    .all(userId);
  if (rows.length < 3) return null;
  const sorted = rows.map((r) => r.start).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

/** Per-day ledger behind the Zeitkonto balance: worked − soll with running sum. */
export interface LedgerRow {
  date: string;
  workedMin: number;
  /** The Soll that actually counted — 0 on a paid absence or holiday. */
  sollMin: number;
  diffMin: number;
  runningMin: number;
  /** Why the day is in the ledger without stamped time, if that is the case. */
  dayType: DayTypeKind | null;
  dayTypeLabel: string | null;
}

export interface ZeitkontoSummary {
  balanceMin: number;
  /** Last day included in the balance. */
  through: string;
  rows: LedgerRow[];
  /** Days with stamped working time. */
  recordedDays: number;
  /** Days counted through a day type (Urlaub, Feiertag, …). */
  absenceDays: number;
  /** Working days with neither entry nor day type — excluded, and reported. */
  missingDays: string[];
  /** Days whose entry was never closed — excluded until corrected. */
  uncountableDays: string[];
}

/**
 * The full Zeitkonto picture: which days counted, which did not, and why.
 * Everything the balance is made of, so the figure needs no footnote.
 */
export function zeitkontoSummary(user: User, throughISO: string): ZeitkontoSummary {
  const firstDate = firstRecordedDate(user.id);
  const empty: ZeitkontoSummary = {
    balanceMin: 0,
    through: throughISO,
    rows: [],
    recordedDays: 0,
    absenceDays: 0,
    missingDays: [],
    uncountableDays: [],
  };
  if (!firstDate || firstDate > throughISO) return empty;

  const segments = getDb()
    .query<Segment, [number, string, string]>(
      'SELECT * FROM segments WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date, start_min',
    )
    .all(user.id, firstDate, throughISO);
  const byDate = new Map<string, Segment[]>();
  for (const row of segments) {
    const list = byDate.get(row.date);
    if (list) list.push(row);
    else byDate.set(row.date, [row]);
  }
  const types = resolveDayTypes(user, firstDate, throughISO);

  const summary = {...empty, rows: [] as LedgerRow[], missingDays: [] as string[], uncountableDays: [] as string[]};
  let running = 0;
  for (let date = firstDate; date <= throughISO; date = addDays(date, 1)) {
    const daySegments = byDate.get(date) ?? [];
    const resolved = types.get(date) ?? null;
    const type = resolved?.type ?? null;
    const day = daySummary(daySegments, date);

    if (day.hasOpen) {
      summary.uncountableDays.push(date);
      continue;
    }
    if (daySegments.length === 0 && type === null) {
      if (dailySollMinutes(user, date) > 0) summary.missingDays.push(date);
      continue;
    }

    const worked = creditedWorkMin(user, date, type, day.workedMin);
    const soll = effectiveSollMin(user, date, type);
    const diff = worked - soll;
    running += diff;
    if (daySegments.length > 0) summary.recordedDays++;
    else summary.absenceDays++;
    summary.rows.push({
      date,
      workedMin: worked,
      sollMin: soll,
      diffMin: diff,
      runningMin: running,
      dayType: type,
      dayTypeLabel: resolved?.label ?? null,
    });
  }
  summary.balanceMin = running;
  return summary;
}

export function zeitkontoLedger(user: User, throughISO: string): LedgerRow[] {
  return zeitkontoSummary(user, throughISO).rows;
}

// ---------------------------------------------------------------------------
// Month locks (Monatsabschluss)
// ---------------------------------------------------------------------------

export function lockMonth(actor: User, userId: number, month: string): string | null {
  if (actor.role !== 'verwaltung') return 'Keine Berechtigung.';
  if (month >= monthOf(todayISO())) return 'Der laufende Monat kann noch nicht abgeschlossen werden.';
  const user = getUser(userId);
  if (!user) return 'Mitarbeiter nicht gefunden.';
  if (isMonthLocked(userId, month)) return 'Dieser Monat ist bereits abgeschlossen.';
  const open = getDb()
    .query<{n: number}, [number, string]>(
      "SELECT COUNT(*) AS n FROM segments WHERE user_id = ? AND date LIKE ? || '-%' AND end_min IS NULL",
    )
    .get(userId, month);
  if (open && open.n > 0) return 'Offene Einträge müssen vor dem Abschluss korrigiert werden.';
  getDb().query('INSERT INTO month_locks (user_id, month, locked_by) VALUES (?, ?, ?)').run(userId, month, actor.id);
  return null;
}

export function unlockMonth(actor: User, userId: number, month: string): string | null {
  if (actor.role !== 'verwaltung') return 'Keine Berechtigung.';
  getDb().query('DELETE FROM month_locks WHERE user_id = ? AND month = ?').run(userId, month);
  return null;
}
