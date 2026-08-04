// Day types: why a day has no working time, and what that means for the
// Zeitkonto. Without them every holiday and every day of leave looks like a
// gap, and the balance quietly stops meaning anything.

import {getDb, type DayTypeKind, type DayTypeRow, type User} from './db';
import {dailySollMinutes, monthOf, todayISO} from './format';
import {holidayName, holidaysInRange, isBundesland, type Bundesland} from './feiertage';
import {getSetting} from './settings';

export const DAY_TYPE_LABEL: Record<DayTypeKind, string> = {
  urlaub: 'Urlaub',
  krank: 'Krank',
  feiertag: 'Feiertag',
  freizeitausgleich: 'Freizeitausgleich',
  fortbildung: 'Fortbildung',
};

/**
 * How each day type meets the day's Soll.
 *
 * `bezahlt` — the Soll simply does not apply (paid absence or a public
 * holiday); the day is neutral for the balance.
 * `gearbeitet` — counts as having worked the Soll (Fortbildung is working time).
 * `abgebaut` — the Soll stands and is paid out of the Zeitkonto: taking
 * Freizeitausgleich is how overtime is *spent*, so the balance must fall.
 */
const SOLL_TREATMENT: Record<DayTypeKind, 'bezahlt' | 'gearbeitet' | 'abgebaut'> = {
  urlaub: 'bezahlt',
  krank: 'bezahlt',
  feiertag: 'bezahlt',
  fortbildung: 'gearbeitet',
  freizeitausgleich: 'abgebaut',
};

export interface ResolvedDayType {
  type: DayTypeKind;
  note: string | null;
  /** True when this comes from the holiday calendar, not from a stored row. */
  computed: boolean;
  label: string;
}

export function bundeslandFor(user: Pick<User, 'bundesland'>): Bundesland | null {
  const raw = user.bundesland ?? getSetting('bundesland');
  return raw && isBundesland(raw) ? raw : null;
}

/** Stored day types for a range, keyed by date. */
export function storedDayTypes(userId: number, fromISO: string, toISO: string): Map<string, DayTypeRow> {
  const rows = getDb()
    .query<DayTypeRow, [number, string, string]>(
      'SELECT * FROM day_types WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date',
    )
    .all(userId, fromISO, toISO);
  return new Map(rows.map((r) => [r.date, r]));
}

/**
 * The day types that actually apply across a range: stored decisions first,
 * public holidays filled in behind them.
 */
export function resolveDayTypes(user: User, fromISO: string, toISO: string): Map<string, ResolvedDayType> {
  const result = new Map<string, ResolvedDayType>();
  const land = bundeslandFor(user);
  if (land) {
    for (const [date, name] of holidaysInRange(fromISO, toISO, land)) {
      result.set(date, {type: 'feiertag', note: name, computed: true, label: name});
    }
  }
  for (const [date, row] of storedDayTypes(user.id, fromISO, toISO)) {
    result.set(date, {type: row.type, note: row.note, computed: false, label: DAY_TYPE_LABEL[row.type]});
  }
  return result;
}

export function resolveDayType(user: User, dateISO: string): ResolvedDayType | null {
  const stored = getDb()
    .query<DayTypeRow, [number, string]>('SELECT * FROM day_types WHERE user_id = ? AND date = ?')
    .get(user.id, dateISO);
  if (stored) {
    return {type: stored.type, note: stored.note, computed: false, label: DAY_TYPE_LABEL[stored.type]};
  }
  const land = bundeslandFor(user);
  const name = land ? holidayName(dateISO, land) : null;
  return name ? {type: 'feiertag', note: name, computed: true, label: name} : null;
}

/**
 * The Soll that counts for the balance on this day. Recorded working time is
 * added on top by the caller, so working on a holiday still earns overtime.
 */
export function effectiveSollMin(user: User, dateISO: string, type: DayTypeKind | null): number {
  const soll = dailySollMinutes(user, dateISO);
  if (type === null) return soll;
  switch (SOLL_TREATMENT[type]) {
    case 'bezahlt':
      return 0;
    // A training day is an ordinary working day; the Soll stands and is met by
    // the training itself (see creditedWorkMin), so the balance nets to zero.
    case 'gearbeitet':
    case 'abgebaut':
      return soll;
  }
}

/**
 * Fortbildung counts as working time even though nothing was stamped. Stamps
 * win when they exist: if someone recorded part of a training day, that record
 * is what happened, and the remainder is a correction for a human to make.
 */
export function creditedWorkMin(user: User, dateISO: string, type: DayTypeKind | null, workedMin: number): number {
  if (type !== null && SOLL_TREATMENT[type] === 'gearbeitet' && workedMin === 0) {
    return dailySollMinutes(user, dateISO);
  }
  return workedMin;
}

/** A day that legitimately has no stamped time — never flag it as missing. */
export function isExcusedType(type: DayTypeKind | null): boolean {
  return type !== null;
}

export function setDayType(
  actor: User,
  userId: number,
  dateISO: string,
  type: DayTypeKind | null,
  note?: string,
): string | null {
  if (actor.role !== 'verwaltung' && actor.id !== userId) return 'Keine Berechtigung.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateISO)) return 'Ungültiges Datum.';
  const locked = getDb()
    .query<{month: string}, [number, string]>('SELECT month FROM month_locks WHERE user_id = ? AND month = ?')
    .get(userId, monthOf(dateISO));
  if (locked) return 'Dieser Monat ist abgeschlossen.';
  const db = getDb();
  if (type === null) {
    db.query('DELETE FROM day_types WHERE user_id = ? AND date = ?').run(userId, dateISO);
    return null;
  }
  db.query(
    `INSERT INTO day_types (user_id, date, type, note, edited_by) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET type = excluded.type, note = excluded.note,
       edited_by = excluded.edited_by, updated_at = datetime('now')`,
  ).run(userId, dateISO, type, note?.trim() || null, actor.id);
  return null;
}

/** Absence days per type in a month — the payroll-facing summary. */
export function dayTypeCounts(user: User, month: string): Array<{type: DayTypeKind; label: string; days: number}> {
  const from = `${month}-01`;
  const to = `${month}-31`;
  const today = todayISO();
  const counts = new Map<DayTypeKind, number>();
  for (const [date, resolved] of resolveDayTypes(user, from, to)) {
    if (date > today) continue;
    if (dailySollMinutes(user, date) === 0 && resolved.type === 'feiertag') continue; // holiday on a weekend
    counts.set(resolved.type, (counts.get(resolved.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, days]) => ({type, label: DAY_TYPE_LABEL[type], days}))
    .sort((a, b) => b.days - a.days);
}
