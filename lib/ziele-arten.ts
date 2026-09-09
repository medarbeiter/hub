import {fmtDuration, fmtTime} from './format';

/**
 * Ein Ziel ist ein Satz aus Bausteinen: **was** gemessen wird, **wie** verglichen
 * wird, **wie viel**, **wie oft** — und ein Zeitraum. Die Bausteine sind
 * orthogonal; welche zu einer Messung passen, sagt `MESSUNGEN`. Der Server prüft
 * dieselbe Tabelle (`createGoal`), der Dialog bietet nur an, was sie erlaubt.
 */
export const MESSUNGEN = {
  arbeitszeit: {
    verb: 'arbeiten', label: 'Arbeitszeit', einheit: 'dauer',
    je: ['tag', 'woche', 'zeitraum'], vergleiche: ['min', 'max'],
    hinweis: 'Abgeschlossene Arbeitszeit ohne Pausen. Feiertage und erfasste Abwesenheiten sind ausgenommen.',
  },
  pausen: {
    verb: 'Pause machen', label: 'Pausen', einheit: 'dauer',
    je: ['tag'], vergleiche: ['min'],
    hinweis: 'Ohne Angabe gilt die gesetzliche Pause nach Arbeitszeitgesetz. Nur Tage mit abgeschlossener Arbeitszeit zählen.',
  },
  erfassung: {
    verb: 'meine Zeiten vollständig erfassen', label: 'Vollständige Erfassung', einheit: null,
    je: ['tag'], vergleiche: [],
    hinweis: 'An jedem Arbeitstag sind Zeiten erfasst und alle Einträge abgeschlossen.',
  },
  anfang: {
    verb: 'anfangen', label: 'Arbeitsbeginn', einheit: 'uhrzeit',
    je: ['tag'], vergleiche: ['max', 'min'],
    hinweis: 'Der erste Arbeitseintrag des Tages zählt.',
  },
  feierabend: {
    verb: 'Feierabend machen', label: 'Feierabend', einheit: 'uhrzeit',
    je: ['tag'], vergleiche: ['max', 'min'],
    hinweis: 'Das Ende des letzten Arbeitseintrags des Tages zählt.',
  },
  aufgaben: {
    verb: 'Aufgaben in ClickUp erledigen', label: 'ClickUp-Aufgaben', einheit: 'anzahl',
    je: ['zeitraum', 'tag', 'woche'], vergleiche: ['min', 'max'],
    hinweis: 'Zählt Aufgaben, die dir in ClickUp zugewiesen sind und im Zeitraum auf erledigt gesetzt wurden. Erledigt heute zählt sofort.',
  },
  clickupzeit: {
    verb: 'Zeit in ClickUp erfassen', label: 'ClickUp-Zeit', einheit: 'dauer',
    je: ['zeitraum', 'tag', 'woche'], vergleiche: ['min', 'max'],
    hinweis: 'Zählt die Zeit, die in ClickUp auf Aufgaben gebucht wurde – unabhängig von der Stempeluhr hier. Laufende Zeiterfassungen zählen erst nach dem Stopp.',
  },
  frei: {
    verb: '', label: 'Eigenes Vorhaben', einheit: null,
    je: [], vergleiche: [],
    hinweis: 'Du entscheidest, wann du dein Ziel erreicht hast, und markierst es selbst als erledigt.',
  },
} as const satisfies Record<string, {verb: string; label: string; einheit: 'dauer' | 'uhrzeit' | 'anzahl' | null; je: readonly Je[]; vergleiche: readonly Vergleich[]; hinweis: string}>;
export type Messung = keyof typeof MESSUNGEN;
/** Was das ganze Haus zusammen messen kann — nichts, was aus einer einzelnen Stempeluhr käme. */
export const TEAM_MESSUNGEN: readonly Messung[] = ['aufgaben', 'clickupzeit', 'frei'];
export type Vergleich = 'min' | 'max';
export type Je = 'tag' | 'woche' | 'zeitraum';

export const JE_LABEL: Record<Je, string> = {tag: 'an jedem Arbeitstag', woche: 'in jeder Woche', zeitraum: 'insgesamt'};
/** Mindestens/höchstens — bei einer Uhrzeit heißt „höchstens" spätestens. */
export function vergleichLabel(messung: Messung, vergleich: Vergleich): string {
  const uhrzeit = MESSUNGEN[messung].einheit === 'uhrzeit';
  return vergleich === 'min' ? (uhrzeit ? 'frühestens' : 'mindestens') : uhrzeit ? 'spätestens' : 'höchstens';
}
export function istMessung(wert: unknown): wert is Messung {
  return typeof wert === 'string' && Object.hasOwn(MESSUNGEN, wert);
}

