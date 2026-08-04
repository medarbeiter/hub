import {getDb, type Segment, type User} from './db';
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
// store a calendar date plus minutes-from-midnight and never cross midnight;
// a forgotten clock-out surfaces as an open segment on a past date (anomaly)
// and is fixed by manual correction, never auto-closed.

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

export function openSegmentToday(userId: number): Segment | null {
  return (
    getDb()
      .query<Segment, [number, string]>('SELECT * FROM segments WHERE user_id = ? AND date = ? AND end_min IS NULL')
      .get(userId, todayISO()) ?? null
  );
}

/** Open segments on past dates — forgotten clock-outs needing correction. */
export function stalePastOpenSegments(userId: number): Segment[] {
  return getDb()
    .query<Segment, [number, string]>(
      'SELECT * FROM segments WHERE user_id = ? AND date < ? AND end_min IS NULL ORDER BY date',
    )
    .all(userId, todayISO());
}

export type ClockStatus = 'aus' | 'arbeit' | 'pause';

export interface ClockState {
  status: ClockStatus;
  /** Start (minutes from midnight, today) of the currently open segment. */
  since: number | null;
}

export function clockState(userId: number): ClockState {
  const open = openSegmentToday(userId);
  if (!open) return {status: 'aus', since: null};
  return {status: open.kind, since: open.start_min};
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

function insertSegment(userId: number, kind: 'arbeit' | 'pause', startMin: number): void {
  getDb()
    .query('INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, ?, ?)')
    .run(userId, todayISO(), kind, startMin);
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

export function stamp(userId: number, action: 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln'): string | null {
  const open = openSegmentToday(userId);
  const now = nowMinutes();
  switch (action) {
    case 'einstempeln':
      if (open) return 'Sie sind bereits eingestempelt.';
      insertSegment(userId, 'arbeit', now);
      return null;
    case 'pause':
      if (!open || open.kind !== 'arbeit') return 'Pause ist nur während der Arbeitszeit möglich.';
      closeSegment(open, now);
      insertSegment(userId, 'pause', now);
      return null;
    case 'fortsetzen':
      if (!open || open.kind !== 'pause') return 'Es läuft keine Pause.';
      closeSegment(open, now);
      insertSegment(userId, 'arbeit', now);
      return null;
    case 'ausstempeln':
      if (!open) return 'Sie sind nicht eingestempelt.';
      closeSegment(open, now);
      return null;
  }
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
  getDb()
    .query(
      `UPDATE segments SET date = ?, kind = ?, start_min = ?, end_min = ?, note = ?, edited_by = ?,
       updated_at = datetime('now') WHERE id = ?`,
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
  sollMin: number;
}

export function dayRecord(user: User, dateISO: string): DayRecord {
  const segments = segmentsForDay(user.id, dateISO);
  return {date: dateISO, segments, summary: daySummary(segments, dateISO), sollMin: dailySollMinutes(user, dateISO)};
}

/** The Mo–So week containing anchor, each day with worked vs. soll. */
export function weekRecords(user: User, anchorISO: string): DayRecord[] {
  const monday = mondayOf(anchorISO);
  return Array.from({length: 7}, (_, i) => dayRecord(user, addDays(monday, i)));
}

/**
 * Zeitkonto balance: Σ (worked − soll) over recorded days up to and including
 * `through`. Only days that have at least one segment count, so absences
 * (Urlaub, Krankheit) don't drag the balance negative — the app records
 * working time only.
 */
export function zeitkontoBalance(user: User, throughISO: string): number {
  const rows = getDb()
    .query<{date: string}, [number, string]>(
      'SELECT DISTINCT date FROM segments WHERE user_id = ? AND date <= ? ORDER BY date',
    )
    .all(user.id, throughISO);
  let balance = 0;
  for (const {date} of rows) {
    const summary = daySummary(segmentsForDay(user.id, date), date);
    balance += summary.workedMin - dailySollMinutes(user, date);
  }
  return balance;
}

export interface MonthRecord {
  month: string;
  days: DayRecord[];
  workedMin: number;
  sollMin: number;
  locked: boolean;
  openSegments: number;
}

export function monthRecord(user: User, month: string): MonthRecord {
  const today = todayISO();
  const days = daysInMonth(month)
    .filter((d) => d <= today)
    .map((d) => dayRecord(user, d));
  const recorded = days.filter((d) => d.segments.length > 0);
  return {
    month,
    days,
    workedMin: recorded.reduce((sum, d) => sum + d.summary.workedMin, 0),
    sollMin: recorded.reduce((sum, d) => sum + d.sollMin, 0),
    locked: isMonthLocked(user.id, month),
    openSegments: days.reduce((sum, d) => sum + d.segments.filter((s) => s.end_min === null).length, 0),
  };
}

export function activeUsers(): User[] {
  return getDb()
    .query<User, []>(
      'SELECT id, email, name, role, weekly_minutes, active, created_at FROM users WHERE active = 1 ORDER BY name',
    )
    .all();
}

export function getUser(id: number): User | null {
  return (
    getDb()
      .query<User, [number]>(
        'SELECT id, email, name, role, weekly_minutes, active, created_at FROM users WHERE id = ?',
      )
      .get(id) ?? null
  );
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
  sollMin: number;
  diffMin: number;
  runningMin: number;
}

export function zeitkontoLedger(user: User, throughISO: string): LedgerRow[] {
  const rows = getDb()
    .query<{date: string}, [number, string]>(
      'SELECT DISTINCT date FROM segments WHERE user_id = ? AND date <= ? ORDER BY date',
    )
    .all(user.id, throughISO);
  let running = 0;
  return rows.map(({date}) => {
    const summary = daySummary(segmentsForDay(user.id, date), date);
    const soll = dailySollMinutes(user, date);
    const diff = summary.workedMin - soll;
    running += diff;
    return {date, workedMin: summary.workedMin, sollMin: soll, diffMin: diff, runningMin: running};
  });
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
