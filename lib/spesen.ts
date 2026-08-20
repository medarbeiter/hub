// Reisen & Spesen — der Datensatz. DB-gebunden wie lib/time.ts: jede Funktion
// gibt eine deutsche Meldung oder null zurück, Berechtigung, Monatsabschluss
// und Überschneidung werden hier geprüft und nicht in der Server Action.
//
// Gerechnet wird nirgends hier — das macht lib/pauschale.ts, damit derselbe
// Code im Editor mitläuft, während die Reise getippt wird.

import {mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {personAngabe, type AvatarKey, type PersonAngabe} from './avatar';
import {getDb, type BelegArt, type Reise, type ReiseBeleg, type ReiseStatus, type User} from './db';
import {fmtDateRange, monthOf, nowMinutes, todayISO} from './format';
import {berechneSpesen, pruefeSpanne, satzFuer, type SatzStufe, type SpesenRechnung} from './pauschale';
import {spesenSaetze} from './settings';
import {hatRecht} from './rechte';
import {rolleLabel} from './rollen';

export const REISE_STATUS_LABEL: Record<ReiseStatus, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
};

export const BELEG_ART_LABEL: Record<BelegArt, string> = {
  uebernachtung: 'Übernachtung',
  fahrt: 'Fahrt',
  parken: 'Parken',
  ticket: 'Ticket',
  sonstiges: 'Sonstiges',
};

export const BELEG_ARTEN: BelegArt[] = ['uebernachtung', 'fahrt', 'parken', 'ticket', 'sonstiges'];

/** Was hochgeladen werden darf. Der Content-Type des Browsers wird nie geglaubt. */
export const BELEG_TYPEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

export const BELEG_MAX_BYTES = 10 * 1024 * 1024;

export interface ReiseInput {
  startDate: string;
  startMin: number;
  endDate: string;
  endMin: number;
  zweck: string;
  ziel?: string;
}

export interface BelegInput {
  art: BelegArt;
  datum: string;
  betragCent: number;
  beschreibung?: string;
  datei?: string;
  dateiName?: string;
  dateiTyp?: string;
}

export interface ReiseMitRechnung {
  reise: Reise;
  belege: ReiseBeleg[];
  rechnung: SpesenRechnung;
  /** Die Stufe, mit der gerechnet wurde — eingefroren oder aus der Tabelle. */
  stufe: SatzStufe;
  /** True, solange die Rechnung mit der heute gültigen Tabelle läuft. */
  saetzeAktuell: boolean;
  locked: boolean;
}

/** Was der Join über die Person mitbringt, bevor `personAngabe()` daraus eine macht. */
interface PersonSpalten {
  user_name: string;
  user_role: string;
  user_email: string;
  avatar_key: AvatarKey;
  avatar_datei: string | null;
}

