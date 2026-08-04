import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {createDb, setDbForTesting, type Segment} from '../lib/db';
import type {Database} from 'bun:sqlite';
import {openYesterdayContinuation, stamp, undoStamp} from '../lib/time';

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
    expect(stamp(userId, 'einstempeln', 30, TODAY)).toBe('Sie sind bereits eingestempelt.');
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
