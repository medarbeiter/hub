import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {createDb, setDbForTesting, type Segment, type User} from '../lib/db';
import type {Database} from 'bun:sqlite';
import {
  autoCloseForgotten,
  confirmAutoClosed,
  createSegment,
  openYesterdayContinuation,
  stamp,
  undoStamp,
  updateSegment,
  zeitkontoBalance,
  zeitkontoLedger,
} from '../lib/time';
import {setSetting} from '../lib/settings';

const TODAY = '2026-08-04';
const YESTERDAY = '2026-08-03';

let db: Database;
let userId: number;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('t@t.de', 'x', 'Test', 'mitarbeiter')").run();
  userId = db.query<{id: number}, []>('SELECT id FROM users').get()!.id;
});

afterEach(() => setDbForTesting(undefined));

function segments(date: string = TODAY): Segment[] {
  return db
    .query<Segment, [number, string]>('SELECT * FROM segments WHERE user_id = ? AND date = ? ORDER BY start_min')
    .all(userId, date);
}

describe('stamp: merge window', () => {
  test('clock-out and back in within the window continues the segment', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'ausstempeln', 490, TODAY);
    stamp(userId, 'einstempeln', 491, TODAY);
    const rows = segments();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.start_min).toBe(480);
    expect(rows[0]!.end_min).toBeNull();
  });

  test('clock-out and back in after the window creates a new segment', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'ausstempeln', 490, TODAY);
    stamp(userId, 'einstempeln', 495, TODAY);
    const rows = segments();
    expect(rows).toHaveLength(2);
    expect(rows[0]!.end_min).toBe(490);
    expect(rows[1]!.start_min).toBe(495);
  });

  test('re-clock-in right after clocking out of a pause does not swallow the pause', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'pause', 500, TODAY);
    stamp(userId, 'ausstempeln', 510, TODAY);
    stamp(userId, 'einstempeln', 511, TODAY);
    const rows = segments();
    expect(rows.map((r) => [r.kind, r.start_min, r.end_min])).toEqual([
      ['arbeit', 480, 500],
      ['pause', 500, 510],
      ['arbeit', 511, null],
    ]);
  });

  test('zero-length clock-in/out leaves no record', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'ausstempeln', 480, TODAY);
    expect(segments()).toHaveLength(0);
  });
});

describe('stamp: micro-pause absorption', () => {
  test('a pause below the window is dropped and the work block continues', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'pause', 500, TODAY);
    stamp(userId, 'fortsetzen', 501, TODAY);
    const rows = segments();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.kind).toBe('arbeit');
    expect(rows[0]!.start_min).toBe(480);
    expect(rows[0]!.end_min).toBeNull();
  });

  test('a real pause at the window length is kept', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'pause', 500, TODAY);
    stamp(userId, 'fortsetzen', 502, TODAY);
    const rows = segments();
    expect(rows.map((r) => [r.kind, r.start_min, r.end_min])).toEqual([
      ['arbeit', 480, 500],
      ['pause', 500, 502],
      ['arbeit', 502, null],
    ]);
  });
});

describe('undoStamp', () => {
  test('reopens the segment right after clocking out', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'ausstempeln', 490, TODAY);
    expect(undoStamp(userId, TODAY)).toBeNull();
    const rows = segments();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.end_min).toBeNull();
  });

  test('refuses while a segment is running', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    expect(undoStamp(userId, TODAY)).toBe('Es läuft bereits ein Eintrag.');
  });

  test('refuses once the window has passed', () => {
    stamp(userId, 'einstempeln', 480, TODAY);
    stamp(userId, 'ausstempeln', 490, TODAY);
    db.query("UPDATE segments SET updated_at = datetime('now', '-120 seconds')").run();
    expect(undoStamp(userId, TODAY)).toBe('Rückgängig ist nicht mehr möglich.');
  });

  test('refuses with nothing to undo', () => {
    expect(undoStamp(userId, TODAY)).toBe('Rückgängig ist nicht mehr möglich.');
  });
});