export interface ReiseMitPerson extends ReiseMitRechnung {
  userName: string;
  /** Wer eingereicht hat, fertig zum Zeichnen — Name und Bildquelle. */
  person: PersonAngabe;
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

function canEdit(actor: User, ownerId: number): boolean {
  return hatRecht(actor, 'spesen.pruefen') || actor.id === ownerId;
}

export function reiseById(id: number): Reise | null {
  return getDb().query<Reise, [number]>('SELECT * FROM reisen WHERE id = ?').get(id);
}

export function belegeFor(reiseId: number): ReiseBeleg[] {
  return getDb()
    .query<ReiseBeleg, [number]>('SELECT * FROM reise_belege WHERE reise_id = ? ORDER BY datum, id')
    .all(reiseId);
}

/** Eine Reise ist gesperrt, sobald einer ihrer Monate abgeschlossen ist. */
export function reiseLocked(reise: Reise): boolean {
  const monate = new Set([monthOf(reise.start_date), monthOf(reise.end_date)]);
  const db = getDb();
  for (const monat of monate) {
    const row = db
      .query<{month: string}, [number, string]>('SELECT month FROM month_locks WHERE user_id = ? AND month = ?')
      .get(reise.user_id, monat);
    if (row) return true;
  }
  return false;
}

/**
 * Mit welchen Sätzen eine Reise rechnet: der beim Einreichen eingefrorenen
 * Stufe, sonst der Stufe, die am Abfahrtstag gilt.
 */
function stufeVon(reise: Reise): {stufe: SatzStufe; aktuell: boolean} {
  const eingefroren =
    (reise.status === 'eingereicht' || reise.status === 'genehmigt') &&
    reise.satz_teiltag_cent !== null &&
    reise.satz_volltag_cent !== null;
  if (eingefroren) {
    return {
      stufe: {ab: reise.start_date, halbCent: reise.satz_teiltag_cent!, vollCent: reise.satz_volltag_cent!},
      aktuell: false,
    };
  }
  return {stufe: satzFuer(spesenSaetze(), reise.start_date), aktuell: true};
}

export function mitRechnung(reise: Reise): ReiseMitRechnung {
  const belege = belegeFor(reise.id);
  const belegeCent = belege.reduce((sum, b) => sum + b.betrag_cent, 0);
  const {stufe, aktuell} = stufeVon(reise);
  return {
    reise,
    belege,
    stufe,
    saetzeAktuell: aktuell,
    locked: reiseLocked(reise),
    rechnung: berechneSpesen(
      {
        startDate: reise.start_date,
        startMin: reise.start_min,
        endDate: reise.end_date,
        endMin: reise.end_min,
      },
      stufe,
      belegeCent,
    ),
  };
}

/** Reisen, die den Zeitraum berühren — eine Reise über den Monatswechsel zählt in beiden. */
function reisenImZeitraum(userId: number, vonISO: string, bisISO: string): Reise[] {
  return getDb()
    .query<Reise, [number, string, string]>(
      `SELECT * FROM reisen WHERE user_id = ? AND start_date <= ? AND end_date >= ?
       ORDER BY start_date DESC, start_min DESC`,
    )
    .all(userId, bisISO, vonISO);
}

export function reisenForMonth(userId: number, month: string): ReiseMitRechnung[] {
  return reisenImZeitraum(userId, `${month}-01`, `${month}-31`).map(mitRechnung);
}

export function reisenForYear(userId: number, jahr: string): ReiseMitRechnung[] {
  return reisenImZeitraum(userId, `${jahr}-01-01`, `${jahr}-12-31`).map(mitRechnung);
}

/** Die Prüfliste der Verwaltung, älteste Einreichung zuerst. */
export function reisenZurPruefung(status: ReiseStatus | 'alle' = 'eingereicht'): ReiseMitPerson[] {
  const sql =
    status === 'alle'
      ? `SELECT r.*, u.name AS user_name, u.role AS user_role, u.email AS user_email, u.avatar_key, u.avatar_datei
           FROM reisen r JOIN users u ON u.id = r.user_id
         ORDER BY r.start_date DESC`
      : `SELECT r.*, u.name AS user_name, u.role AS user_role, u.email AS user_email, u.avatar_key, u.avatar_datei
           FROM reisen r JOIN users u ON u.id = r.user_id
         WHERE r.status = ? ORDER BY r.eingereicht_at, r.start_date`;
  const rows =
    status === 'alle'
      ? getDb().query<Reise & PersonSpalten, []>(sql).all()
      : getDb().query<Reise & PersonSpalten, [string]>(sql).all(status);
  return rows.map(({user_name, user_role, user_email, avatar_key, avatar_datei, ...reise}) => ({
    ...mitRechnung(reise as Reise),
    userName: user_name,
    // Die Rolle als fertiges Wort — die Karte im Browser kann den Schlüssel
    // eines frei benannten Rollensatzes nicht selbst übersetzen.
    person: {
      ...personAngabe({
        id: reise.user_id,
        name: user_name,
        email: user_email,
        avatar_key,
        avatar_datei,
      }),
      rolle: rolleLabel(user_role),
    },
  }));
}

/** Für den Monatsabschluss: eingereichte Reisen blockieren wie offene Einträge. */
export function eingereichteImMonat(userId: number, month: string): number {
  const row = getDb()
    .query<{n: number}, [number, string, string]>(
      `SELECT COUNT(*) AS n FROM reisen WHERE user_id = ? AND status = 'eingereicht'
       AND start_date <= ? AND end_date >= ?`,
    )
    .get(userId, `${month}-31`, `${month}-01`);
  return row?.n ?? 0;
}

/** Die Reise, zu der dieser Kalendertag gehört — falls es eine gibt. */
export function reiseAmTag(userId: number, datum: string): Reise | null {
  return getDb()
    .query<Reise, [number, string, string]>(
      'SELECT * FROM reisen WHERE user_id = ? AND start_date <= ? AND end_date >= ? LIMIT 1',
    )
    .get(userId, datum, datum);
}

/** Eine bereits erfasste Reise, die sich mit dieser Spanne überschneidet. */
export function ueberlappendeReise(
  userId: number,
  vonISO: string,
  bisISO: string,
  exceptId?: number,
): Reise | null {
  const rows = getDb()
    .query<Reise, [number, string, string]>(
      'SELECT * FROM reisen WHERE user_id = ? AND start_date <= ? AND end_date >= ? ORDER BY start_date',
    )
    .all(userId, bisISO, vonISO);
  return rows.find((r) => r.id !== exceptId) ?? null;
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

function pruefeInput(userId: number, input: ReiseInput, exceptId?: number): string | null {
  const spannenFehler = pruefeSpanne(input);
  if (spannenFehler) return spannenFehler;
  if (input.zweck.trim() === '') return 'Bitte den Anlass der Reise angeben.';
  const konflikt = ueberlappendeReise(userId, input.startDate, input.endDate, exceptId);
  if (konflikt) {
    return `Überschneidung mit einer erfassten Reise (${fmtDateRange(konflikt.start_date, konflikt.end_date)}).`;
  }
  return null;
}

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

export function createReise(actor: User, userId: number, input: ReiseInput): string | null {
  if (!canEdit(actor, userId)) return 'Keine Berechtigung.';
  if (monatGesperrt(userId, input.startDate, input.endDate)) return 'Dieser Monat ist abgeschlossen.';
  const invalid = pruefeInput(userId, input);
  if (invalid) return invalid;
  getDb()
    .query(
      `INSERT INTO reisen (user_id, start_date, start_min, end_date, end_min, zweck, ziel, edited_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      input.startDate,
      input.startMin,
      input.endDate,
      input.endMin,
      input.zweck.trim(),
      input.ziel?.trim() || null,
      actor.id,
    );
  return null;
}

export function updateReise(actor: User, id: number, input: ReiseInput): string | null {
  const reise = reiseById(id);
  if (!reise) return 'Reise nicht gefunden.';
  if (!canEdit(actor, reise.user_id)) return 'Keine Berechtigung.';
  if (reise.status === 'genehmigt' && !hatRecht(actor, 'spesen.pruefen')) {
    return 'Eine genehmigte Reise kann nur die Verwaltung ändern.';
  }
  if (monatGesperrt(reise.user_id, reise.start_date, reise.end_date, input.startDate, input.endDate)) {
    return 'Dieser Monat ist abgeschlossen.';
  }
  const invalid = pruefeInput(reise.user_id, input, id);
  if (invalid) return invalid;

  // Eine geänderte Abrechnung ist nicht mehr die geprüfte: eine genehmigte geht
  // zurück in die Prüfung, eine abgelehnte zurück in die Hand des Mitarbeiters.
  const status: ReiseStatus =
    reise.status === 'genehmigt' ? 'eingereicht' : reise.status === 'abgelehnt' ? 'entwurf' : reise.status;

  getDb()
    .query(
      `UPDATE reisen SET start_date = ?, start_min = ?, end_date = ?, end_min = ?, zweck = ?, ziel = ?,
       status = ?, edited_by = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(
      input.startDate,
      input.startMin,
      input.endDate,
      input.endMin,
      input.zweck.trim(),
      input.ziel?.trim() || null,
      status,
      actor.id,
      id,
    );
  return null;
}

export function deleteReise(actor: User, id: number): string | null {
  const reise = reiseById(id);
  if (!reise) return 'Reise nicht gefunden.';
  if (!canEdit(actor, reise.user_id)) return 'Keine Berechtigung.';
  if (reise.status === 'genehmigt' && !hatRecht(actor, 'spesen.pruefen')) {
    return 'Eine genehmigte Reise kann nur die Verwaltung löschen.';
  }
  if (monatGesperrt(reise.user_id, reise.start_date, reise.end_date)) return 'Dieser Monat ist abgeschlossen.';
  for (const beleg of belegeFor(id)) loescheBelegDatei(beleg.datei);
  getDb().query('DELETE FROM reisen WHERE id = ?').run(id);
  return null;
}

// ---------------------------------------------------------------------------
// Belege
// ---------------------------------------------------------------------------

export function addBeleg(actor: User, reiseId: number, input: BelegInput): string | null {
  const reise = reiseById(reiseId);
  if (!reise) return 'Reise nicht gefunden.';
  if (!canEdit(actor, reise.user_id)) return 'Keine Berechtigung.';
  if (reise.status === 'genehmigt' && !hatRecht(actor, 'spesen.pruefen')) {
    return 'Eine genehmigte Reise kann nur die Verwaltung ändern.';
  }
  if (monatGesperrt(reise.user_id, reise.start_date, reise.end_date)) return 'Dieser Monat ist abgeschlossen.';
  if (!Number.isInteger(input.betragCent) || input.betragCent <= 0) {
    return 'Bitte einen Betrag größer als 0,00 € angeben.';
  }
  if (input.datum < reise.start_date || input.datum > reise.end_date) {
    return 'Das Belegdatum muss in den Reisezeitraum fallen.';
  }
  getDb()
    .query(
      `INSERT INTO reise_belege (reise_id, art, datum, betrag_cent, beschreibung, datei, datei_name, datei_typ)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      reiseId,
      input.art,
      input.datum,
      input.betragCent,
      input.beschreibung?.trim() || null,
      input.datei ?? null,
      input.dateiName ?? null,
      input.dateiTyp ?? null,
    );
  return null;
}

export function belegById(id: number): (ReiseBeleg & {user_id: number}) | null {
  return getDb()
    .query<ReiseBeleg & {user_id: number}, [number]>(
      'SELECT b.*, r.user_id AS user_id FROM reise_belege b JOIN reisen r ON r.id = b.reise_id WHERE b.id = ?',
    )
    .get(id);
}

export function deleteBeleg(actor: User, belegId: number): string | null {
  const beleg = belegById(belegId);
  if (!beleg) return 'Beleg nicht gefunden.';
  const reise = reiseById(beleg.reise_id);
  if (!reise) return 'Reise nicht gefunden.';
  if (!canEdit(actor, reise.user_id)) return 'Keine Berechtigung.';
  if (reise.status === 'genehmigt' && !hatRecht(actor, 'spesen.pruefen')) {
    return 'Eine genehmigte Reise kann nur die Verwaltung ändern.';
  }
  if (monatGesperrt(reise.user_id, reise.start_date, reise.end_date)) return 'Dieser Monat ist abgeschlossen.';
  loescheBelegDatei(beleg.datei);
  getDb().query('DELETE FROM reise_belege WHERE id = ?').run(belegId);
  return null;
}

function belegeWurzel(): string {
  return join(process.cwd(), 'data', 'belege');
}

/** Absoluter Pfad zu einer gespeicherten Datei — nur für den Auslieferungs-Handler. */
export function belegDateiPfad(datei: string): string {
  return join(belegeWurzel(), datei);
}

/**
 * Legt die Datei unterhalb von data/belege/<Jahr>/ ab. Der Dateiname kommt nie
 * vom Client: er wird aus einer UUID und der Endung des erlaubten MIME-Typs
 * gebildet, damit weder Pfad noch Endung manipulierbar sind.
 */
export async function speichereBelegDatei(
  file: File,
  jahr: string,
): Promise<{datei: string; typ: string} | string> {
  const typ = file.type;
  const endung = BELEG_TYPEN[typ];
  if (!endung) return 'Erlaubt sind JPG, PNG, WEBP und PDF.';
  if (file.size > BELEG_MAX_BYTES) return 'Die Datei darf höchstens 10 MB groß sein.';
  if (file.size === 0) return 'Die Datei ist leer.';
  mkdirSync(join(belegeWurzel(), jahr), {recursive: true});
  const datei = `${jahr}/${crypto.randomUUID()}.${endung}`;
  await Bun.write(belegDateiPfad(datei), file);
  return {datei, typ};
}

function loescheBelegDatei(datei: string | null): void {
  if (!datei) return;
  // Best effort: eine fehlende Datei darf das Löschen des Datensatzes nicht aufhalten.
  try {
    rmSync(belegDateiPfad(datei), {force: true});
  } catch {
    // absichtlich still
  }
}

// ---------------------------------------------------------------------------
// Einreichen und prüfen
// ---------------------------------------------------------------------------

/** Eingereicht wird erst nach der Rückkehr — ein geplanter Anspruch ist keiner. */
export function istVorbei(reise: Reise): boolean {
  const today = todayISO();
  if (reise.end_date < today) return true;
  return reise.end_date === today && reise.end_min <= nowMinutes();
}

export function einreichen(actor: User, id: number): string | null {
  const reise = reiseById(id);
  if (!reise) return 'Reise nicht gefunden.';
  if (actor.id !== reise.user_id) return 'Nur die reisende Person kann die Abrechnung einreichen.';
  if (reise.status === 'eingereicht') return 'Diese Reise ist bereits eingereicht.';
  if (reise.status === 'genehmigt') return 'Diese Reise ist bereits genehmigt.';
  if (monatGesperrt(reise.user_id, reise.start_date, reise.end_date)) return 'Dieser Monat ist abgeschlossen.';
  if (!istVorbei(reise)) return 'Die Abrechnung kann erst nach der Rückkehr eingereicht werden.';

  // Die am Abfahrtstag gültige Stufe wird eingefroren: was geprüft wird, bleibt
  // der Betrag, der eingereicht wurde.
  const stufe = satzFuer(spesenSaetze(), reise.start_date);
  getDb()
    .query(
      `UPDATE reisen SET status = 'eingereicht', eingereicht_at = datetime('now'),
       satz_teiltag_cent = ?, satz_volltag_cent = ?,
       entschieden_at = NULL, entschieden_von = NULL, entscheidung_notiz = NULL,
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(stufe.halbCent, stufe.vollCent, id);
  return null;
}

export function zurueckziehen(actor: User, id: number): string | null {
  const reise = reiseById(id);
  if (!reise) return 'Reise nicht gefunden.';
  if (actor.id !== reise.user_id) return 'Nur die reisende Person kann die Abrechnung zurückziehen.';
  if (reise.status !== 'eingereicht') return 'Nur eine eingereichte Abrechnung kann zurückgezogen werden.';
  getDb()
    .query(
      `UPDATE reisen SET status = 'entwurf', eingereicht_at = NULL,
       satz_teiltag_cent = NULL, satz_volltag_cent = NULL,
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(id);
  return null;
}

export function genehmigen(actor: User, id: number): string | null {
  if (!hatRecht(actor, 'spesen.pruefen')) return 'Keine Berechtigung.';
  const reise = reiseById(id);
  if (!reise) return 'Reise nicht gefunden.';
  if (reise.status !== 'eingereicht') return 'Nur eine eingereichte Abrechnung kann genehmigt werden.';
  getDb()
    .query(
      `UPDATE reisen SET status = 'genehmigt', entschieden_at = datetime('now'), entschieden_von = ?,
       entscheidung_notiz = NULL, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(actor.id, id);
  return null;
}

export function zurueckweisen(actor: User, id: number, grund: string): string | null {
  if (!hatRecht(actor, 'spesen.pruefen')) return 'Keine Berechtigung.';
  const reise = reiseById(id);
  if (!reise) return 'Reise nicht gefunden.';
  if (reise.status !== 'eingereicht') return 'Nur eine eingereichte Abrechnung kann zurückgewiesen werden.';
  if (grund.trim() === '') return 'Bitte einen Grund für die Zurückweisung angeben.';
  getDb()
    .query(
      `UPDATE reisen SET status = 'abgelehnt', entschieden_at = datetime('now'), entschieden_von = ?,
       entscheidung_notiz = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(actor.id, grund.trim(), id);
  return null;
}