export interface ZielRegel {
  messung: Messung;
  vergleich: Vergleich;
  je: Je;
  /** Minuten (Dauer) oder Minute des Tages (Uhrzeit); NULL = ohne Wert (Erfassung, gesetzliche Pause, eigenes Vorhaben). */
  wert: number | null;
}
export type Wiederholung = 'keine' | 'woche' | 'monat';
export const WIEDERHOLUNG_LABEL: Record<Wiederholung, string> = {keine: 'einmalig', woche: 'wiederholt sich jede Woche', monat: 'wiederholt sich jeden Monat'};

export interface GoalInput extends ZielRegel {
  /** Leer = der Satz aus den Bausteinen. Ein eigenes Vorhaben braucht einen Titel. */
  titel: string;
  von: string;
  bis: string;
  oeffentlich: boolean;
  wiederholung: Wiederholung;
  /** Ein Teamziel: der Fortschritt aller Konten zusammen, immer für alle sichtbar. */
  team?: boolean;
  /** Bei einem Teamziel: nur diese Rollen zählen mit; leer = das ganze Haus. */
  rollen?: string[];
}

function wertText(regel: ZielRegel): string {
  const {einheit} = MESSUNGEN[regel.messung];
  if (regel.wert === null) return regel.messung === 'pausen' ? 'die vorgeschriebene' : '';
  if (einheit === 'uhrzeit') return `um ${fmtTime(regel.wert)} Uhr`;
  if (einheit === 'anzahl') return String(regel.wert);
  if (regel.wert % 60 === 0) { const h = regel.wert / 60; return `${h} ${h === 1 ? 'Stunde' : 'Stunden'}`; }
  return regel.wert < 60 ? `${regel.wert} Minuten` : `${fmtDuration(regel.wert)} Stunden`;
}

/** Der Satz aus den Bausteinen — der Titel, wenn niemand einen eigenen schreibt. */
export function zielSatz(regel: ZielRegel): string {
  if (regel.messung === 'frei') return '';
  const m = MESSUNGEN[regel.messung];
  const teile = [JE_LABEL[regel.je]];
  if (m.vergleiche.length && regel.wert !== null) teile.push(vergleichLabel(regel.messung, regel.vergleich));
  const wert = wertText(regel);
  if (wert) teile.push(wert);
  teile.push(m.verb);
  const satz = teile.join(' ');
  return satz.charAt(0).toUpperCase() + satz.slice(1);
}

/** Die kurze Regel unter dem Titel: „mindestens 8 Stunden am Tag", „Eigenes Vorhaben". */
export function zielRegel(regel: ZielRegel): string {
  if (regel.messung === 'frei') return MESSUNGEN.frei.label;
  if (regel.messung === 'pausen' && regel.wert === null) return 'vorgeschriebene Pause am Tag';
  const m = MESSUNGEN[regel.messung];
  const wert = wertText(regel);
  const kern = m.vergleiche.length && regel.wert !== null ? `${vergleichLabel(regel.messung, regel.vergleich)} ${wert} ${m.label}` : wert ? `${wert} ${m.label}` : m.label;
  const je = regel.je === 'tag' ? 'am Tag' : regel.je === 'woche' ? 'pro Woche' : 'insgesamt';
  return `${kern.charAt(0).toLowerCase()}${kern.slice(1)} ${je}`;
}

/**
 * Womit man auf ein Teamereignis reagieren kann. Eine feste Liste, keine
 * freie Eingabe: der Server prüft dagegen, und die Auswahl ist überall dieselbe.
 * Die ersten fünf sind die Schnellreaktionen unter jedem Beitrag.
 */
export const EMOJIS = [
  '👏', '❤️', '🎉', '💪', '🙌',
  '😀', '😄', '🤩', '😍', '🥳', '🔥', '⭐', '✨', '🚀', '🏆', '🎯',
  '👍', '🙏', '💯', '🌟', '🍀', '☕', '🎂', '🤝',
] as const;
export const SCHNELL_EMOJIS = EMOJIS.slice(0, 5);
export type Emoji = (typeof EMOJIS)[number];
export function istEmoji(wert: unknown): wert is Emoji {
  return typeof wert === 'string' && (EMOJIS as readonly string[]).includes(wert);
}

/** Ein Stand je Ziel — vier Wörter, ein Abzeichen, dieselbe Skala wie die Reise. */
export function zielStand(ziel: {erreicht: boolean; von: string; bis: string}, heute: string) {
  if (ziel.erreicht) return {label: 'Erreicht', variant: 'success' as const};
  if (ziel.von > heute) return {label: 'Geplant', variant: 'neutral' as const};
  if (ziel.bis < heute) return {label: 'Nicht erreicht', variant: 'warning' as const};
  return {label: 'In Arbeit', variant: 'neutral' as const};
}
