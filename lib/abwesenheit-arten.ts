// Abwesenheiten — das Vokabular und die Arithmetik der Spanne. Rein und ohne
// Datenbank, damit der Editor mitrechnen kann, während jemand die Tage wählt,
// und der Server dieselbe Zahl zurückgibt.
//
// Der Datensatz liegt in lib/abwesenheit.ts; hier steht nur, was eine Art
// bedeutet und wie viele Tage eine Spanne kostet.

import type {AbwesenheitArt, AbwesenheitStatus} from './db';

export const ABWESENHEIT_ARTEN: AbwesenheitArt[] = ['urlaub', 'krank', 'freizeitausgleich', 'fortbildung'];

export const ART_LABEL: Record<AbwesenheitArt, string> = {
  urlaub: 'Urlaub',
  krank: 'Krank',
  freizeitausgleich: 'Freizeitausgleich',
  fortbildung: 'Fortbildung',
};

/**
 * Wie eine Art heißt, sobald sie das Haus verlässt — im Google-Kalender
 * (`ereignisTitel`) und in jeder E-Mail (`lib/benachrichtigungen.ts`).
 *
 * Krank heißt draußen „Abwesend", und zwar überall: eine Krankmeldung ist eine
 * Gesundheitsangabe nach Art. 9 DSGVO, und die hat auf den Servern von Google
 * so wenig zu suchen wie auf denen eines Mailversenders. Wer die Art wissen
 * darf, sieht sie in der Anwendung — dieselbe Abstufung, mit der der
 * Teamkalender Kolleginnen nur das „dass" zeigt.
 *
 * Die Regel steht hier und nicht in den beiden Modulen, damit es sie einmal
 * gibt: zwei Kopien wären zwei Stellen, an denen sie jemand vergisst.
 */
export function ausserHausLabel(art: AbwesenheitArt): string {
  return art === 'krank' ? 'Abwesend' : ART_LABEL[art];
}

/**
 * Die Art, so wie sie eine bestimmte Person sehen darf — `null` heißt „nur das
 * dass, nicht das warum". Das Gegenstück zu `ausserHausLabel` nach innen: im
 * Teamkalender sieht jede Kollegin, *dass* jemand fehlt, aber nur die
 * betroffene Person selbst und wer das Recht `kalender.gruende` trägt erfahren,
 * *warum*.
 *
 * Entscheidend ist, dass diese Funktion auf dem Server läuft und ihr Ergebnis
 * in die Nutzlast geht: die Art einer fremden Abwesenheit darf den Browser gar
 * nicht erreichen. Ein Ausblenden im CSS oder im JSX wäre keine Abstufung,
 * sondern ein Vorhang vor Daten, die schon ausgeliefert sind — und die man in
 * den Entwicklerwerkzeugen aufschlagen kann. Deshalb steht die Regel hier und
 * ist geprüft, statt an der einen Stelle im Seitencode zu wohnen.
 */
export function sichtbareArt(
  art: AbwesenheitArt,
  darfGruendeSehen: boolean,
  istSelbst: boolean,
): AbwesenheitArt | null {
  return darfGruendeSehen || istSelbst ? art : null;
}

export const STATUS_LABEL: Record<AbwesenheitStatus, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  gemeldet: 'Gemeldet',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
};

/**
 * Zwei Sorten Vorgang, die nur oberflächlich gleich aussehen.
 *
 * `antrag` — jemand bittet um etwas, das ihm die Verwaltung gewähren muss, und
 * gibt dafür ein Guthaben aus: Urlaub den Jahresanspruch, Freizeitausgleich das
 * Zeitkonto. Wirksam wird das erst mit der Genehmigung.
 * `meldung` — jemand teilt eine Tatsache mit. Krankheit fragt nicht um
 * Erlaubnis, und eine Fortbildung ist Arbeit. Beides gilt sofort.
 */
