import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {dayTypeCounts, resolveDayType, setDayType} from '../lib/daytypes';
import {setSetting} from '../lib/settings';
import {zeitkontoSummary} from '../lib/time';

// Alle Testtage sind Werktage mit 8 Std. Soll.
const MON = '2026-08-03';
const TUE = '2026-08-04';
const WED = '2026-08-05';
const THU = '2026-08-06';

let db: Database;
let user: User;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('t@t.de', 'x', 'Test', 'mitarbeiter')").run();
  user = db
    .query<User, []>('SELECT id, email, name, role, weekly_minutes, active, created_at, bundesland FROM users')
    .get()!;
});

afterEach(() => setDbForTesting(undefined));

const work = (date: string, startMin: number, endMin: number) =>
  db
    .query("INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, 'arbeit', ?, ?)")
    .run(user.id, date, startMin, endMin);

const balance = (through = THU) => zeitkontoSummary(user, through).balanceMin;

describe('day types and the Zeitkonto', () => {
  test('Urlaub neither earns nor costs: the Soll simply does not apply', () => {
    work(MON, 480, 960); // 8 h, exactly Soll
    setDayType(user, user.id, TUE, 'urlaub');
    expect(balance()).toBe(0);
    const summary = zeitkontoSummary(user, THU);
    expect(summary.recordedDays).toBe(1);
    expect(summary.absenceDays).toBe(1);
  });

  test('Krank behaves like Urlaub', () => {
    work(MON, 480, 960);
    setDayType(user, user.id, TUE, 'krank');
    expect(balance()).toBe(0);
  });

  test('a public holiday does not produce a deficit', () => {
    work(MON, 480, 960);
    setDayType(user, user.id, TUE, 'feiertag');
    expect(balance()).toBe(0);
  });

  test('Fortbildung counts as having worked the Soll', () => {
    setDayType(user, user.id, MON, 'fortbildung');
    work(TUE, 480, 960);
    expect(balance()).toBe(0);
    expect(zeitkontoSummary(user, THU).rows.find((r) => r.date === MON)!.workedMin).toBe(480);
  });

  test('Freizeitausgleich spends overtime: the balance falls by the Soll', () => {
    work(MON, 480, 1020); // 9 h → +1 h
    setDayType(user, user.id, TUE, 'freizeitausgleich');
    expect(balance()).toBe(60 - 480);
  });

  test('working on a holiday still earns overtime on top', () => {
    setDayType(user, user.id, MON, 'feiertag');
    work(MON, 480, 720); // 4 h on the holiday
    expect(balance()).toBe(240);
  });

  test('a day type on a weekend adds nothing (Soll is zero anyway)', () => {
    setDayType(user, user.id, '2026-08-08', 'urlaub'); // Samstag
    expect(zeitkontoSummary(user, '2026-08-09').balanceMin).toBe(0);
  });

  test('unrecorded working days are excluded and reported, not counted as deficit', () => {
    work(MON, 480, 960);
    const summary = zeitkontoSummary(user, THU);
    expect(summary.balanceMin).toBe(0);
    expect(summary.missingDays).toEqual([TUE, WED, THU]);
  });

  test('days with an unfinished entry are listed separately from missing ones', () => {
    work(MON, 480, 960);
    db.query("INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, 'arbeit', 480)").run(user.id, TUE);
    const summary = zeitkontoSummary(user, THU);
    expect(summary.uncountableDays).toEqual([TUE]);
    expect(summary.missingDays).toEqual([WED, THU]);
    expect(summary.balanceMin).toBe(0);
  });
});

describe('holiday resolution', () => {
  test('the company Bundesland supplies holidays automatically', () => {
    setSetting('bundesland', 'NW');
    const resolved = resolveDayType(user, '2026-06-04'); // Fronleichnam
    expect(resolved?.type).toBe('feiertag');
    expect(resolved?.computed).toBe(true);
    expect(resolved?.label).toBe('Fronleichnam');
  });

  test('the employee Bundesland overrides the company one', () => {
    setSetting('bundesland', 'NW');
    db.query('UPDATE users SET bundesland = ?').run('BE');
    const berlin = db
      .query<User, []>('SELECT id, email, name, role, weekly_minutes, active, created_at, bundesland FROM users')
      .get()!;
    expect(resolveDayType(berlin, '2026-06-04')).toBeNull(); // kein Fronleichnam in Berlin
  });

  test('without a Bundesland no holidays are invented', () => {
    expect(resolveDayType(user, '2026-06-04')).toBeNull();
  });

  test('a stored decision beats the computed holiday', () => {
    setSetting('bundesland', 'NW');
    setDayType(user, user.id, '2026-06-04', 'urlaub');
    const resolved = resolveDayType(user, '2026-06-04');
    expect(resolved?.type).toBe('urlaub');
    expect(resolved?.computed).toBe(false);
  });

  test('a computed holiday excuses the day from the Zeitkonto without a stored row', () => {
    setSetting('bundesland', 'NW');
    work('2026-06-03', 480, 960);
    // 2026-06-04 ist Fronleichnam (NW) — darf nicht als fehlender Tag gelten.
    const summary = zeitkontoSummary(user, '2026-06-04');
    expect(summary.missingDays).toEqual([]);
    expect(summary.balanceMin).toBe(0);
  });
});

describe('setDayType', () => {
  test('null removes the entry', () => {
    setDayType(user, user.id, MON, 'urlaub');
    expect(resolveDayType(user, MON)?.type).toBe('urlaub');
    setDayType(user, user.id, MON, null);
    expect(resolveDayType(user, MON)).toBeNull();
  });

  test('setting it again overwrites instead of failing', () => {
    setDayType(user, user.id, MON, 'urlaub');
    expect(setDayType(user, user.id, MON, 'krank')).toBeNull();
    expect(resolveDayType(user, MON)?.type).toBe('krank');
  });

  test('a locked month refuses the change', () => {
    db.query('INSERT INTO month_locks (user_id, month, locked_by) VALUES (?, ?, ?)').run(user.id, '2026-08', user.id);
    expect(setDayType(user, user.id, MON, 'urlaub')).toBe('Dieser Monat ist abgeschlossen.');
  });

  test('employees cannot edit someone else, Verwaltung can', () => {
    db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('a@b.de', 'x', 'Andere', 'mitarbeiter')").run();
    const other = db.query<{id: number}, []>("SELECT id FROM users WHERE email = 'a@b.de'").get()!;
    expect(setDayType(user, other.id, MON, 'urlaub')).toBe('Keine Berechtigung.');
    const chef: User = {...user, role: 'verwaltung'};
    expect(setDayType(chef, other.id, MON, 'urlaub')).toBeNull();
  });
});

describe('dayTypeCounts', () => {
  // Days in a finished month, so nothing is filtered out as still in the future.
  test('counts absence days per type within the month', () => {
    setDayType(user, user.id, '2026-07-29', 'urlaub');
    setDayType(user, user.id, '2026-07-30', 'urlaub');
    setDayType(user, user.id, '2026-07-31', 'krank');
    const counts = dayTypeCounts(user, '2026-07');
    expect(counts[0]).toEqual({type: 'urlaub', label: 'Urlaub', days: 2});
    expect(counts.find((c) => c.type === 'krank')!.days).toBe(1);
  });

  test('days still in the future are not counted yet', () => {
    setDayType(user, user.id, '2027-03-01', 'urlaub');
    expect(dayTypeCounts(user, '2027-03')).toEqual([]);
  });
});
