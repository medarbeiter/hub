import {describe, expect, test} from 'bun:test';
import {
  checkDay,
  countablePauseMin,
  feierabendPrognose,
  requiredBreakMin,
  restBetween,
} from '../lib/arbzg';

const D = '2026-08-04';
const seg = (kind: 'arbeit' | 'pause', start: number, end: number | null, date = D) => ({
  date,
  kind,
  start_min: start,
  end_min: end,
});

describe('requiredBreakMin (§4 ArbZG)', () => {
  test('no break required up to and including 6 h', () => {
    expect(requiredBreakMin(0)).toBe(0);
    expect(requiredBreakMin(6 * 60)).toBe(0);
  });
  test('30 min above 6 h up to and including 9 h', () => {
    expect(requiredBreakMin(6 * 60 + 1)).toBe(30);
    expect(requiredBreakMin(9 * 60)).toBe(30);
  });
  test('45 min above 9 h', () => {
    expect(requiredBreakMin(9 * 60 + 1)).toBe(45);
    expect(requiredBreakMin(12 * 60)).toBe(45);
  });
});

describe('countablePauseMin', () => {
  test('blocks shorter than 15 minutes do not count', () => {
    expect(countablePauseMin([seg('pause', 600, 610)])).toBe(0);
  });
  test('blocks of exactly 15 minutes count', () => {
    expect(countablePauseMin([seg('pause', 600, 615)])).toBe(15);
  });
  test('several qualifying blocks add up, work is ignored', () => {
    const segments = [seg('arbeit', 480, 600), seg('pause', 600, 620), seg('arbeit', 620, 700), seg('pause', 700, 715)];
    expect(countablePauseMin(segments)).toBe(35);
  });
  test('a running pause does not count yet', () => {
    expect(countablePauseMin([seg('pause', 600, null)])).toBe(0);
  });
});

describe('checkDay', () => {
  const closedDay = (workMin: number, pauseMin: number) => [
    seg('arbeit', 480, 480 + workMin / 2),
    seg('pause', 480 + workMin / 2, 480 + workMin / 2 + pauseMin),
    seg('arbeit', 480 + workMin / 2 + pauseMin, 480 + workMin + pauseMin),
  ];

  test('an 8 h day with a 30 min break is compliant', () => {
    const c = checkDay(closedDay(480, 30), D, 0, '2026-08-05');
    expect(c.workedMin).toBe(480);
    expect(c.countableMin).toBe(30);
    expect(c.deficitMin).toBe(0);
    expect(c.capExceeded).toBe(false);
  });

  test('an 8 h day with a 10 min break has a full 30 min deficit', () => {
    const c = checkDay(closedDay(480, 10), D, 0, '2026-08-05');
    // The 10-minute block never counted, so the whole break is still owed.
    expect(c.pauseMin).toBe(10);
    expect(c.countableMin).toBe(0);
    expect(c.deficitMin).toBe(30);
  });

  test('a 9.5 h day requires 45 min', () => {
    const c = checkDay(closedDay(570, 30), D, 0, '2026-08-05');
    expect(c.requiredMin).toBe(45);
    expect(c.deficitMin).toBe(15);
  });

  test('cap: 10:30 exceeds, 9:45 approaches, 8:00 neither', () => {
    expect(checkDay(closedDay(630, 45), D, 0, '2026-08-05').capExceeded).toBe(true);
    const approaching = checkDay(closedDay(585, 45), D, 0, '2026-08-05');
    expect(approaching.capExceeded).toBe(false);
    expect(approaching.capApproaching).toBe(true);
    const normal = checkDay(closedDay(480, 30), D, 0, '2026-08-05');
    expect(normal.capApproaching).toBe(false);
  });

  test('implausible beyond 14 h', () => {
    expect(checkDay(closedDay(15 * 60, 45), D, 0, '2026-08-05').implausible).toBe(true);
  });

  test('dueSoon fires half an hour before the 6 h threshold', () => {
    // Running since 08:00, now 13:35 → 5:35 worked, no break yet.
    const running = [seg('arbeit', 480, null)];
    expect(checkDay(running, D, 13 * 60 + 35, D).dueSoon).toBe(true);
    // At 12:00 only 4 h are worked — no warning yet.
    expect(checkDay(running, D, 12 * 60, D).dueSoon).toBe(false);
  });

  test('dueSoon stops once enough break is taken', () => {
    const segments = [seg('arbeit', 480, 720), seg('pause', 720, 750), seg('arbeit', 750, null)];
    expect(checkDay(segments, D, 14 * 60, D).dueSoon).toBe(false);
  });
});

describe('restBetween (§5 ArbZG)', () => {
  const P = '2026-08-03';
  test('short rest is measured across the day boundary', () => {
    // Previous day until 22:00, next day from 06:00 → 8 h rest.
    const rest = restBetween([seg('arbeit', 600, 22 * 60, P)], [seg('arbeit', 6 * 60, 14 * 60)]);
    expect(rest).toBe(8 * 60);
  });

  test('a normal evening-to-morning gap is fine', () => {
    const rest = restBetween([seg('arbeit', 480, 17 * 60, P)], [seg('arbeit', 8 * 60, 16 * 60)]);
    expect(rest).toBe(15 * 60);
  });

  test('a shift split at midnight is one shift, not zero rest', () => {
    const rest = restBetween([seg('arbeit', 22 * 60, 1440, P)], [seg('arbeit', 0, 6 * 60)]);
    expect(rest).toBeNull();
  });

  test('null when either day has no work', () => {
    expect(restBetween([], [seg('arbeit', 480, 960)])).toBeNull();
    expect(restBetween([seg('arbeit', 480, 960, P)], [])).toBeNull();
  });

  test('an open previous day cannot be measured', () => {
    expect(restBetween([seg('arbeit', 480, null, P)], [seg('arbeit', 480, 960)])).toBeNull();
  });
});

describe('feierabendPrognose', () => {
  test('adds the statutory break that is still outstanding', () => {
    // 08:00 start, now 10:00, 2 h worked of 8 h Soll, no break yet.
    const p = feierabendPrognose({
      segments: [seg('arbeit', 480, null)],
      workedMin: 120,
      sollMin: 480,
      nowMin: 600,
      isRunning: true,
    });
    // 6 h work left + 30 min break owed → 16:30.
    expect(p).not.toBeNull();
    expect(p!.remainingWorkMin).toBe(360);
    expect(p!.outstandingBreakMin).toBe(30);
    expect(p!.atMin).toBe(16 * 60 + 30);
  });

  test('a break already taken is not demanded twice', () => {
    const segments = [seg('arbeit', 480, 720), seg('pause', 720, 750), seg('arbeit', 750, null)];
    const p = feierabendPrognose({segments, workedMin: 300, sollMin: 480, nowMin: 810, isRunning: true});
    expect(p!.outstandingBreakMin).toBe(0);
    expect(p!.atMin).toBe(810 + 180);
  });

  test('null when not clocked in, when Soll is reached, or past midnight', () => {
    const base = {segments: [], workedMin: 120, sollMin: 480, nowMin: 600};
    expect(feierabendPrognose({...base, isRunning: false})).toBeNull();
    expect(feierabendPrognose({...base, workedMin: 500, isRunning: true})).toBeNull();
    expect(feierabendPrognose({...base, nowMin: 1400, isRunning: true})).toBeNull();
  });
});
