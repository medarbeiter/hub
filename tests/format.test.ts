import {describe, expect, test} from 'bun:test';
import {
  addDays,
  addMonths,
  dailySollMinutes,
  daysInMonth,
  daySummary,
  fmtDuration,
  fmtDurationSigned,
  fmtTime,
  isoToMin,
  mondayOf,
  monthOf,
  weekdayIndex,
} from '../lib/format';

describe('date helpers', () => {
  test('weekdayIndex: Monday=0, Sunday=6', () => {
    expect(weekdayIndex('2026-08-03')).toBe(0); // Montag
    expect(weekdayIndex('2026-08-07')).toBe(4); // Freitag
    expect(weekdayIndex('2026-08-09')).toBe(6); // Sonntag
  });

  test('addDays crosses month and year boundaries', () => {
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  test('addMonths clamps around year edges', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-12', 1)).toBe('2027-01');
  });

  test('mondayOf returns the Monday of the containing week', () => {
    expect(mondayOf('2026-08-04')).toBe('2026-08-03');
    expect(mondayOf('2026-08-03')).toBe('2026-08-03');
    expect(mondayOf('2026-08-09')).toBe('2026-08-03');
  });

  test('daysInMonth handles leap years', () => {
    expect(daysInMonth('2026-02')).toHaveLength(28);
    expect(daysInMonth('2028-02')).toHaveLength(29);
    expect(daysInMonth('2026-08')[0]).toBe('2026-08-01');
    expect(daysInMonth('2026-08')[30]).toBe('2026-08-31');
  });

  test('monthOf', () => {
    expect(monthOf('2026-08-04')).toBe('2026-08');
  });
});

describe('dailySollMinutes', () => {
  const user = {weekly_minutes: 2400}; // 40h
  test('spreads weekly Soll over Mo–Fr', () => {
    expect(dailySollMinutes(user, '2026-08-03')).toBe(480); // Mo
    expect(dailySollMinutes(user, '2026-08-07')).toBe(480); // Fr
  });
  test('weekends are 0', () => {
    expect(dailySollMinutes(user, '2026-08-08')).toBe(0); // Sa
    expect(dailySollMinutes(user, '2026-08-09')).toBe(0); // So
  });
});

describe('daySummary', () => {
  const D = '2026-08-04';
  const seg = (kind: 'arbeit' | 'pause', start: number, end: number | null) => ({
    date: D, kind, start_min: start, end_min: end,
  });

  test('sums closed arbeit and pause separately', () => {
    const s = daySummary([seg('arbeit', 480, 720), seg('pause', 720, 750), seg('arbeit', 750, 990)], D, 1000, D);
    expect(s).toEqual({workedMin: 480, pauseMin: 30, hasOpen: false});
  });

  test('open segment counts up to now on today', () => {
    const s = daySummary([seg('arbeit', 480, null)], D, 500, D);
    expect(s.workedMin).toBe(20);
    expect(s.hasOpen).toBe(true);
  });

  test('open segment on a past day contributes nothing but flags hasOpen', () => {
    const s = daySummary([seg('arbeit', 480, null)], D, 500, '2026-08-05');
    expect(s.workedMin).toBe(0);
    expect(s.hasOpen).toBe(true);
  });

  test('open segment with start after now clamps to zero duration', () => {
    const s = daySummary([seg('arbeit', 600, null)], D, 500, D);
    expect(s.workedMin).toBe(0);
  });
});

describe('formatting', () => {
  test('fmtTime pads to HH:MM', () => {
    expect(fmtTime(0)).toBe('00:00');
    expect(fmtTime(605)).toBe('10:05');
    expect(fmtTime(1440)).toBe('24:00');
  });

  test('isoToMin parses and bounds', () => {
    expect(isoToMin('9:05')).toBe(545);
    expect(isoToMin('24:00')).toBe(1440);
    expect(isoToMin('25:00')).toBeNull();
    expect(isoToMin('abc')).toBeNull();
  });

  test('fmtDuration uses U+2212 for negatives', () => {
    expect(fmtDuration(422)).toBe('7:02');
    expect(fmtDuration(-422)).toBe('−7:02');
    expect(fmtDuration(0)).toBe('0:00');
  });

  test('fmtDurationSigned: plus only for positive, zero unsigned', () => {
    expect(fmtDurationSigned(90)).toBe('+1:30');
    expect(fmtDurationSigned(-90)).toBe('−1:30');
    expect(fmtDurationSigned(0)).toBe('0:00');
  });
});
