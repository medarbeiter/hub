import {describe, expect, test} from 'bun:test';
import {easterSunday, holidayName, holidaysForYear, holidaysInRange} from '../lib/feiertage';
import {isoDate} from '../lib/format';

describe('easterSunday', () => {
  // Known Easter dates — the algorithm is worth pinning down.
  const known: Array<[number, string]> = [
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2030, '2030-04-21'],
    [2038, '2038-04-25'], // latest possible date in this century
  ];
  for (const [year, date] of known) {
    test(`${year}`, () => expect(isoDate(easterSunday(year))).toBe(date));
  }
});

describe('movable feasts follow Easter', () => {
  test('2026: Karfreitag, Ostermontag, Himmelfahrt, Pfingstmontag, Fronleichnam', () => {
    const nw = holidaysForYear(2026, 'NW');
    expect(nw.get('2026-04-03')).toBe('Karfreitag');
    expect(nw.get('2026-04-06')).toBe('Ostermontag');
    expect(nw.get('2026-05-14')).toBe('Christi Himmelfahrt');
    expect(nw.get('2026-05-25')).toBe('Pfingstmontag');
    expect(nw.get('2026-06-04')).toBe('Fronleichnam');
  });
});

describe('per-Bundesland differences', () => {
  test('Fronleichnam is a holiday in Bayern, not in Berlin', () => {
    expect(holidayName('2026-06-04', 'BY')).toBe('Fronleichnam');
    expect(holidayName('2026-06-04', 'BE')).toBeNull();
  });

  test('Reformationstag in the north and east, not in Bayern', () => {
    expect(holidayName('2026-10-31', 'NI')).toBe('Reformationstag');
    expect(holidayName('2026-10-31', 'SN')).toBe('Reformationstag');
    expect(holidayName('2026-10-31', 'BY')).toBeNull();
  });

  test('Allerheiligen in the Catholic south, not in Hamburg', () => {
    expect(holidayName('2026-11-01', 'BW')).toBe('Allerheiligen');
    expect(holidayName('2026-11-01', 'HH')).toBeNull();
  });

  test('Mariä Himmelfahrt only Saarland (Bavarian communities are a local matter)', () => {
    expect(holidayName('2026-08-15', 'SL')).toBe('Mariä Himmelfahrt');
    expect(holidayName('2026-08-15', 'BY')).toBeNull();
  });

  test('Heilige Drei Könige in BW, BY and ST', () => {
    expect(holidayName('2026-01-06', 'BY')).toBe('Heilige Drei Könige');
    expect(holidayName('2026-01-06', 'ST')).toBe('Heilige Drei Könige');
    expect(holidayName('2026-01-06', 'NW')).toBeNull();
  });

  test('Brandenburg counts Easter and Pentecost Sunday too', () => {
    expect(holidayName('2026-04-05', 'BB')).toBe('Ostersonntag');
    expect(holidayName('2026-04-05', 'NW')).toBeNull();
  });
});

describe('Buß- und Bettag (Sachsen)', () => {
  // Always the Wednesday before 23 November.
  const known: Array<[number, string]> = [
    [2024, '2024-11-20'],
    [2025, '2025-11-19'],
    [2026, '2026-11-18'],
    [2027, '2027-11-17'],
  ];
  for (const [year, date] of known) {
    test(`${year}`, () => {
      expect(holidayName(date, 'SN')).toBe('Buß- und Bettag');
      expect(new Date(`${date}T12:00:00`).getDay()).toBe(3); // Mittwoch
      expect(holidayName(date, 'TH')).toBeNull();
    });
  }
});

describe('holidays introduced in a given year', () => {
  test('Frauentag: Berlin from 2019, Mecklenburg-Vorpommern from 2023', () => {
    expect(holidayName('2018-03-08', 'BE')).toBeNull();
    expect(holidayName('2019-03-08', 'BE')).toBe('Internationaler Frauentag');
    expect(holidayName('2022-03-08', 'MV')).toBeNull();
    expect(holidayName('2023-03-08', 'MV')).toBe('Internationaler Frauentag');
  });

  test('Weltkindertag in Thüringen from 2019', () => {
    expect(holidayName('2018-09-20', 'TH')).toBeNull();
    expect(holidayName('2019-09-20', 'TH')).toBe('Weltkindertag');
  });
});

describe('nationwide holidays', () => {
  test('every Bundesland has Neujahr, 1. Mai, Einheit and Weihnachten', () => {
    for (const land of ['BW', 'BY', 'BE', 'HH', 'SN', 'SH'] as const) {
      expect(holidayName('2026-01-01', land)).toBe('Neujahr');
      expect(holidayName('2026-05-01', land)).toBe('Tag der Arbeit');
      expect(holidayName('2026-10-03', land)).toBe('Tag der Deutschen Einheit');
      expect(holidayName('2026-12-25', land)).toBe('1. Weihnachtstag');
      expect(holidayName('2026-12-26', land)).toBe('2. Weihnachtstag');
    }
  });
});

describe('holidaysInRange', () => {
  test('spans a year boundary and clips to the range', () => {
    const range = holidaysInRange('2025-12-20', '2026-01-10', 'BY');
    expect([...range.keys()].sort()).toEqual(['2025-12-25', '2025-12-26', '2026-01-01', '2026-01-06']);
  });

  test('a range with no holidays is empty', () => {
    expect(holidaysInRange('2026-02-10', '2026-02-20', 'BE').size).toBe(0);
  });
});