describe('night-shift rollover', () => {
  function openYesterday(startMin: number, kind: 'arbeit' | 'pause' = 'arbeit'): void {
    db.query('INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, ?, ?)').run(
      userId,
      YESTERDAY,
      kind,
      startMin,
    );
  }

  test('clocking out after midnight splits the shift at midnight', () => {
    openYesterday(22 * 60);
    expect(stamp(userId, 'ausstempeln', 90, TODAY)).toBeNull();
    const y = segments(YESTERDAY);
    expect(y).toHaveLength(1);
    expect(y[0]!.end_min).toBe(1440);
    const t = segments(TODAY);
    expect(t).toHaveLength(1);
    expect(t[0]!.start_min).toBe(0);
    expect(t[0]!.end_min).toBe(90);
  });

  test('starting a pause after midnight also rolls over first', () => {
    openYesterday(22 * 60);
    expect(stamp(userId, 'pause', 60, TODAY)).toBeNull();
    expect(segments(YESTERDAY)[0]!.end_min).toBe(1440);
    expect(segments(TODAY).map((r) => [r.kind, r.start_min, r.end_min])).toEqual([
      ['arbeit', 0, 60],
      ['pause', 60, null],
    ]);
  });

  test('clocking in while the night shift is running reports "already clocked in"', () => {
    openYesterday(22 * 60);
    expect(stamp(userId, 'einstempeln', 30, TODAY)).toBe('Du bist bereits eingestempelt.');
  });

  test('an implausibly long open segment is a forgotten clock-out, not a night shift', () => {
    openYesterday(8 * 60); // open since yesterday 08:00 → >12h elapsed
    expect(openYesterdayContinuation(userId, 480, TODAY)).toBeNull();
    expect(stamp(userId, 'einstempeln', 480, TODAY)).toBeNull();
    // Yesterday's segment stays open (anomaly), today starts fresh.
    expect(segments(YESTERDAY)[0]!.end_min).toBeNull();
    expect(segments(TODAY)).toHaveLength(1);
  });

  test('a plausible continuation is exposed to the clock state', () => {
    openYesterday(22 * 60);
    const cont = openYesterdayContinuation(userId, 90, TODAY);
    expect(cont).not.toBeNull();
    expect(cont!.start_min).toBe(22 * 60);
  });
});

describe('auto-close of forgotten entries', () => {
  const OLD = '2026-08-01';

  function openOn(date: string, startMin: number): number {
    db.query('INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, ?, ?)').run(
      userId,
      date,
      'arbeit',
      startMin,
    );
    return db.query<{id: number}, []>('SELECT id FROM segments ORDER BY id DESC LIMIT 1').get()!.id;
  }

  test('does nothing while no cutoff is configured', () => {
    openOn(OLD, 8 * 60);
    expect(autoCloseForgotten(userId, TODAY)).toEqual([]);
    expect(segments(OLD)[0]!.end_min).toBeNull();
  });

  test('closes at the cutoff and flags the entry', () => {
    setSetting('auto_close_cutoff_min', String(18 * 60));
    const id = openOn(OLD, 8 * 60);
    // Reports what it closed, not just how many: the caller has to log each
    // one as machine-set, and a count cannot say which day that was.
    expect(autoCloseForgotten(userId, TODAY)).toEqual([
      {id, date: OLD, startMin: 8 * 60, endMin: 18 * 60},
    ]);
    const row = segments(OLD)[0]!;
    expect(row.end_min).toBe(18 * 60);
    expect(row.auto_closed).toBe(1);
  });

  test('leaves entries that started after the cutoff open', () => {
    setSetting('auto_close_cutoff_min', String(18 * 60));
    openOn(OLD, 20 * 60);
    expect(autoCloseForgotten(userId, TODAY)).toEqual([]);
    expect(segments(OLD)[0]!.end_min).toBeNull();
  });

  test('never touches a locked month', () => {
    setSetting('auto_close_cutoff_min', String(18 * 60));
    openOn(OLD, 8 * 60);
    db.query('INSERT INTO month_locks (user_id, month, locked_by) VALUES (?, ?, ?)').run(userId, '2026-08', userId);
    expect(autoCloseForgotten(userId, TODAY)).toEqual([]);
    expect(segments(OLD)[0]!.end_min).toBeNull();
  });

  test('never touches a running night shift from yesterday', () => {
    setSetting('auto_close_cutoff_min', String(18 * 60));
    openOn(YESTERDAY, 22 * 60);
    expect(autoCloseForgotten(userId, TODAY)).toEqual([]);
    expect(segments(YESTERDAY)[0]!.end_min).toBeNull();
  });

  test('confirming clears the flag', () => {
    setSetting('auto_close_cutoff_min', String(18 * 60));
    const id = openOn(OLD, 8 * 60);
    autoCloseForgotten(userId, TODAY);
    const actor = {id: userId, role: 'mitarbeiter'} as User;
    expect(confirmAutoClosed(actor, id)).toBeNull();
    expect(segments(OLD)[0]!.auto_closed).toBe(0);
  });

  test('correcting the entry clears the flag too', () => {
    setSetting('auto_close_cutoff_min', String(18 * 60));
    const id = openOn(OLD, 8 * 60);
    autoCloseForgotten(userId, TODAY);
    const actor = {id: userId, role: 'mitarbeiter'} as User;
    expect(updateSegment(actor, id, {date: OLD, kind: 'arbeit', startMin: 8 * 60, endMin: 16 * 60})).toBeNull();
    const row = segments(OLD)[0]!;
    expect(row.end_min).toBe(16 * 60);
    expect(row.auto_closed).toBe(0);
  });
});

