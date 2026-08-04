// Pure date/time helpers and German formatting — importable from client
// components (no database access here; that lives in lib/time.ts).

export interface SegmentLike {
  date: string;
  kind: 'arbeit' | 'pause';
  start_min: number;
  end_min: number | null;
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return isoDate(new Date());
}

export function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

export function monthOf(dateISO: string): string {
  return dateISO.slice(0, 7);
}

/** Monday=0 … Sunday=6 */
export function weekdayIndex(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00`);
  return (d.getDay() + 6) % 7;
}

export function addDays(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T12:00:00`);
  d.setDate(d.getDate() + days);
  return isoDate(d);
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y!, m! - 1 + delta, 15);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Monday of the week containing dateISO. */
export function mondayOf(dateISO: string): string {
  return addDays(dateISO, -weekdayIndex(dateISO));
}

/** Contracted minutes for one day: weekly Sollzeit spread over Mo–Fr. */
export function dailySollMinutes(user: {weekly_minutes: number}, dateISO: string): number {
  return weekdayIndex(dateISO) <= 4 ? Math.round(user.weekly_minutes / 5) : 0;
}

export function daysInMonth(month: string): string[] {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(y!, m!, 0).getDate();
  return Array.from({length: count}, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
}

export interface DaySummary {
  workedMin: number;
  pauseMin: number;
  hasOpen: boolean;
}

/**
 * Worked/pause minutes for a day's segments. An open segment counts up to
 * `nowMin` when the day is today; open segments on past days are uncountable
 * until corrected.
 */
export function daySummary(
  segments: SegmentLike[],
  dateISO: string,
  nowMin: number = nowMinutes(),
  today: string = todayISO(),
): DaySummary {
  let workedMin = 0;
  let pauseMin = 0;
  let hasOpen = false;
  for (const s of segments) {
    let end = s.end_min;
    if (end === null) {
      hasOpen = true;
      if (s.date === today && dateISO === today) end = Math.max(nowMin, s.start_min);
      else continue;
    }
    const dur = end - s.start_min;
    if (s.kind === 'arbeit') workedMin += dur;
    else pauseMin += dur;
  }
  return {workedMin, pauseMin, hasOpen};
}

// ---------------------------------------------------------------------------
// Formatting (German)
// ---------------------------------------------------------------------------

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isoToMin(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return null;
  const min = Number(match[1]) * 60 + Number(match[2]);
  return min >= 0 && min <= 1440 ? min : null;
}

export function fmtDuration(min: number): string {
  const sign = min < 0 ? '−' : '';
  const abs = Math.abs(min);
  return `${sign}${Math.floor(abs / 60)}:${String(abs % 60).padStart(2, '0')}`;
}

export function fmtDurationSigned(min: number): string {
  return min > 0 ? `+${fmtDuration(min)}` : fmtDuration(min);
}

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const MONTHS = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

export function fmtWeekdayShort(dateISO: string): string {
  return WEEKDAYS_SHORT[weekdayIndex(dateISO)]!;
}

export function fmtDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-');
  return `${Number(d)}.${Number(m)}.${y}`;
}

export function fmtDateLong(dateISO: string): string {
  const [, m, d] = dateISO.split('-');
  return `${fmtWeekdayShort(dateISO)}., ${Number(d)}. ${MONTHS[Number(m) - 1]}`;
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}
