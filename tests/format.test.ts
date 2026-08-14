import {describe, expect, test} from 'bun:test';
import {
  addDays,
  hourTicks,
  kwOf,
  fmtWeekRange,
  segmentPoints,
  spanOf,
  addMonths,
  dailySollMinutes,
  daysInMonth,
  daySummary,
  fmtDateRange,
  fmtDuration,
  fmtDurationSigned,
  fmtEuro,
  fmtEuroPlain,
  fmtTime,
  isoToMin,
  parseEuro,
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

describe('Beträge — Cent rein, deutsches Komma raus', () => {
  test('fmtEuro setzt Komma, Tausenderpunkt und Währungszeichen', () => {
    expect(fmtEuro(1400)).toBe('14,00 €');
    expect(fmtEuro(0)).toBe('0,00 €');
    expect(fmtEuro(5)).toBe('0,05 €');
    expect(fmtEuro(123456)).toBe('1.234,56 €');
    expect(fmtEuro(-1400)).toBe('−14,00 €');
  });

  test('fmtEuroPlain bleibt für die CSV bei der nackten Zahl', () => {
    expect(fmtEuroPlain(1400)).toBe('14,00');
    expect(fmtEuroPlain(123456)).toBe('1234,56');
  });

  test('parseEuro nimmt Komma wie Punkt', () => {
    expect(parseEuro('12,50')).toBe(1250);
    expect(parseEuro('12.50')).toBe(1250);
    expect(parseEuro('12')).toBe(1200);
    expect(parseEuro(' 8,90 € ')).toBe(890);
    expect(parseEuro('1.234,56')).toBe(123456);
  });

  test('parseEuro lehnt Mehrdeutiges und Unsinn ab, statt zu raten', () => {
    // "1.234" könnte 1234 oder 1,234 meinen — beides zu raten wäre falsch.
    expect(parseEuro('1.234')).toBeNull();
    expect(parseEuro('')).toBeNull();
    expect(parseEuro('abc')).toBeNull();
    expect(parseEuro('-5,00')).toBeNull();
    expect(parseEuro('12,345')).toBeNull();
  });

  test('parseEuro und fmtEuro sind zueinander dicht', () => {
    for (const cent of [0, 5, 99, 1400, 2000, 123456]) {
      expect(parseEuro(fmtEuroPlain(cent))).toBe(cent);
    }
  });
});

describe('fmtDateRange — der Zeitraum einer Reise', () => {
  test('ein Tag nennt nur diesen Tag', () => {
    expect(fmtDateRange('2026-08-04', '2026-08-04')).toBe('4. August');
  });

  test('innerhalb eines Monats steht der Monatsname einmal', () => {
    expect(fmtDateRange('2026-08-03', '2026-08-06')).toBe('3. – 6. August');
  });

  test('über die Monatsgrenze stehen beide Monate', () => {
    expect(fmtDateRange('2026-07-30', '2026-08-02')).toBe('30. Juli – 2. August');
  });
});

describe('spanOf — der eine Fensterausschnitt für jede Zeitleiste', () => {
  test('rundet auf volle Stunden und polstert um 30 Minuten', () => {
    // 09:10 − 30min → 08:40, floor 08:00 · 15:50 + 30min → 16:20, ceil 17:00
    expect(spanOf([9 * 60 + 10, 15 * 60 + 50])).toEqual({from: 8 * 60, to: 17 * 60});
    expect(spanOf([9 * 60, 15 * 60])).toEqual({from: 8 * 60, to: 16 * 60});
  });

  test('hält die Mindestbreite ein, statt Minuten zu Stunden aufzublasen', () => {
    const span = spanOf([10 * 60, 10 * 60 + 15]);
    expect(span.to - span.from).toBeGreaterThanOrEqual(6 * 60);
  });

  test('bleibt innerhalb des Tages', () => {
    const span = spanOf([0, 23 * 60 + 59], 24);
    expect(span.from).toBe(0);
    expect(span.to).toBe(1440);
  });

  test('ohne Punkte ein plausibler Bürotag', () => {
    expect(spanOf([])).toEqual({from: 8 * 60, to: 17 * 60});
  });

  test('ein gemeinsamer Ausschnitt umschließt alle Tage einer Woche', () => {
    const montag = spanOf([7 * 60, 12 * 60]);
    const donnerstag = spanOf([13 * 60, 19 * 60]);
    const woche = spanOf([7 * 60, 12 * 60, 13 * 60, 19 * 60]);
    expect(woche.from).toBeLessThanOrEqual(Math.min(montag.from, donnerstag.from));
    expect(woche.to).toBeGreaterThanOrEqual(Math.max(montag.to, donnerstag.to));
  });
});

describe('hourTicks — Achsenbeschriftungen dünnen aus, statt zu kollidieren', () => {
  test('stündlich in einem schmalen Fenster', () => {
    expect(hourTicks({from: 8 * 60, to: 14 * 60})).toEqual([8, 9, 10, 11, 12, 13, 14]);
  });

  test('zweistündlich ab zehn Stunden, dreistündlich ab fünfzehn', () => {
    expect(hourTicks({from: 6 * 60, to: 18 * 60})).toEqual([6, 8, 10, 12, 14, 16, 18]);
    expect(hourTicks({from: 0, to: 20 * 60})).toEqual([0, 3, 6, 9, 12, 15, 18]);
  });
});

describe('segmentPoints', () => {
  const seg = (start: number, end: number | null) => ({date: '2026-08-04', kind: 'arbeit' as const, start_min: start, end_min: end});

  test('ein offener Eintrag heute reicht bis jetzt', () => {
    expect(segmentPoints([seg(8 * 60, null)], {isToday: true, nowMin: 11 * 60})).toContain(11 * 60);
  });

  test('Zusatzmarken (Feierabend, Plan) kommen mit ins Fenster, null wird ignoriert', () => {
    const points = segmentPoints([seg(8 * 60, 12 * 60)], {extra: [17 * 60, null, undefined]});
    expect(points).toContain(17 * 60);
    expect(points.every((p) => Number.isFinite(p))).toBe(true);
  });
});

describe('Kalenderwoche und Wochenbeschriftung', () => {
  test('KW nach ISO 8601', () => {
    expect(kwOf('2026-01-01')).toBe(1);
    expect(kwOf('2026-08-04')).toBe(32);
    // 2027-01-01 is a Friday, so it still belongs to week 53 of 2026.
    expect(kwOf('2027-01-01')).toBe(53);
  });

  test('Wochenspanne nennt den Monat nur einmal, wenn sie ihn nicht verlässt', () => {
    expect(fmtWeekRange('2026-08-03')).toBe('3. – 9. August');
    expect(fmtWeekRange('2026-07-27')).toBe('27. Juli – 2. August');
  });
});
