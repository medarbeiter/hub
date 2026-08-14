// Verpflegungspauschale — die ganze Rechnung einer Spesenabrechnung.
//
// Rein wie lib/arbzg.ts: der Reise-Editor importiert das direkt in den Browser,
// damit der Betrag mitläuft, während die Reise getippt wird. Nichts hier fasst
// die Datenbank oder die Einstellungen an — die Satztabelle wird immer
// hereingereicht, damit eine eingereichte Abrechnung mit den Sätzen weiterlaufen
// kann, die bei ihrer Einreichung galten.
//
// Gerechnet wird **je Kalendertag**, nicht aus der Gesamtdauer. Die Stundenzahl
// entscheidet nur bei einer eintägigen Reise. Eine Reise über 50 Stunden und
// eine über 58,5 Stunden kosten dasselbe, wenn beide drei Kalendertage berühren.

import {addDays, fmtDuration} from './format';

/**
 * Ein Satzpaar mit Gültigkeitsbeginn. Die Sätze haben sich bereits einmal
 * geändert, also stehen sie als datierte Tabelle da und nicht als zwei Zahlen.
 */
export interface SatzStufe {
  /** Gültig ab diesem Tag einschließlich, YYYY-MM-DD. */
  ab: string;
  /** Halber Satz: An- und Abreisetag, sowie eintägige Reisen ab 8 Std. */
  halbCent: number;
  /** Voller Satz: jeder Kalendertag, der ganz auf Reise liegt. */
  vollCent: number;
}

/** Die bekannten Stufen. Ab 01.10.2025 gelten die niedrigeren Sätze. */
export const STANDARD_SAETZE: SatzStufe[] = [
  {ab: '1900-01-01', halbCent: 1400, vollCent: 2800},
  {ab: '2025-10-01', halbCent: 1000, vollCent: 2000},
];

/** Ab dieser Abwesenheit entsteht an einem eintägigen Reisetag ein Anspruch. */
export const TEILTAG_AB_MIN = 480;

/** Kein Anspruch entsteht über eine unbegrenzte Spanne — das wäre ein Tippfehler. */
export const MAX_REISETAGE = 90;

export type TagArt = 'eintaegig' | 'anreise' | 'zwischentag' | 'abreise';

export const TAG_ART_LABEL: Record<TagArt, string> = {
  eintaegig: 'Reisetag',
  anreise: 'Anreise',
  zwischentag: 'Voller Tag',
  abreise: 'Abreise',
};

export interface ReiseSpanne {
  /** YYYY-MM-DD */
  startDate: string;
  /** Minuten ab Mitternacht, 0–1439. */
  startMin: number;
  endDate: string;
  /** Minuten ab Mitternacht, 1–1440; 1440 = Rückkehr um Mitternacht. */
  endMin: number;
}

export interface SpesenTag {
  datum: string;
  art: TagArt;
  /** Die Abwesenheit an genau diesem Kalendertag, als Minuten ab Mitternacht. */
  vonMin: number;
  bisMin: number;
  abwesenheitMin: number;
  /**
   * Wohin die Abwesenheit hätte reichen müssen, damit ein Anspruch entsteht —
   * nur am eintägigen Reisetag gesetzt, und nur solange er sie verfehlt.
   */
  schwelleMin: number | null;
  satzCent: number;
  /**
   * Warum dieser Tag genau diesen Betrag ergibt — fertig zum Anzeigen, wie
   * Issue.message in lib/attention.ts. Die Abrechnung erklärt sich selbst.
   */
  grund: string;
}

