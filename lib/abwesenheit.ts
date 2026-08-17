// Abwesenheiten — der Datensatz. DB-gebunden wie lib/spesen.ts: jede Funktion
// gibt eine deutsche Meldung oder null zurück, und Berechtigung,
// Monatsabschluss und Überschneidung werden hier geprüft, nicht in der Server
// Action.
//
// Gerechnet wird in lib/abwesenheit-arten.ts, damit derselbe Code im Editor
// mitläuft, während jemand die Tage wählt.
//
// Der wichtigste Unterschied zur Reise steht in `pruefeZeitfenster`: eine
// Abrechnung wird nach der Rückkehr eingereicht, ein Urlaub vorher beantragt.
// Dieselbe Statusmaschine, gespiegelte zeitliche Bedingung.

import {mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {
  type Abwesenheit,
  type AbwesenheitArt,
  type AbwesenheitStatus,
  getDb,
  type User,
} from './db';
import {hatRecht} from './rechte';
import {
  ART_LABEL,
  AU_AB_TAGEN,
  type Anspruch,
  anspruchstage,
  istAntrag,
  istWirksam,
  laengeInTagen,
  startStatus,
  tageDerSpanne,
} from './abwesenheit-arten';
import {bundeslandFor} from './daytypes';
import {holidaysInRange} from './feiertage';
import {dailySollMinutes, fmtDateRange, monthOf} from './format';

/** Was als Arbeitsunfähigkeitsbescheinigung hochgeladen werden darf. */
export const AU_TYPEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const AU_MAX_BYTES = 10 * 1024 * 1024;

export interface AbwesenheitInput {
  von: string;
  bis: string;
  art: AbwesenheitArt;
  notiz?: string;
  /** Nur bei Freizeitausgleich an einem einzelnen Tag; sonst wird der ganze Tag ausgegeben. */
  minuten?: number;
  /** Bestätigt beim Erfassen eines Antrags die Rücksprache mit der/dem direkten Vorgesetzten. */
  ruecksprache_vorgesetzte?: boolean;
}

export interface AbwesenheitMitTagen {
  abwesenheit: Abwesenheit;
  /** Kalendertage der Spanne. */
  tage: string[];
  /** Davon die Tage mit einem Soll — die Tage, die Anspruch kosten. */
  arbeitstage: string[];
  locked: boolean;
  /** Bei Krank ab drei Tagen ohne hochgeladene Bescheinigung. */
  auFehlt: boolean;
}

export interface AbwesenheitMitPerson extends AbwesenheitMitTagen {
  userName: string;
}

// ---------------------------------------------------------------------------
// Soll je Tag
// ---------------------------------------------------------------------------

/**
 * Wie viel an einem Tag zu arbeiten gewesen wäre — Wochenende und Feiertag
 * ergeben 0. Berücksichtigt sowohl den berechneten Kalender des Bundeslandes
 * als auch eine von Hand gesetzte `feiertag`-Zeile, damit ein korrigierter
 * Kalender auch den Urlaubsanspruch richtig schont.
 */
export function sollFunktion(user: User, vonISO: string, bisISO: string): (dateISO: string) => number {
  const land = bundeslandFor(user);
  const feiertage = land ? holidaysInRange(vonISO, bisISO, land) : new Map<string, string>();
  const gesetzt = new Set(
    getDb()
      .query<{date: string}, [number, string, string]>(
        `SELECT date FROM day_types WHERE user_id = ? AND date >= ? AND date <= ? AND type = 'feiertag'`,
      )
      .all(user.id, vonISO, bisISO)
      .map((r) => r.date),
  );
  return (dateISO) => (feiertage.has(dateISO) || gesetzt.has(dateISO) ? 0 : dailySollMinutes(user, dateISO));
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

function darfBearbeiten(actor: User, ownerId: number): boolean {
  return hatRecht(actor, 'abwesenheit.pruefen') || actor.id === ownerId;
}

export function abwesenheitById(id: number): Abwesenheit | null {
  return getDb().query<Abwesenheit, [number]>('SELECT * FROM abwesenheiten WHERE id = ?').get(id);
}

export function abwesenheitLocked(a: Abwesenheit): boolean {
  return monatGesperrt(a.user_id, a.von, a.bis);
}

export function mitTagen(a: Abwesenheit, user: User): AbwesenheitMitTagen {
  const soll = sollFunktion(user, a.von, a.bis);
  const tage = tageDerSpanne(a.von, a.bis);
  return {
    abwesenheit: a,
    tage,
    arbeitstage: tage.filter((t) => soll(t) > 0),
    locked: abwesenheitLocked(a),
    auFehlt: a.art === 'krank' && tage.length >= AU_AB_TAGEN && !a.au_datei,
  };
}

/** Abwesenheiten, die den Zeitraum berühren — eine über den Monatswechsel zählt in beiden. */
export function abwesenheitenImZeitraum(userId: number, vonISO: string, bisISO: string): Abwesenheit[] {
  return getDb()
    .query<Abwesenheit, [number, string, string]>(
      `SELECT * FROM abwesenheiten WHERE user_id = ? AND von <= ? AND bis >= ?
       ORDER BY von DESC, id DESC`,
    )
    .all(userId, bisISO, vonISO);
}

export function abwesenheitenForMonth(userId: number, month: string): Abwesenheit[] {
  return abwesenheitenImZeitraum(userId, `${month}-01`, `${month}-31`);
}

export function abwesenheitenForYear(userId: number, jahr: string): Abwesenheit[] {
  return abwesenheitenImZeitraum(userId, `${jahr}-01-01`, `${jahr}-12-31`);
}

/** Die Abwesenheit, zu der dieser Kalendertag gehört — falls es eine gibt. */
export function abwesenheitAmTag(userId: number, datum: string): Abwesenheit | null {
  return getDb()
    .query<Abwesenheit, [number, string, string]>(
      `SELECT * FROM abwesenheiten WHERE user_id = ? AND von <= ? AND bis >= ?
       AND status <> 'abgelehnt' ORDER BY art = 'krank' DESC LIMIT 1`,
    )
    .get(userId, datum, datum);
}

/** Die Warteschlange der Verwaltung, älteste Einreichung zuerst. */
export function abwesenheitenZurPruefung(status: AbwesenheitStatus | 'alle' = 'eingereicht'): AbwesenheitMitPerson[] {
  const db = getDb();
  const sql =
    status === 'alle'
      ? `SELECT a.*, u.name AS user_name FROM abwesenheiten a JOIN users u ON u.id = a.user_id
         ORDER BY a.von DESC`
      : `SELECT a.*, u.name AS user_name FROM abwesenheiten a JOIN users u ON u.id = a.user_id
         WHERE a.status = ? ORDER BY a.eingereicht_at, a.von`;
  const rows =
    status === 'alle'
      ? db.query<Abwesenheit & {user_name: string}, []>(sql).all()
      : db.query<Abwesenheit & {user_name: string}, [string]>(sql).all(status);
  return rows.map(({user_name, ...rest}) => {
    const a = rest as Abwesenheit;
    const user = db.query<User, [number]>('SELECT * FROM users WHERE id = ?').get(a.user_id)!;
    return {...mitTagen(a, user), userName: user_name};
  });
}

/** Für den Monatsabschluss: ein offener Antrag blockiert wie eine offene Reise. */
export function offeneAntraegeImMonat(userId: number, month: string): number {
  const row = getDb()
    .query<{n: number}, [number, string, string]>(
      `SELECT COUNT(*) AS n FROM abwesenheiten WHERE user_id = ? AND status = 'eingereicht'
       AND von <= ? AND bis >= ?`,
    )
    .get(userId, `${month}-31`, `${month}-01`);
  return row?.n ?? 0;
}

// ---------------------------------------------------------------------------
// Urlaubsanspruch
// ---------------------------------------------------------------------------

function uebertragFor(userId: number, jahr: string): number {
  const row = getDb()
    .query<{tage: number}, [number, string]>('SELECT tage FROM urlaub_uebertrag WHERE user_id = ? AND jahr = ?')
    .get(userId, jahr);
  return row?.tage ?? 0;
}

export function setUebertrag(actor: User, userId: number, jahr: string, tage: number): string | null {
  if (!hatRecht(actor, 'abwesenheit.pruefen')) return 'Keine Berechtigung.';
  if (!Number.isInteger(tage) || tage < 0 || tage > 365) return 'Bitte eine Anzahl zwischen 0 und 365 angeben.';
  getDb()
    .query(
      `INSERT INTO urlaub_uebertrag (user_id, jahr, tage, edited_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, jahr) DO UPDATE SET tage = excluded.tage, edited_by = excluded.edited_by,
         updated_at = datetime('now')`,
    )
    .run(userId, jahr, tage, actor.id);
  return null;
}

/**
 * Der Urlaubsanspruch eines Jahres. Abgezogen wird bei der Genehmigung —
 * „noch 12 von 30" heißt: bewilligt und damit ausgegeben. Was nur eingereicht
 * ist, steht daneben, bindet den Anspruch aber nicht.
 */
export function anspruchFor(user: User, jahr: string): Anspruch {
  const von = `${jahr}-01-01`;
  const bis = `${jahr}-12-31`;
  const soll = sollFunktion(user, von, bis);
  let genehmigt = 0;
  let beantragt = 0;
  for (const a of abwesenheitenImZeitraum(user.id, von, bis)) {
    if (a.art !== 'urlaub') continue;
    if (a.status !== 'genehmigt' && a.status !== 'eingereicht') continue;
    // Eine Spanne über den Jahreswechsel zählt in jedem Jahr nur ihre eigenen Tage.
    const tage = anspruchstage(a.von < von ? von : a.von, a.bis > bis ? bis : a.bis, soll).length;
    if (a.status === 'genehmigt') genehmigt += tage;
    else beantragt += tage;
  }
  return {jahresanspruch: user.urlaubstage_jahr, uebertrag: uebertragFor(user.id, jahr), genehmigt, beantragt};
}

// ---------------------------------------------------------------------------
// Projektion auf die Tage
// ---------------------------------------------------------------------------

/**
 * Welche Art bei mehreren wirksamen Spannen am selben Tag gewinnt. Krankheit
 * schlägt alles: wer im Urlaub krank wird, ist krank (§9 BUrlG), und der Tag
 * muss das auch sagen.
 */
const VORRANG: Record<AbwesenheitArt, number> = {
  urlaub: 1,
  freizeitausgleich: 1,
  fortbildung: 2,
  krank: 3,
};

/**
 * Baut die Tageszeilen eines Zeitraums aus den wirksamen Spannen neu auf.
 * Bewusst ein vollständiger Neuaufbau statt einer Fortschreibung: eine
 * Projektion, die man nur ergänzt, läuft irgendwann auseinander, und day_types
 * ist die Tabelle, aus der das Zeitkonto rechnet.
 *
 * Von Hand gesetzte Zeilen (`abwesenheit_id IS NULL`) — also Korrekturen am
 * Feiertagskalender — bleiben unangetastet und behalten den Tag.
 */
export function neuProjizieren(userId: number, vonISO: string, bisISO: string): void {
  const db = getDb();
  db.query('DELETE FROM day_types WHERE user_id = ? AND date >= ? AND date <= ? AND abwesenheit_id IS NOT NULL').run(
    userId,
    vonISO,
    bisISO,
  );
  const vonHand = new Set(
    db
      .query<{date: string}, [number, string, string]>(
        'SELECT date FROM day_types WHERE user_id = ? AND date >= ? AND date <= ?',
      )
      .all(userId, vonISO, bisISO)
      .map((r) => r.date),
  );
  const spannen = abwesenheitenImZeitraum(userId, vonISO, bisISO)
    .filter((a) => istWirksam(a.status))
    .sort((a, b) => VORRANG[a.art] - VORRANG[b.art]);

  const schreiben = db.query(
    `INSERT INTO day_types (user_id, date, type, note, minuten, edited_by, abwesenheit_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET type = excluded.type, note = excluded.note,
       minuten = excluded.minuten, edited_by = excluded.edited_by, abwesenheit_id = excluded.abwesenheit_id,
       updated_at = datetime('now')`,
  );
  for (const a of spannen) {
    for (const tag of tageDerSpanne(a.von, a.bis)) {
      if (tag < vonISO || tag > bisISO) continue;
      if (vonHand.has(tag)) continue; // eine Kalenderkorrektur überschreibt niemand
      schreiben.run(a.user_id, tag, a.art, a.notiz, a.minuten, a.edited_by, a.id);
    }
  }
}

/** Nach jeder Änderung: der berührte Zeitraum wird neu projiziert. */
function projiziereNeuFuer(userId: number, ...spannen: Array<{von: string; bis: string}>): void {
  const alle = spannen.flatMap((s) => [s.von, s.bis]).sort();
  if (alle.length === 0) return;
  neuProjizieren(userId, alle[0]!, alle[alle.length - 1]!);
}

// ---------------------------------------------------------------------------
// Prüfungen
// ---------------------------------------------------------------------------

function monatGesperrt(userId: number, ...daten: string[]): boolean {
  const db = getDb();
  for (const monat of new Set(daten.map(monthOf))) {
    if (
      db
        .query<{month: string}, [number, string]>('SELECT month FROM month_locks WHERE user_id = ? AND month = ?')
        .get(userId, monat)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Spannen derselben Person überschneiden sich nicht — mit einer Ausnahme, die
 * das Gesetz erzwingt: wer im genehmigten Urlaub krank wird, ist beides. Nur
 * eine Krankmeldung darf über einem Antrag liegen, und auch das nur einmal.
 */
export function ueberschneidung(
  userId: number,
  vonISO: string,
  bisISO: string,
  art: AbwesenheitArt,
  exceptId?: number,
): Abwesenheit | null {
  const kandidaten = getDb()
    .query<Abwesenheit, [number, string, string]>(
      `SELECT * FROM abwesenheiten WHERE user_id = ? AND von <= ? AND bis >= ?
       AND status <> 'abgelehnt' ORDER BY von`,
    )
    .all(userId, bisISO, vonISO)
    .filter((a) => a.id !== exceptId);
  return kandidaten.find((a) => !darfUeberlappen(art, a.art)) ?? null;
}

function darfUeberlappen(neu: AbwesenheitArt, bestehend: AbwesenheitArt): boolean {
  if (neu === 'krank') return istAntrag(bestehend);
  if (bestehend === 'krank') return istAntrag(neu);
  return false;
}

function pruefeInput(userId: number, input: AbwesenheitInput, exceptId?: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.von) || !/^\d{4}-\d{2}-\d{2}$/.test(input.bis)) {
    return 'Bitte gültige Daten angeben.';
  }
  if (input.bis < input.von) return 'Das Ende darf nicht vor dem Beginn liegen.';
  if (laengeInTagen(input.von, input.bis) > 365) return 'Eine Abwesenheit darf höchstens ein Jahr umfassen.';
  if (input.art === 'freizeitausgleich' && input.minuten !== undefined) {
    if (input.von !== input.bis) return 'Minuten sind nur bei einem einzelnen Tag Freizeitausgleich möglich.';
    const user = getDb().query<User, [number]>('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return 'Person nicht gefunden.';
    const soll = sollFunktion(user, input.von, input.bis)(input.von);
    if (!Number.isInteger(input.minuten) || input.minuten <= 0 || input.minuten > soll) {
      return `Bitte eine Anzahl zwischen 1 und ${soll} Minuten angeben.`;
    }
  }
  const konflikt = ueberschneidung(userId, input.von, input.bis, input.art, exceptId);
  if (konflikt) {
    return `Überschneidung mit ${ART_LABEL[konflikt.art]} (${fmtDateRange(konflikt.von, konflikt.bis)}).`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export function createAbwesenheit(
  actor: User,
  userId: number,
  input: AbwesenheitInput,
): {error: string} | {id: number} {
  if (!darfBearbeiten(actor, userId)) return {error: 'Keine Berechtigung.'};
  if (monatGesperrt(userId, input.von, input.bis)) {
    return {error: 'Dieser Monat ist abgeschlossen. Bitte wende dich an die Verwaltung.'};
  }
  // Nur beim Anlegen: ein Antrag entsteht aus einem Gespräch, und diese
  // Bestätigung ist der Beleg dafür. Beim Ändern wird sie nicht erneut verlangt
  // — sonst müsste die Verwaltung, die einen genehmigten Urlaub korrigiert, ein
  // Gespräch bestätigen, das nicht ihres war. Der Wert der Zeile bleibt.
  if (istAntrag(input.art) && !input.ruecksprache_vorgesetzte) {
    return {error: 'Bitte bestätige, dass du dies bereits mit deiner/deinem direkten Vorgesetzten besprochen hast.'};
  }
  const invalid = pruefeInput(userId, input);
  if (invalid) return {error: invalid};

  const status = startStatus(input.art);
  const row = getDb()
    .query<{id: number}, [number, string, string, string, string, string | null, number | null, number, number]>(
      `INSERT INTO abwesenheiten (user_id, von, bis, art, status, notiz, minuten, ruecksprache_vorgesetzte, edited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(
      userId,
      input.von,
      input.bis,
      input.art,
      status,
      notizFuer(input),
      minutenFuer(input),
      input.ruecksprache_vorgesetzte ? 1 : 0,
      actor.id,
    );
  if (!row) return {error: 'Die Abwesenheit konnte nicht gespeichert werden.'};
  projiziereNeuFuer(userId, input);
  return {id: row.id};
}

/**
 * Krank bekommt keine Notiz. Das Feld wäre die erste Stelle, an der jemand eine
 * Diagnose hinterlässt, und damit läge im Zeiterfasser eine
 * Gesundheitsangabe nach Art. 9 DSGVO. Gespeichert werden Daten und die
 * Bescheinigung, sonst nichts.
 */
function notizFuer(input: AbwesenheitInput): string | null {
  if (input.art === 'krank') return null;
  return input.notiz?.trim() || null;
}

/** Nur ein eintägiger Freizeitausgleich kann in Minuten statt im ganzen Tag stehen. */
function minutenFuer(input: AbwesenheitInput): number | null {
  if (input.art !== 'freizeitausgleich' || input.von !== input.bis) return null;
  return input.minuten ?? null;
}

export function updateAbwesenheit(actor: User, id: number, input: AbwesenheitInput): string | null {
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (!darfBearbeiten(actor, a.user_id)) return 'Keine Berechtigung.';
  if (a.status === 'genehmigt' && !hatRecht(actor, 'abwesenheit.pruefen')) {
    return 'Eine genehmigte Abwesenheit kann nur die Verwaltung ändern.';
  }
  if (monatGesperrt(a.user_id, a.von, a.bis, input.von, input.bis)) {
    return 'Dieser Monat ist abgeschlossen. Bitte wende dich an die Verwaltung.';
  }
  if (input.art !== a.art) return 'Die Art einer erfassten Abwesenheit kann nicht gewechselt werden.';
  const invalid = pruefeInput(a.user_id, input, id);
  if (invalid) return invalid;

  // Eine geänderte Spanne ist nicht mehr die geprüfte: eine genehmigte geht
  // zurück in die Prüfung, eine abgelehnte zurück in die Hand des Mitarbeiters.
  const status: AbwesenheitStatus =
    a.status === 'genehmigt' ? 'eingereicht' : a.status === 'abgelehnt' ? 'entwurf' : a.status;

  getDb()
    .query(
      `UPDATE abwesenheiten SET von = ?, bis = ?, notiz = ?, minuten = ?, ruecksprache_vorgesetzte = ?,
       status = ?, edited_by = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(
      input.von,
      input.bis,
      notizFuer(input),
      minutenFuer(input),
      // Weggelassen heißt „unverändert", nicht „widerrufen": die Bestätigung ist
      // eine Tatsache über den gestellten Antrag und keine Angabe, die eine
      // Korrektur nebenbei zurücknimmt.
      input.ruecksprache_vorgesetzte === undefined ? a.ruecksprache_vorgesetzte : input.ruecksprache_vorgesetzte ? 1 : 0,
      status,
      actor.id,
      id,
    );
  projiziereNeuFuer(a.user_id, a, input);
  // Eine verschobene Krankmeldung trifft womöglich einen anderen Urlaub als vorher.
  if (a.art === 'krank' && a.au_datei) paragraf9Anwenden(actor, id);
  return null;
}

export function deleteAbwesenheit(actor: User, id: number): string | null {
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (!darfBearbeiten(actor, a.user_id)) return 'Keine Berechtigung.';
  if (a.status === 'genehmigt' && !hatRecht(actor, 'abwesenheit.pruefen')) {
    return 'Eine genehmigte Abwesenheit kann nur die Verwaltung zurücknehmen.';
  }
  if (monatGesperrt(a.user_id, a.von, a.bis)) {
    return 'Dieser Monat ist abgeschlossen. Bitte wende dich an die Verwaltung.';
  }
  loescheAuDatei(a.au_datei);
  getDb().query('DELETE FROM abwesenheiten WHERE id = ?').run(id);
  projiziereNeuFuer(a.user_id, a);
  return null;
}

// ---------------------------------------------------------------------------
// Beantragen und prüfen
// ---------------------------------------------------------------------------

/**
 * Hier steht die gespiegelte Bedingung — genauer: hier steht keine. Eine Reise
 * darf erst nach der Rückkehr eingereicht werden, weil ein geplanter Anspruch
 * keiner ist. Ein Urlaub ist der umgekehrte Fall: er wird beantragt, bevor er
 * beginnt, und rückwirkend beantragt, wenn jemand es vorher versäumt hat.
 * Beides ist ehrlich, also gibt es kein Zeitfenster zu prüfen.
 */
export function einreichen(actor: User, id: number): string | null {
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (actor.id !== a.user_id) return 'Nur die betroffene Person kann den Antrag einreichen.';
  if (!istAntrag(a.art)) return 'Diese Abwesenheit ist eine Meldung und wird nicht beantragt.';
  if (a.status === 'eingereicht') return 'Dieser Antrag liegt bereits zur Prüfung vor.';
  if (a.status === 'genehmigt') return 'Dieser Antrag ist bereits genehmigt.';
  if (monatGesperrt(a.user_id, a.von, a.bis)) return 'Dieser Monat ist abgeschlossen.';
  getDb()
    .query(
      `UPDATE abwesenheiten SET status = 'eingereicht', eingereicht_at = datetime('now'),
       entschieden_at = NULL, entschieden_von = NULL, entscheidung_notiz = NULL, selbst_genehmigt = 0,
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
  return null;
}

export function zurueckziehen(actor: User, id: number): string | null {
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (actor.id !== a.user_id) return 'Nur die betroffene Person kann den Antrag zurückziehen.';
  if (a.status !== 'eingereicht') return 'Nur ein eingereichter Antrag kann zurückgezogen werden.';
  getDb()
    .query(
      `UPDATE abwesenheiten SET status = 'entwurf', eingereicht_at = NULL,
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
  return null;
}

export function genehmigen(actor: User, id: number): string | null {
  if (!hatRecht(actor, 'abwesenheit.pruefen')) return 'Keine Berechtigung.';
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (a.status !== 'eingereicht') return 'Nur ein eingereichter Antrag kann genehmigt werden.';
  // Es gibt keine zweite Instanz über der Verwaltung. Statt so zu tun, als
  // hätte jemand anderes entschieden, wird die Selbstgenehmigung markiert und
  // steht später neben dem Vorgang.
  const selbst = actor.id === a.user_id ? 1 : 0;
  getDb()
    .query(
      `UPDATE abwesenheiten SET status = 'genehmigt', entschieden_at = datetime('now'), entschieden_von = ?,
       entscheidung_notiz = NULL, selbst_genehmigt = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(actor.id, selbst, id);
  projiziereNeuFuer(a.user_id, a);
  return null;
}

export function zurueckweisen(actor: User, id: number, grund: string): string | null {
  if (!hatRecht(actor, 'abwesenheit.pruefen')) return 'Keine Berechtigung.';
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (a.status !== 'eingereicht') return 'Nur ein eingereichter Antrag kann zurückgewiesen werden.';
  if (grund.trim() === '') return 'Bitte einen Grund für die Zurückweisung angeben.';
  getDb()
    .query(
      `UPDATE abwesenheiten SET status = 'abgelehnt', entschieden_at = datetime('now'), entschieden_von = ?,
       entscheidung_notiz = ?, selbst_genehmigt = 0, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(actor.id, grund.trim(), id);
  projiziereNeuFuer(a.user_id, a);
  return null;
}

// ---------------------------------------------------------------------------
// Arbeitsunfähigkeitsbescheinigung
// ---------------------------------------------------------------------------

function auWurzel(): string {
  return join(process.cwd(), 'data', 'au');
}

/** Absoluter Pfad — nur für den Auslieferungs-Handler. */
export function auDateiPfad(datei: string): string {
  return join(auWurzel(), datei);
}

/**
 * Getrennt von data/belege abgelegt: eine Krankmeldung ist kein Restaurantbeleg,
 * und die Trennung im Dateisystem macht eine spätere, engere Regel möglich,
 * ohne die Quittungen mitzubewegen. Der Dateiname kommt nie vom Client.
 */
export async function speichereAuDatei(file: File, jahr: string): Promise<{datei: string; typ: string} | string> {
  const endung = AU_TYPEN[file.type];
  if (!endung) return 'Erlaubt sind JPG, PNG, WEBP und PDF.';
  if (file.size > AU_MAX_BYTES) return 'Die Datei darf höchstens 10 MB groß sein.';
  if (file.size === 0) return 'Die Datei ist leer.';
  mkdirSync(join(auWurzel(), jahr), {recursive: true});
  const datei = `${jahr}/${crypto.randomUUID()}.${endung}`;
  await Bun.write(auDateiPfad(datei), file);
  return {datei, typ: file.type};
}

function loescheAuDatei(datei: string | null): void {
  if (!datei) return;
  try {
    rmSync(auDateiPfad(datei), {force: true});
  } catch {
    // absichtlich still — eine fehlende Datei hält das Löschen nicht auf
  }
}

export function setAuDatei(
  actor: User,
  id: number,
  datei: {datei: string; typ: string; name: string} | null,
): string | null {
  const a = abwesenheitById(id);
  if (!a) return 'Abwesenheit nicht gefunden.';
  if (!darfBearbeiten(actor, a.user_id)) return 'Keine Berechtigung.';
  if (a.art !== 'krank') return 'Eine Bescheinigung gehört nur zu einer Krankmeldung.';
  if (monatGesperrt(a.user_id, a.von, a.bis)) {
    return 'Dieser Monat ist abgeschlossen. Bitte wende dich an die Verwaltung.';
  }
  loescheAuDatei(a.au_datei);
  getDb()
    .query(
      `UPDATE abwesenheiten SET au_datei = ?, au_datei_name = ?, au_datei_typ = ?,
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(datei?.datei ?? null, datei?.name ?? null, datei?.typ ?? null, id);
  // Erst mit der Bescheinigung greift § 9 — deshalb hier und nicht beim Melden.
  if (datei) paragraf9Anwenden(actor, id);
  return null;
}

// ---------------------------------------------------------------------------
// § 9 BUrlG — Krankheit im Urlaub
// ---------------------------------------------------------------------------

/**
 * „Erkrankt ein Arbeitnehmer während des Urlaubs, so werden die durch
 * ärztliches Zeugnis nachgewiesenen Tage der Arbeitsunfähigkeit auf den
 * Jahresurlaub nicht angerechnet" (§ 9 BUrlG).
 *
 * Der Anspruch wird hier aus den Spannen gerechnet und nirgends gespeichert —
 * die Tage kommen also allein dadurch zurück, dass der Urlaub um die
 * Krankheitstage gekürzt wird. Liegt die Krankheit mitten im Urlaub, zerfällt
 * er in zwei Spannen; deckt sie ihn ganz, bleibt keine übrig.
 *
 * Ohne Bescheinigung passiert nichts. Das ist kein Versehen, sondern genau die
 * Bedingung des Gesetzes: ohne ärztliches Zeugnis bleiben die Urlaubstage
 * verbraucht.
 */
export function paragraf9Anwenden(actor: User, krankId: number): {zurueck: number} {
  const krank = abwesenheitById(krankId);
  if (!krank || krank.art !== 'krank' || !krank.au_datei) return {zurueck: 0};
  if (!istWirksam(krank.status)) return {zurueck: 0};

  const db = getDb();
  const betroffen = db
    .query<Abwesenheit, [number, string, string]>(
      `SELECT * FROM abwesenheiten WHERE user_id = ? AND art = 'urlaub' AND status = 'genehmigt'
       AND von <= ? AND bis >= ? ORDER BY von`,
    )
    .all(krank.user_id, krank.bis, krank.von);
  if (betroffen.length === 0) return {zurueck: 0};

  const user = db.query<User, [number]>('SELECT * FROM users WHERE id = ?').get(krank.user_id);
  if (!user) return {zurueck: 0};

  let zurueck = 0;
  db.transaction(() => {
    for (const urlaub of betroffen) {
      const soll = sollFunktion(user, urlaub.von, urlaub.bis);
      const vorher = anspruchstage(urlaub.von, urlaub.bis, soll).length;

      // Was vom Urlaub übrig bleibt: das Stück davor und das Stück danach.
      const reste: Array<{von: string; bis: string}> = [];
      if (urlaub.von < krank.von) reste.push({von: urlaub.von, bis: tagVor(krank.von)});
      if (urlaub.bis > krank.bis) reste.push({von: tagNach(krank.bis), bis: urlaub.bis});

      db.query('DELETE FROM abwesenheiten WHERE id = ?').run(urlaub.id);
      let nachher = 0;
      for (const rest of reste) {
        nachher += anspruchstage(rest.von, rest.bis, soll).length;
        db.query(
          `INSERT INTO abwesenheiten (user_id, von, bis, art, status, notiz, ruecksprache_vorgesetzte,
             eingereicht_at, entschieden_at, entschieden_von, selbst_genehmigt, edited_by)
           VALUES (?, ?, ?, 'urlaub', 'genehmigt', ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          urlaub.user_id,
          rest.von,
          rest.bis,
          urlaub.notiz,
          // Der Rest ist derselbe Antrag, nur kürzer: die Rücksprache gilt weiter.
          urlaub.ruecksprache_vorgesetzte,
          urlaub.eingereicht_at,
          urlaub.entschieden_at,
          urlaub.entschieden_von,
          urlaub.selbst_genehmigt,
          actor.id,
        );
      }
      zurueck += vorher - nachher;
    }
  })();

  // Der ganze berührte Zeitraum wird neu projiziert: der Urlaub ist kürzer, die
  // Krankheit steht auf den Tagen, die er verloren hat.
  const von = [krank.von, ...betroffen.map((u) => u.von)].sort()[0]!;
  const bis = [krank.bis, ...betroffen.map((u) => u.bis)].sort().at(-1)!;
  neuProjizieren(krank.user_id, von, bis);
  return {zurueck};
}

function tagVor(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function tagNach(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
