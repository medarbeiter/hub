import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {attentionIssues, correctionQueue, dayIssues, type IssueKind} from '../lib/attention';

const TODAY = '2026-08-10'; // Montag
const FRIDAY = '2026-08-07';
const THURSDAY = '2026-08-06';
const WEDNESDAY = '2026-08-05';
const SATURDAY = '2026-08-08';

const seg = (kind: 'arbeit' | 'pause', start: number, end: number | null, extra: {auto_closed?: number} = {}) => ({
  date: FRIDAY,
  kind,
  start_min: start,
  end_min: end,
  ...extra,
});

const kinds = (list: {kind: IssueKind}[]) => list.map((i) => i.kind);

describe('dayIssues', () => {
  test('a clean 8 h day with a proper break has nothing to report', () => {
    const issues = dayIssues({
      date: FRIDAY,
      segments: [seg('arbeit', 480, 720), seg('pause', 720, 750), seg('arbeit', 750, 990)],
      sollMin: 480,
    });
    expect(issues).toEqual([]);
  });

  test('a working day with no entry is missing', () => {
    expect(kinds(dayIssues({date: FRIDAY, segments: [], sollMin: 480}))).toEqual(['fehlt']);
  });

  test('a weekend without entries is not missing', () => {
    expect(dayIssues({date: SATURDAY, segments: [], sollMin: 0})).toEqual([]);
  });

  test('an open entry is reported and suppresses the totals-based checks', () => {
    expect(kinds(dayIssues({date: FRIDAY, segments: [seg('arbeit', 480, null)], sollMin: 480}))).toEqual(['offen']);
  });

  test('a provisionally closed entry asks for confirmation', () => {
    const issues = dayIssues({
      date: FRIDAY,
      segments: [seg('arbeit', 480, 1080, {auto_closed: 1})],
      sollMin: 480,
    });
    expect(kinds(issues)).toContain('unbestaetigt');
  });

  test('a missing break is flagged but does not need correction', () => {
    const issues = dayIssues({date: FRIDAY, segments: [seg('arbeit', 480, 900)], sollMin: 480});
    const pause = issues.find((i) => i.kind === 'pause');
    expect(pause).toBeDefined();
    expect(pause!.needsCorrection).toBe(false);
    expect(pause!.message).toContain('§4');
  });

  test('over ten hours breaches the daily cap', () => {
    const issues = dayIssues({
      date: FRIDAY,
      segments: [seg('arbeit', 360, 720), seg('pause', 720, 765), seg('arbeit', 765, 1110)],
      sollMin: 480,
    });
    expect(kinds(issues)).toContain('hoechstzeit');
  });

  test('beyond fourteen hours it is implausible, not merely long', () => {
    const issues = dayIssues({date: FRIDAY, segments: [seg('arbeit', 300, 1260)], sollMin: 480});
    expect(kinds(issues)).toContain('unplausibel');
    expect(kinds(issues)).not.toContain('hoechstzeit');
    expect(issues.find((i) => i.kind === 'unplausibel')!.needsCorrection).toBe(true);
  });

  test('too little rest since the previous day is flagged', () => {
    const issues = dayIssues({
      date: FRIDAY,
      segments: [seg('arbeit', 5 * 60, 13 * 60)],
      prevSegments: [{date: THURSDAY, kind: 'arbeit', start_min: 600, end_min: 23 * 60}],
      sollMin: 480,
    });
    expect(kinds(issues)).toContain('ruhezeit');
  });
});

describe('attentionIssues', () => {
  let db: Database;
  let user: User;

  beforeEach(() => {
    db = createDb(':memory:');
    setDbForTesting(db);
    db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('t@t.de', 'x', 'Test', 'mitarbeiter')").run();
    user = db.query<User, []>('SELECT id, email, name, role, weekly_minutes, active, created_at FROM users').get()!;
  });

  afterEach(() => setDbForTesting(undefined));

  const insert = (date: string, start: number, end: number | null, autoClosed = 0) =>
    db
      .query('INSERT INTO segments (user_id, date, kind, start_min, end_min, auto_closed) VALUES (?, ?, ?, ?, ?, ?)')
      .run(user.id, date, 'arbeit', start, end, autoClosed);

  test('finds the open day and the missing days around it', () => {
    insert(WEDNESDAY, 480, 960); // the recorded era starts here
    insert(FRIDAY, 480, null);
    const issues = attentionIssues(user, {from: WEDNESDAY, today: TODAY});
    expect(kinds(issues)).toContain('offen');
    // Donnerstag has no entry at all.
    expect(issues.some((i) => i.kind === 'fehlt' && i.date === THURSDAY)).toBe(true);
    // Saturday and Sunday are not working days.
    expect(issues.some((i) => i.date === SATURDAY)).toBe(false);
  });

  test('an account with no records at all is not accused of missing days', () => {
    expect(attentionIssues(user, {from: '2026-07-01', today: TODAY})).toEqual([]);
  });

  test('missing days before the first recorded day are not claimed', () => {
    insert(FRIDAY, 480, 960);
    const issues = attentionIssues(user, {from: '2026-07-01', today: TODAY});
    expect(issues.every((i) => i.date >= FRIDAY)).toBe(true);
  });

  test('today is never reported — a running day is not a defect', () => {
    insert(TODAY, 480, null);
    const issues = attentionIssues(user, {from: TODAY, today: TODAY});
    expect(issues).toEqual([]);
  });

  test('locked months are skipped: nobody can act on them', () => {
    insert(FRIDAY, 480, null);
    db.query('INSERT INTO month_locks (user_id, month, locked_by) VALUES (?, ?, ?)').run(user.id, '2026-08', user.id);
    expect(attentionIssues(user, {from: THURSDAY, today: TODAY})).toEqual([]);
  });

  test('excused days (holiday, Urlaub) drop out of the scan', () => {
    insert(WEDNESDAY, 480, 960);
    const withoutExcuse = attentionIssues(user, {from: WEDNESDAY, today: TODAY});
    expect(withoutExcuse.some((i) => i.date === THURSDAY)).toBe(true);
    const withExcuse = attentionIssues(user, {from: WEDNESDAY, today: TODAY, isExcused: (d) => d === THURSDAY});
    expect(withExcuse.some((i) => i.date === THURSDAY)).toBe(false);
  });

  test('the correction queue lists days, most recent first, without advisory-only days', () => {
    insert(THURSDAY, 480, null); // offen → needs correction
    insert(FRIDAY, 480, 900); // 7 h without a break → advisory only
    const queue = correctionQueue(attentionIssues(user, {from: THURSDAY, today: TODAY}));
    expect(queue).toEqual([THURSDAY]);
  });

  test('urgent kinds sort ahead of advisory ones', () => {
    insert(THURSDAY, 480, 900); // break deficit
    insert(FRIDAY, 480, null); // open
    const issues = attentionIssues(user, {from: THURSDAY, today: TODAY});
    expect(issues[0]!.kind).toBe('offen');
    expect(issues[issues.length - 1]!.kind).toBe('pause');
  });
});
