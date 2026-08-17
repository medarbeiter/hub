// Pure date/time helpers and German formatting — importable from client
// components (no database access here; that lives in lib/time.ts).

export interface SegmentLike {
  date: string;
  kind: 'arbeit' | 'pause';
  start_min: number;
  end_min: number | null;
}

/**
 * A segment as the UI needs it. Lives here rather than in a component so the
 * client-side clock and every lane scale can share one type without importing
 * a rendering module.
 */
export interface TimelineSegment extends SegmentLike {
  id: number;
  note?: string | null;
  /** 1 = provisionally closed by the cutoff sweep, awaiting confirmation. */
  auto_closed?: number;
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

/** ISO calendar week (the number German payroll and rosters speak in). */
export function kwOf(dateISO: string): number {
  const d = new Date(`${dateISO}T12:00:00`);
  const thursday = new Date(d.getTime());
  thursday.setDate(thursday.getDate() - ((d.getDay() + 6) % 7) + 3);
  const firstThursday = new Date(thursday.getFullYear(), 0, 4);
  firstThursday.setDate(firstThursday.getDate() - ((firstThursday.getDay() + 6) % 7) + 3);
  return 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * 86_400_000));
}

/** Monday of the week containing dateISO. */
export function mondayOf(dateISO: string): string {
  return addDays(dateISO, -weekdayIndex(dateISO));
}

/** Contracted minutes for one day: weekly Sollzeit spread over Mo–Fr. */
export function dailySollMinutes(user: {weekly_minutes: number}, dateISO: string): number {
  return weekdayIndex(dateISO) <= 4 ? Math.round(user.weekly_minutes / 5) : 0;
}

/**
 * Ist das ein Monat, den der Kalender kennt? `/^\d{4}-\d{2}$/` allein genügt
 * nicht: „2026-13" besteht den Test, und der daraus gebildete letzte Tag
 * („2026-13-31") lässt jede Datumsrechnung mit `Invalid Date` auffliegen —
 * eine 500er-Seite, ausgelöst von einer getippten Adresse.
 */
export function istMonat(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return false;
  const monat = Number(value.slice(5, 7));
  return monat >= 1 && monat <= 12;
}

/** Der letzte Tag eines Monats, ohne Kalenderrechnerei über Monatslängen. */
export function letzterTagDesMonats(monat: string): string {
  const [jahr, m] = monat.split('-').map(Number);
  return `${monat}-${String(new Date(jahr!, m!, 0).getDate()).padStart(2, '0')}`;
}

/**
 * Ein Adressparameter als eine Zeichenkette. Next reicht `?a=1&a=2` als Feld
 * durch; wer das ungeprüft in eine Zeichenkettenfunktion gibt, bekommt einen
 * Absturz statt eines Suchergebnisses.
 */