export const ART_VORGANG: Record<AbwesenheitArt, 'antrag' | 'meldung'> = {
  urlaub: 'antrag',
  freizeitausgleich: 'antrag',
  krank: 'meldung',
  fortbildung: 'meldung',
};

export function istAntrag(art: AbwesenheitArt): boolean {
  return ART_VORGANG[art] === 'antrag';
}

/** Der Zustand, in dem eine neu angelegte Abwesenheit dieser Art beginnt. */
export function startStatus(art: AbwesenheitArt): AbwesenheitStatus {
  return istAntrag(art) ? 'entwurf' : 'gemeldet';
}

/**
 * Ob die Spanne auf die Tage durchschlägt — also im Zeitkonto zählt. Ein
 * Antrag tut das erst nach der Genehmigung; eine Meldung von Anfang an.
 */
export function istWirksam(status: AbwesenheitStatus): boolean {
  return status === 'gemeldet' || status === 'genehmigt';
}

/** Ab wie vielen Kalendertagen Krankheit die Bescheinigung fällig ist (§5 EFZG). */
export const AU_AB_TAGEN = 3;

// ---------------------------------------------------------------------------
// Spannen
// ---------------------------------------------------------------------------

function tagPlus(iso: string, tage: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Jeder Kalendertag der Spanne, einschließlich beider Enden. */
export function tageDerSpanne(vonISO: string, bisISO: string): string[] {
  if (bisISO < vonISO) return [];
  const tage: string[] = [];
  for (let tag = vonISO; tag <= bisISO; tag = tagPlus(tag, 1)) {
    tage.push(tag);
    if (tage.length > 400) break; // Reißleine gegen eine kaputte Eingabe
  }
  return tage;
}

export function laengeInTagen(vonISO: string, bisISO: string): number {
  return tageDerSpanne(vonISO, bisISO).length;
}

/**
 * Die Tage, die Anspruch kosten: nur Urlaub, und nur an Tagen mit einem Soll.
 * Ein Wochenende oder ein Feiertag mitten im Urlaub wird nicht abgezogen — man
 * hätte an ihm ohnehin nicht gearbeitet.
 *
 * `sollAmTag` kommt von außen, damit dieselbe Funktion im Browser mit einer
 * vorberechneten Tabelle und auf dem Server mit dem Kalender laufen kann.
 */
export function anspruchstage(
  vonISO: string,
  bisISO: string,
  sollAmTag: (dateISO: string) => number,
): string[] {
  return tageDerSpanne(vonISO, bisISO).filter((tag) => sollAmTag(tag) > 0);
}

export interface Anspruch {
  /** Jahresanspruch aus dem Personalstamm. */
  jahresanspruch: number;
  /** Von der Verwaltung eingetragener Übertrag aus dem Vorjahr. */
  uebertrag: number;
  /** Bereits genehmigte Urlaubstage in diesem Jahr. */
  genehmigt: number;
  /** Eingereicht, aber noch nicht entschieden — bindet den Anspruch noch nicht. */
  beantragt: number;
}

/** Was noch frei ist. Beantragtes zählt bewusst nicht: es ist noch nicht gewährt. */
export function restanspruch(a: Anspruch): number {
  return a.jahresanspruch + a.uebertrag - a.genehmigt;
}

export function fmtTage(anzahl: number): string {
  return `${anzahl} ${anzahl === 1 ? 'Tag' : 'Tage'}`;
}

/**
 * Der Umfang einer Abwesenheit, in der Einheit, in der sie erfasst wurde. Ein
 * Freizeitausgleich über 90 Minuten als „1 Tag" auszuweisen wäre die eine
 * Stelle, an der die Liste etwas anderes behauptet als der Antrag — deshalb
 * gibt es genau einen Formatierer dafür, den jede Ansicht benutzt.
 */
export function fmtUmfang(arbeitstage: number, minuten: number | null): string {
  return minuten != null ? `${minuten} Min.` : fmtTage(arbeitstage);
}
