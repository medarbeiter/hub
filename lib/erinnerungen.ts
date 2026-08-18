// Was liegen geblieben ist — die eine Post, die der Prüfkreis wirklich braucht.
//
// Vorher ging jede Einreichung sofort als Nachricht an alle Prüfenden hinaus.
// Das ist genau die Nachricht, die nichts erzählt: die Warteschlange steht in
// der Anwendung, mit Zähler an der Seitenleiste, und wer täglich darin
// arbeitet, sieht den Eingang, bevor die Mail ankommt. Ein Verteiler, der nur
// wiederholt, was ohnehin auf dem Bildschirm steht, wird weggeklickt — und
// nimmt beim Wegklicken die Nachrichten mit, die es wert gewesen wären.
//
// Was die Anwendung *nicht* von sich aus sagt, ist die verstrichene Zeit. Ein
// Antrag, der seit drei Tagen wartet, sieht in der Liste aus wie einer von
// heute morgen. Genau das ist der Anlass für eine Nachricht, und deshalb ist
// aus der Eingangsmeldung eine Erinnerung geworden.
//
// Vier Regeln tragen dieses Modul:
//
//   1. **Erst nach der Frist, dann höchstens einmal am Tag.** `ERINNERUNG_AB`
//      Tage ohne Entscheidung lösen die erste Mahnung aus; danach wiederholt
//      sie sich im Abstand von `WIEDERVORLAGE` Tagen, solange der Vorgang
//      liegt. Die Tabelle `erinnerungen` ist das Gedächtnis dafür — ohne sie
//      schickte jeder Seitenaufruf eine neue Mahnung.
//   2. **Nur was wirklich wartet.** Gelesen wird der Zustand, nicht das
//      Gedächtnis: entschieden, zurückgezogen oder gelöscht heißt, die Zeile
//      verschwindet wieder (`vergiss`, `feger`), damit ein wiedereingereichter
//      Vorgang seine Frist von vorn bekommt.
//   3. **Nichts hier hält je eine Antwort auf.** Der Lauf hängt an `after()`
//      und läuft, nachdem die Seite ausgeliefert ist; er wirft nicht, und der
//      Versand tut es ohnehin nicht. Wer eine Seite öffnet, wartet nie auf
//      einen Mailserver.
//   4. **Eine Mahnung ist keine zweite Warteschlange.** Sie enthält dieselben
//      Angaben wie die Prüfliste plus die Zahl, die dort fehlt: seit wann.
//
// Warum kein Cron: dieses Haus betreibt einen Container, keine Job-Verwaltung.
// Der Auslöser ist deshalb der erste Seitenaufruf des Tages — irgendwer meldet
// sich immer an, und wenn tagelang niemand hineinsieht, gibt es auch niemanden,
// den eine Mahnung erreichen würde.

import {getDb, type Abwesenheit, type Reise, type User} from './db';
import {istAntrag} from './abwesenheit-arten';
import {mitTagen} from './abwesenheit';
import {mitRechnung} from './spesen';
import {erinnereAnAbwesenheit, erinnereAnReise} from './benachrichtigungen';

/** Nach wie vielen Tagen ohne Entscheidung die erste Erinnerung hinausgeht. */
export const ERINNERUNG_AB = 3;

/** Und in welchem Abstand sie sich danach wiederholt, solange nichts geschieht. */
export const WIEDERVORLAGE = 3;

export type ErinnerungsBereich = 'abwesenheit' | 'reise';

interface ErinnerungsZeile {
  bereich: string;
  gegenstand_id: number;
  zuletzt_am: string;
  anzahl: number;
}

/**
 * Ganze Tage zwischen zwei UTC-Zeitstempeln der Form „JJJJ-MM-TT HH:MM:SS".
 * Bewusst ganze Tage und nicht Stunden: „seit 3 Tagen offen" ist die Aussage,
 * die jemand nachrechnen kann, und eine Mahnung nach 2,9 Tagen wäre keine
 * andere Nachricht, sondern nur eine unehrlichere.
 */
