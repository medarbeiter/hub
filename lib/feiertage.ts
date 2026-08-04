// German public holidays, computed rather than tabulated: a hard-coded list
// runs out, and this app is meant to keep working next year.
//
// Coverage is the statutory holidays per Bundesland (§ Feiertagsgesetze der
// Länder). Deliberately NOT included: holidays that only apply in individual
// municipalities (Fronleichnam in parts of SN/TH, Mariä Himmelfahrt in
// Bavarian communities with a Catholic majority, Friedensfest in Augsburg).
// Those are a local HR decision — recording them as Feiertag by hand is
// honest, guessing them for a whole Bundesland is not.

import {isoDate} from './format';

export const BUNDESLAENDER = {
  BW: 'Baden-Württemberg',
  BY: 'Bayern',
  BE: 'Berlin',
  BB: 'Brandenburg',
  HB: 'Bremen',
  HH: 'Hamburg',
  HE: 'Hessen',
  MV: 'Mecklenburg-Vorpommern',
  NI: 'Niedersachsen',
  NW: 'Nordrhein-Westfalen',
  RP: 'Rheinland-Pfalz',
  SL: 'Saarland',
  SN: 'Sachsen',
  ST: 'Sachsen-Anhalt',
  SH: 'Schleswig-Holstein',
  TH: 'Thüringen',
} as const;

export type Bundesland = keyof typeof BUNDESLAENDER;

export function isBundesland(value: string): value is Bundesland {
  return value in BUNDESLAENDER;
}

/** Easter Sunday by the anonymous Gregorian algorithm (Meeus/Jones/Butcher). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = März, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function offsetFromEaster(year: number, days: number): string {
  const d = easterSunday(year);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

/** Buß- und Bettag: the Wednesday before 23 November. Saxony only. */
function bussUndBettag(year: number): string {
  const d = new Date(year, 10, 23); // 23. November
  // Step back to the preceding Wednesday (getDay: Mi = 3).
  d.setDate(d.getDate() - ((d.getDay() + 4) % 7 || 7));
  return isoDate(d);
}

const ALL: Bundesland[] = Object.keys(BUNDESLAENDER) as Bundesland[];

interface HolidayRule {
  name: string;
  /** Fixed date as [month, day], or an offset in days from Easter Sunday. */
  fixed?: [number, number];
  easterOffset?: number;
  special?: (year: number) => string;
  /** Bundesländer where it is a statutory holiday; omitted = everywhere. */
  laender?: Bundesland[];
  /** Only from this year on (Weltkindertag TH 2019, Frauentag BE 2019 / MV 2023). */
  from?: number;
}

const RULES: HolidayRule[] = [
  {name: 'Neujahr', fixed: [1, 1]},
  {name: 'Heilige Drei Könige', fixed: [1, 6], laender: ['BW', 'BY', 'ST']},
  {name: 'Internationaler Frauentag', fixed: [3, 8], laender: ['BE'], from: 2019},
  {name: 'Internationaler Frauentag', fixed: [3, 8], laender: ['MV'], from: 2023},
  {name: 'Karfreitag', easterOffset: -2},
  {name: 'Ostersonntag', easterOffset: 0, laender: ['BB']},
  {name: 'Ostermontag', easterOffset: 1},
  {name: 'Tag der Arbeit', fixed: [5, 1]},
  {name: 'Christi Himmelfahrt', easterOffset: 39},
  {name: 'Pfingstsonntag', easterOffset: 49, laender: ['BB']},
  {name: 'Pfingstmontag', easterOffset: 50},
  {name: 'Fronleichnam', easterOffset: 60, laender: ['BW', 'BY', 'HE', 'NW', 'RP', 'SL']},
  {name: 'Mariä Himmelfahrt', fixed: [8, 15], laender: ['SL']},
  {name: 'Weltkindertag', fixed: [9, 20], laender: ['TH'], from: 2019},
  {name: 'Tag der Deutschen Einheit', fixed: [10, 3]},
  {name: 'Reformationstag', fixed: [10, 31], laender: ['BB', 'HB', 'HH', 'MV', 'NI', 'SN', 'ST', 'SH', 'TH']},
  {name: 'Allerheiligen', fixed: [11, 1], laender: ['BW', 'BY', 'NW', 'RP', 'SL']},
  {name: 'Buß- und Bettag', special: bussUndBettag, laender: ['SN']},
  {name: '1. Weihnachtstag', fixed: [12, 25]},
  {name: '2. Weihnachtstag', fixed: [12, 26]},
];

/** Public holidays in one year for one Bundesland, as ISO date → name. */
export function holidaysForYear(year: number, land: Bundesland): Map<string, string> {
  const result = new Map<string, string>();
  for (const rule of RULES) {
    if (rule.from !== undefined && year < rule.from) continue;
    if (rule.laender && !rule.laender.includes(land)) continue;
    let date: string;
    if (rule.fixed) {
      date = isoDate(new Date(year, rule.fixed[0] - 1, rule.fixed[1]));
    } else if (rule.easterOffset !== undefined) {
      date = offsetFromEaster(year, rule.easterOffset);
    } else if (rule.special) {
      date = rule.special(year);
    } else {
      continue;
    }
    result.set(date, rule.name);
  }
  return result;
}

/** Public holidays across a date range (inclusive), as ISO date → name. */
export function holidaysInRange(fromISO: string, toISO: string, land: Bundesland): Map<string, string> {
  const result = new Map<string, string>();
  const firstYear = Number(fromISO.slice(0, 4));
  const lastYear = Number(toISO.slice(0, 4));
  for (let year = firstYear; year <= lastYear; year++) {
    for (const [date, name] of holidaysForYear(year, land)) {
      if (date >= fromISO && date <= toISO) result.set(date, name);
    }
  }
  return result;
}

export function holidayName(dateISO: string, land: Bundesland): string | null {
  return holidaysForYear(Number(dateISO.slice(0, 4)), land).get(dateISO) ?? null;
}

export const ALL_BUNDESLAENDER = ALL;