export interface SpesenRechnung {
  tage: SpesenTag[];
  /** Gesamte Abwesenheit über alle Reisetage — Anzeige, nie Rechengrundlage. */
  abwesenheitMin: number;
  /** Die Stufe, mit der gerechnet wurde. */
  stufe: SatzStufe;
  pauschaleCent: number;
  belegeCent: number;
  summeCent: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Welche Satzstufe für eine Reise gilt: die letzte, die am **Abfahrtstag**
 * bereits in Kraft war. Bewusst der Abfahrtstag und nicht der Rückkehrtag —
 * eine Reise über den Stichtag hinweg rechnet damit durchgehend mit einem Satz
 * statt in der Mitte zu wechseln.
 */
export function satzFuer(tabelle: SatzStufe[], abfahrtISO: string): SatzStufe {
  const sortiert = [...tabelle].sort((a, b) => a.ab.localeCompare(b.ab));
  let gewaehlt = sortiert[0] ?? STANDARD_SAETZE[0]!;
  for (const stufe of sortiert) {
    if (stufe.ab <= abfahrtISO) gewaehlt = stufe;
  }
  return gewaehlt;
}

/** Jeder Kalendertag der Reise, von der Abfahrt bis zur Rückkehr. */
export function tageDerReise(spanne: ReiseSpanne): string[] {
  const tage: string[] = [];
  for (let d = spanne.startDate; d <= spanne.endDate; d = addDays(d, 1)) {
    tage.push(d);
    if (tage.length > MAX_REISETAGE) break;
  }
  return tage;
}

/**
 * Prüft die Spanne, bevor gerechnet wird. Gibt eine deutsche Meldung zurück
 * oder null — dieselbe Meldung im Editor wie auf dem Server, damit niemand
 * eine Fehlermeldung zweimal formuliert.
 */
export function pruefeSpanne(spanne: ReiseSpanne): string | null {
  if (!ISO_DATE.test(spanne.startDate) || !ISO_DATE.test(spanne.endDate)) {
    return 'Bitte Abfahrt und Rückkehr mit Datum und Uhrzeit angeben.';
  }
  if (!Number.isInteger(spanne.startMin) || spanne.startMin < 0 || spanne.startMin > 1439) {
    return 'Bitte eine Uhrzeit für die Abfahrt im Format HH:MM angeben.';
  }
  if (!Number.isInteger(spanne.endMin) || spanne.endMin < 1 || spanne.endMin > 1440) {
    return 'Bitte eine Uhrzeit für die Rückkehr im Format HH:MM angeben.';
  }
  if (spanne.endDate < spanne.startDate) {
    return 'Die Rückkehr muss nach der Abfahrt liegen.';
  }
  if (spanne.endDate === spanne.startDate && spanne.endMin <= spanne.startMin) {
    return 'Die Rückkehr muss nach der Abfahrt liegen.';
  }
  if (tageDerReise(spanne).length > MAX_REISETAGE) {
    return `Eine Reise kann höchstens ${MAX_REISETAGE} Tage dauern.`;
  }
  return null;
}

function eintaegigerTag(datum: string, vonMin: number, bisMin: number, stufe: SatzStufe): SpesenTag {
  const abwesenheitMin = bisMin - vonMin;
  const erfuellt = abwesenheitMin >= TEILTAG_AB_MIN;
  return {
    datum,
    art: 'eintaegig',
    vonMin,
    bisMin,
    abwesenheitMin,
    schwelleMin: erfuellt ? null : Math.min(1440, vonMin + TEILTAG_AB_MIN),
    satzCent: erfuellt ? stufe.halbCent : 0,
    grund: erfuellt
      ? 'Abwesenheit ab 8 Std.'
      : `Abwesenheit unter 8 Std. – kein Anspruch (fehlen ${fmtDuration(TEILTAG_AB_MIN - abwesenheitMin)} Std.)`,
  };
}

/**
 * Die Abrechnung einer Reise, Tag für Tag.
 *
 * Eintägig: ab 8 Std. Abwesenheit der halbe Satz, darunter nichts.
 * Mehrtägig: An- und Abreisetag je der halbe Satz — unabhängig von der
 * Stundenzahl —, jeder volle Kalendertag dazwischen der volle Satz. Damit gilt
 * `2 × halb + (Tage − 2) × voll`, und die Gesamtstundenzahl spielt keine Rolle
 * mehr, sobald die Reise über Mitternacht geht.
 *
 * `saetze` nimmt die datierte Tabelle (dann entscheidet der Abfahrtstag) oder
 * direkt eine Stufe (die beim Einreichen eingefrorene).
 */
export function berechneSpesen(
  spanne: ReiseSpanne,
  saetze: SatzStufe[] | SatzStufe,
  belegeCent = 0,
): SpesenRechnung {
  const stufe = Array.isArray(saetze) ? satzFuer(saetze, spanne.startDate) : saetze;
  const tage: SpesenTag[] = [];

  if (spanne.startDate === spanne.endDate) {
    tage.push(eintaegigerTag(spanne.startDate, spanne.startMin, spanne.endMin, stufe));
  } else {
    const daten = tageDerReise(spanne);
    const letzter = daten.length - 1;
    daten.forEach((datum, i) => {
      if (i === 0) {
        tage.push({
          datum,
          art: 'anreise',
          vonMin: spanne.startMin,
          bisMin: 1440,
          abwesenheitMin: 1440 - spanne.startMin,
          schwelleMin: null,
          satzCent: stufe.halbCent,
          grund: 'Anreisetag',
        });
      } else if (i === letzter) {
        tage.push({
          datum,
          art: 'abreise',
          vonMin: 0,
          bisMin: spanne.endMin,
          abwesenheitMin: spanne.endMin,
          schwelleMin: null,
          satzCent: stufe.halbCent,
          grund: 'Abreisetag',
        });
      } else {
        tage.push({
          datum,
          art: 'zwischentag',
          vonMin: 0,
          bisMin: 1440,
          abwesenheitMin: 1440,
          schwelleMin: null,
          satzCent: stufe.vollCent,
          grund: 'Voller Reisetag',
        });
      }
    });
  }

  const abwesenheitMin = tage.reduce((sum, t) => sum + t.abwesenheitMin, 0);
  const pauschaleCent = tage.reduce((sum, t) => sum + t.satzCent, 0);
  return {
    tage,
    abwesenheitMin,
    stufe,
    pauschaleCent,
    belegeCent,
    summeCent: pauschaleCent + belegeCent,
  };
}