export function tageSeit(stempel: string, jetzt: Date = new Date()): number {
  const zeit = Date.parse(`${stempel.replace(' ', 'T')}Z`);
  if (Number.isNaN(zeit)) return 0;
  return Math.floor((jetzt.getTime() - zeit) / 86_400_000);
}

function gedaechtnis(bereich: ErinnerungsBereich, id: number): ErinnerungsZeile | null {
  return getDb()
    .query<ErinnerungsZeile, [string, number]>(
      'SELECT * FROM erinnerungen WHERE bereich = ? AND gegenstand_id = ?',
    )
    .get(bereich, id);
}

function merke(bereich: ErinnerungsBereich, id: number): void {
  getDb()
    .query(
      `INSERT INTO erinnerungen (bereich, gegenstand_id) VALUES (?, ?)
       ON CONFLICT(bereich, gegenstand_id)
       DO UPDATE SET zuletzt_am = datetime('now'), anzahl = anzahl + 1`,
    )
    .run(bereich, id);
}

/** Ein Vorgang ist entschieden oder zurückgezogen — sein Gedächtnis darf weg. */
export function vergiss(bereich: ErinnerungsBereich, id: number): void {
  try {
    getDb().query('DELETE FROM erinnerungen WHERE bereich = ? AND gegenstand_id = ?').run(bereich, id);
  } catch (fehler) {
    console.error('Erinnerung nicht gelöscht:', fehler);
  }
}

/**
 * Ob dieser Vorgang jetzt eine Mahnung bekommt: nach `ERINNERUNG_AB` Tagen die
 * erste, danach alle `WIEDERVORLAGE` Tage die nächste. Rein bis auf den Blick
 * ins Gedächtnis, damit die Frist an einer Stelle steht und geprüft werden kann.
 */
function faellig(bereich: ErinnerungsBereich, id: number, eingereichtAm: string, jetzt: Date): number | null {
  const wartet = tageSeit(eingereichtAm, jetzt);
  if (wartet < ERINNERUNG_AB) return null;
  const zeile = gedaechtnis(bereich, id);
  if (zeile && tageSeit(zeile.zuletzt_am, jetzt) < WIEDERVORLAGE) return null;
  return wartet;
}

interface OffenerAntrag extends Abwesenheit {
  user_name: string;
}

interface OffeneReise extends Reise {
  user_name: string;
}

/**
 * Der Lauf. Sucht beide Warteschlangen nach Vorgängen ab, die die Frist
 * überschritten haben, und schickt je eine Erinnerung an den zuständigen
 * Prüfkreis. Gibt zurück, wie viele Mahnungen hinausgingen — für den Aufrufer
 * und für den Test; wirft unter keinen Umständen.
 */
export async function erinnerungslauf(jetzt: Date = new Date()): Promise<number> {
  let versendet = 0;
  try {
    versendet += await antraegeMahnen(jetzt);
    versendet += await reisenMahnen(jetzt);
    feger();
  } catch (fehler) {
    console.error('Erinnerungslauf fehlgeschlagen:', fehler);
  }
  return versendet;
}