export function einParameter(wert: string | string[] | undefined): string | undefined {
  if (Array.isArray(wert)) return wert[0];
  return wert;
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
// Timeline windows
// ---------------------------------------------------------------------------

export interface Span {
  /** Window start, minutes from midnight, always on a whole hour. */
  from: number;
  /** Window end, minutes from midnight, always on a whole hour. */
  to: number;
}

/**
 * The visible window of a timeline: the content's own extent, padded and
 * rounded out to whole hours, never narrower than `minHours`. One rule for
 * every scale — a single day lane and a stack of seven week lanes derive their
 * axis from the same function, which is what lets a week be compared at all.
 */
export function spanOf(points: number[], minHours = 6, padMin = 30): Span {
  const usable = points.filter((p) => Number.isFinite(p));
  if (usable.length === 0) return {from: 8 * 60, to: 17 * 60};
  let from = Math.max(0, Math.floor((Math.min(...usable) - padMin) / 60) * 60);
  let to = Math.min(1440, Math.ceil((Math.max(...usable) + padMin) / 60) * 60);
  const floor = Math.min(minHours, 24) * 60;
  while (to - from < floor) {
    if (to < 1440) to += 60;
    else if (from > 0) from -= 60;
    else break;
  }
  return {from, to};
}

/** Whole-hour ticks inside a span, thinned so axis labels never collide. */
export function hourTicks(span: Span): number[] {
  const hours = (span.to - span.from) / 60;
  const step = hours > 14 ? 3 : hours > 9 ? 2 : 1;
  const out: number[] = [];
  for (let h = Math.ceil(span.from / 60); h * 60 <= span.to; h++) {
    if (h % step === 0) out.push(h);
  }
  return out;
}

/**
 * The minute marks a day's lane has to keep on screen: every segment edge,
 * plus now and any projection while the day is running.
 */
export function segmentPoints(
  segments: SegmentLike[],
  opts: {isToday?: boolean; nowMin?: number; extra?: (number | null | undefined)[]} = {},
): number[] {
  const {isToday = false, nowMin = 0, extra = []} = opts;
  const points = segments.flatMap((s) => [
    s.start_min,
    s.end_min ?? (isToday ? nowMin : s.start_min + 30),
  ]);
  if (isToday) points.push(nowMin);
  for (const value of extra) if (value != null) points.push(value);
  return points;
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

/**
 * Beträge werden durchgehend in ganzen Cent gerechnet und erst hier zu Text —
 * eine Kommazahl im Datensatz wäre der Anfang von Rundungsdifferenzen in der
 * Lohnabrechnung. Deutsches Dezimalkomma, Tausenderpunkt, zwei Nachkommastellen.
 */
export function fmtEuro(cent: number): string {
  return `${fmtEuroPlain(cent, true)} €`;
}

/** Derselbe Betrag ohne Währungszeichen und ohne Tausenderpunkt — für die CSV. */
export function fmtEuroPlain(cent: number, mitTausenderpunkt = false): string {
  const sign = cent < 0 ? '−' : '';
  const abs = Math.abs(Math.round(cent));
  const ganz = String(Math.floor(abs / 100));
  const rest = String(abs % 100).padStart(2, '0');
  return `${sign}${mitTausenderpunkt ? ganz.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : ganz},${rest}`;
}

/**
 * "12,50" / "12.50" / "12" → Cent. Enthält die Eingabe ein Komma, gelten Punkte
 * als Tausendertrennung; sonst ist ein einzelner Punkt das Dezimaltrennzeichen.
 * Alles Mehrdeutige ("1.234") wird abgelehnt statt geraten.
 */
export function parseEuro(value: string): number | null {
  const raw = value.replace(/[\s€]/g, '');
  if (raw === '') return null;
  const normalisiert = raw.includes(',') ? raw.replaceAll('.', '').replace(',', '.') : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(normalisiert)) return null;
  return Math.round(Number(normalisiert) * 100);
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

/**
 * Wie fmtDateLong, aber mit Jahr — für Daten, die außerhalb des Zeitraums
 * liegen, den der Kopf der Seite schon nennt. Ohne die Jahreszahl las sich
 * „gilt seit Mi., 1. Oktober" wie ein Datum in der Zukunft.
 */
export function fmtDateLongJahr(dateISO: string): string {
  return `${fmtDateLong(dateISO)} ${dateISO.slice(0, 4)}`;
}

/**
 * „Di., 4.8.2026" — Wochentag vor dem Zahlendatum, in Zeilen einer Tabelle.
 * Die Abkürzung trägt ihren Punkt wie überall sonst; sie stand hier zweimal
 * ohne, während fmtDateLong ihn setzte.
 */
export function fmtDateMitWochentag(dateISO: string): string {
  return `${fmtWeekdayShort(dateISO)}., ${fmtDate(dateISO)}`;
}

/** „Aug." — für Achsen, auf denen der volle Name nicht nebeneinander passt. */
export function fmtMonthShort(dateISO: string): string {
  const m = MONTHS[Number(dateISO.slice(5, 7)) - 1]!;
  // März und Juni/Juli bleiben ganz: abgekürzt wären sie länger als nötig
  // bzw. („Jun."/„Jul.") nicht kürzer als der Name selbst.
  return m.length <= 4 ? m : `${m.slice(0, 3)}.`;
}

export function fmtMonth(month: string): string {
  const [y, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]} ${y}`;
}

/** "3. – 9. August" — collapsed to one month name when the week doesn't straddle. */
export function fmtWeekRange(mondayISO: string): string {
  const sunday = addDays(mondayISO, 6);
  const [, m1, d1] = mondayISO.split('-');
  const [, m2, d2] = sunday.split('-');
  const to = `${Number(d2)}. ${MONTHS[Number(m2) - 1]}`;
  return m1 === m2 ? `${Number(d1)}. – ${to}` : `${Number(d1)}. ${MONTHS[Number(m1) - 1]} – ${to}`;
}

/**
 * "4. August" · "3. – 5. August" · "30. Juli – 2. August" — der Zeitraum einer
 * Reise. Wie fmtWeekRange ohne Jahreszahl: die Jahresangabe steht im Kopf.
 */
export function fmtDateRange(vonISO: string, bisISO: string): string {
  const [, m1, d1] = vonISO.split('-');
  const [, m2, d2] = bisISO.split('-');
  if (vonISO === bisISO) return `${Number(d1)}. ${MONTHS[Number(m1) - 1]}`;
  const to = `${Number(d2)}. ${MONTHS[Number(m2) - 1]}`;
  return m1 === m2 ? `${Number(d1)}. – ${to}` : `${Number(d1)}. ${MONTHS[Number(m1) - 1]} – ${to}`;
}

/**
 * Ein getipptes Datum lesen — „4.8.“, „04.08.2026“, „4/8“, „2026-08-04“.
 *
 * Das Feld, in das getippt wird, gehört zu `components/datum-feld.tsx` und
 * damit diesem Haus: Astryx' DateInput nimmt seinen Kalender von einer
 * Komponente, deren Woche am Sonntag beginnt. Wer das Feld selbst stellt, muss
 * auch das Lesen selbst können.
 *
 * Deutsch heißt hier Tag zuerst, immer — auch bei „4/8“, denn das Feld trägt
 * nur eine Sprache. Ohne Jahr wird das Jahr des Bezugsdatums genommen (in aller
 * Regel heute): wer im August „4.8.“ tippt, meint diesen August.
 *
 * Gibt `null` zurück, wenn daraus kein wirklicher Tag wird — der 31. Februar
 * ist keiner, und stillschweigend auf den 3. März zu rutschen wäre schlimmer
 * als die Eingabe stehen zu lassen.
 */
export function parseDatumEingabe(text: string, bezug: string): string | null {
  const roh = text.trim();
  if (roh === '') return null;

  // Die ISO-Form kommt aus Adressen und aus der Zwischenablage.
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(roh);
  if (iso) return gueltigerTag(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  const teile = /^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*(?:[.\/-]\s*(\d{2}|\d{4}))?\.?$/.exec(roh);
  if (!teile) return null;

  const tag = Number(teile[1]);
  const monat = Number(teile[2]);
  const jahrRoh = teile[3];
  const jahr =
    jahrRoh === undefined
      ? Number(bezug.slice(0, 4))
      : jahrRoh.length === 2
        ? 2000 + Number(jahrRoh)
        : Number(jahrRoh);

  return gueltigerTag(jahr, monat, tag);
}

/** Nur zurückgeben, was der Kalender auch hergibt — sonst null. */
function gueltigerTag(jahr: number, monat: number, tag: number): string | null {
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  const d = new Date(Date.UTC(jahr, monat - 1, tag));
  if (d.getUTCFullYear() !== jahr || d.getUTCMonth() !== monat - 1 || d.getUTCDate() !== tag) {
    return null;
  }
  return isoDate(d);
}

/**
 * The time-of-day greeting. Warmth belongs in the words: this line is the
 * page's heading, not a label above one.
 */
export function fmtGreeting(nowMin: number, firstName: string): string {
  const hour = Math.floor(nowMin / 60);
  const part = hour < 11 ? 'Guten Morgen' : hour < 18 ? 'Guten Tag' : 'Guten Abend';
  return `${part}, ${firstName}`;
}