describe('uncountable days (open entry on a past day)', () => {
  const PAST = '2026-08-03';

  test('an unfinished past day is left out of the Zeitkonto, not counted as zero', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, 'arbeit', 480)").run(userId, PAST);
    const user = db
      .query<User, []>('SELECT id, email, name, role, weekly_minutes, active, created_at FROM users')
      .get()!;
    // Without the exclusion this would read −8:00 for a day nobody can total.
    expect(zeitkontoBalance(user, PAST)).toBe(0);
    expect(zeitkontoLedger(user, PAST)).toEqual([]);
  });

  test('a finished day still counts normally', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, 'arbeit', 480, 960)").run(
      userId,
      PAST,
    );
    const user = db
      .query<User, []>('SELECT id, email, name, role, weekly_minutes, active, created_at FROM users')
      .get()!;
    expect(zeitkontoBalance(user, PAST)).toBe(0); // 8 h worked, 8 h Soll
    expect(zeitkontoLedger(user, PAST)).toHaveLength(1);
  });
});


describe('nachgetragene Pause schneidet die Arbeit', () => {
  const actor = () => ({id: userId, role: 'mitarbeiter'}) as User;
  const spannen = () => segments().map((r) => [r.kind, r.start_min, r.end_min]);

  test('teilt den Arbeitseintrag in davor und danach', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, 'arbeit', 462, 880)").run(
      userId,
      TODAY,
    );
    expect(createSegment(actor(), userId, {date: TODAY, kind: 'pause', startMin: 690, endMin: 720})).toBeNull();
    expect(spannen()).toEqual([
      ['arbeit', 462, 690],
      ['pause', 690, 720],
      ['arbeit', 720, 880],
    ]);
  });

  test('der laufende Eintrag bleibt der laufende', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min) VALUES (?, ?, 'arbeit', 462)").run(userId, TODAY);
    expect(createSegment(actor(), userId, {date: TODAY, kind: 'pause', startMin: 690, endMin: 720})).toBeNull();
    expect(spannen()).toEqual([
      ['arbeit', 462, 690],
      ['pause', 690, 720],
      ['arbeit', 720, null],
    ]);
  });

  test('eine Pause über den ganzen Eintrag lässt ihn entfallen', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, 'arbeit', 600, 700)").run(
      userId,
      TODAY,
    );
    expect(createSegment(actor(), userId, {date: TODAY, kind: 'pause', startMin: 540, endMin: 720})).toBeNull();
    expect(spannen()).toEqual([['pause', 540, 720]]);
  });

  test('Arbeit über Arbeit bleibt eine Überschneidung', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, 'arbeit', 462, 880)").run(
      userId,
      TODAY,
    );
    expect(createSegment(actor(), userId, {date: TODAY, kind: 'arbeit', startMin: 690, endMin: 720})).toContain(
      'Überschneidung',
    );
    expect(spannen()).toEqual([['arbeit', 462, 880]]);
  });
});