async function antraegeMahnen(jetzt: Date): Promise<number> {
  const db = getDb();
  const offen = db
    .query<OffenerAntrag, []>(
      `SELECT a.*, u.name AS user_name FROM abwesenheiten a JOIN users u ON u.id = a.user_id
       WHERE a.status = 'eingereicht' AND a.eingereicht_at IS NOT NULL
       ORDER BY a.eingereicht_at`,
    )
    .all();
  let versendet = 0;
  for (const zeile of offen) {
    // Eine Meldung wartet auf niemanden; sie kann diesen Zustand gar nicht
    // haben, aber die Bedingung steht hier, statt sich darauf zu verlassen.
    if (!istAntrag(zeile.art)) continue;
    const tage = faellig('abwesenheit', zeile.id, zeile.eingereicht_at!, jetzt);
    if (tage === null) continue;
    const {user_name, ...rest} = zeile;
    const a = rest as Abwesenheit;
    // Nur Urlaub kostet Anspruch — dieselbe Zeile wie beim Einreichen in
    // app/actions.ts, damit die Mahnung dieselbe Zahl nennt wie die Prüfliste.
    const inhaber = db.query<User, [number]>('SELECT * FROM users WHERE id = ?').get(a.user_id);
    const kosten = inhaber && a.art === 'urlaub' ? mitTagen(a, inhaber).arbeitstage.length : null;
    const erreicht = await erinnereAnAbwesenheit(a, user_name, tage, kosten);
    // Erreicht die Mahnung niemanden — die Verwaltung hat ihren eigenen Antrag
    // eingereicht, und es gibt keine zweite Instanz —, dann ist auch nichts zu
    // merken. Ein Gedächtnis ohne Nachricht verschwiege die nächste an einen
    // Kreis, der inzwischen jemanden hat.
    if (erreicht === 0) continue;
    merke('abwesenheit', a.id);
    versendet++;
  }
  return versendet;
}

async function reisenMahnen(jetzt: Date): Promise<number> {
  const offen = getDb()
    .query<OffeneReise, []>(
      `SELECT r.*, u.name AS user_name FROM reisen r JOIN users u ON u.id = r.user_id
       WHERE r.status = 'eingereicht' AND r.eingereicht_at IS NOT NULL
       ORDER BY r.eingereicht_at`,
    )
    .all();
  let versendet = 0;
  for (const zeile of offen) {
    const tage = faellig('reise', zeile.id, zeile.eingereicht_at!, jetzt);
    if (tage === null) continue;
    const {user_name, ...rest} = zeile;
    const reise = rest as Reise;
    const {rechnung, belege} = mitRechnung(reise);
    const erreicht = await erinnereAnReise(reise, user_name, rechnung, belege.length, tage);
    if (erreicht === 0) continue;
    merke('reise', reise.id);
    versendet++;
  }
  return versendet;
}

/**
 * Zeilen zu Vorgängen, die niemand mehr prüft — entschieden, zurückgezogen,
 * gelöscht. Die Tabelle trägt bewusst keinen Fremdschlüssel (ein gelöschter
 * Antrag darf das Gedächtnis nicht mitreißen), also räumt sie sich hier auf.
 */
function feger(): void {
  const db = getDb();
  db.query(
    `DELETE FROM erinnerungen WHERE bereich = 'abwesenheit' AND gegenstand_id NOT IN
     (SELECT id FROM abwesenheiten WHERE status = 'eingereicht')`,
  ).run();
  db.query(
    `DELETE FROM erinnerungen WHERE bereich = 'reise' AND gegenstand_id NOT IN
     (SELECT id FROM reisen WHERE status = 'eingereicht')`,
  ).run();
}

/**
 * Der Auslöser aus der Schale — höchstens einmal pro `LAUF_ABSTAND_MS`.
 *
 * Die Bremse steht im Prozess und nicht in der Datenbank, weil sie nichts
 * garantieren muss: die eigentliche Frist hütet `erinnerungen`, und ein
 * Neustart, der einen Lauf zu viel auslöst, schickt deshalb keine Mahnung zu
 * viel. Was sie verhindert, ist der Aufwand — zwei Abfragen bei jedem einzelnen
 * Seitenaufruf jedes angemeldeten Kontos.
 */
const LAUF_ABSTAND_MS = 60 * 60 * 1000;
let letzterLauf = 0;

export function erinnerungslaufFaellig(jetzt: Date = new Date()): Promise<number> {
  if (jetzt.getTime() - letzterLauf < LAUF_ABSTAND_MS) return Promise.resolve(0);
  letzterLauf = jetzt.getTime();
  return erinnerungslauf(jetzt);
}
