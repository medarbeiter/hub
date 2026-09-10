// Dienstfahrzeug — der Datensatz. DB-gebunden wie lib/spesen.ts: jede Funktion
// gibt eine deutsche Meldung oder null zurück, Berechtigung und Zustand werden
// hier geprüft und nicht in der Server Action.
//
// Ein Fall ist ein Zeitraum, der Belege sammelt: Tanken, Laden, Service. Er
// beginnt am Tag `von`, nimmt Belege auf, solange er offen ist, und wird mit
// `bis` geschlossen. Die Verwaltung übernimmt einen geschlossenen Fall in die
// Abrechnung („abgerechnet") — danach ist er unveränderlich. Die Rechte sind die
// der Spesen: ein Tankbeleg ist eine Auslage wie ein Parkticket.

import type {FallAnsicht} from '@/components/fahrzeug-ansicht';
import {personAngabe, type AvatarKey, type PersonAngabe} from './avatar';
import {getDb, type FahrzeugBeleg, type FahrzeugBelegArt, type FahrzeugFall, type FahrzeugFallStatus, type User} from './db';
import {todayISO} from './format';
import {hatRecht} from './rechte';
import {rolleLabel} from './rollen';
import {loescheBelegDatei} from './spesen';

export const FALL_STATUS_LABEL: Record<FahrzeugFallStatus, string> = {
  offen: 'Offen',
  geschlossen: 'Geschlossen',
  abgerechnet: 'Abgerechnet',
};

export const FAHRZEUG_BELEG_ART_LABEL: Record<FahrzeugBelegArt, string> = {
  tanken: 'Tanken',
  laden: 'Laden',
  service: 'Service',
};

export const FAHRZEUG_BELEG_ARTEN: FahrzeugBelegArt[] = ['tanken', 'laden', 'service'];

export interface FallInput {
  titel: string;
  kennzeichen?: string;
  von: string;
}

export interface FahrzeugBelegInput {
  art: FahrzeugBelegArt;
  datum: string;
  betragCent: number;
  beschreibung?: string;
  datei?: string;
  dateiName?: string;
  dateiTyp?: string;
}

export interface FallMitBelegen {
  fall: FahrzeugFall;
  belege: FahrzeugBeleg[];
  summeCent: number;
  /** Nur in der Prüfliste gesetzt: wessen Fall das ist. */
  person: PersonAngabe | null;
}

function canEdit(actor: User, ownerId: number): boolean {
  return hatRecht(actor, 'spesen.pruefen') || actor.id === ownerId;
}

export function fallById(id: number): FahrzeugFall | null {
  return getDb().query<FahrzeugFall, [number]>('SELECT * FROM fahrzeug_faelle WHERE id = ?').get(id);
}

export function fahrzeugBelegeFor(fallId: number): FahrzeugBeleg[] {
  return getDb()
    .query<FahrzeugBeleg, [number]>('SELECT * FROM fahrzeug_belege WHERE fall_id = ? ORDER BY datum, id')
    .all(fallId);
}

function mitBelegen(fall: FahrzeugFall, person: PersonAngabe | null = null): FallMitBelegen {
  const belege = fahrzeugBelegeFor(fall.id);
  return {fall, belege, summeCent: belege.reduce((s, b) => s + b.betrag_cent, 0), person};
}

/** Die eigenen Fälle, offene zuerst, dann die jüngsten. */
export function faelleFor(userId: number): FallMitBelegen[] {
  return getDb()
    .query<FahrzeugFall, [number]>(
      `SELECT * FROM fahrzeug_faelle WHERE user_id = ?
       ORDER BY CASE status WHEN 'offen' THEN 0 ELSE 1 END, von DESC, id DESC`,
    )
    .all(userId)
    .map((f) => mitBelegen(f));
}

interface PersonSpalten {
  user_name: string;
  user_role: string;
  user_email: string;
  avatar_key: AvatarKey;
  avatar_datei: string | null;
}

/** Die Liste der Verwaltung: geschlossene Fälle warten auf die Abrechnung. */
export function faelleZurAbrechnung(status: FahrzeugFallStatus | 'alle' = 'geschlossen'): FallMitBelegen[] {
  const sql = `SELECT f.*, u.name AS user_name, u.role AS user_role, u.email AS user_email, u.avatar_key, u.avatar_datei
     FROM fahrzeug_faelle f JOIN users u ON u.id = f.user_id
     ${status === 'alle' ? '' : 'WHERE f.status = ?'} ORDER BY f.bis, f.von, f.id`;
  const rows =
    status === 'alle'
      ? getDb().query<FahrzeugFall & PersonSpalten, []>(sql).all()
      : getDb().query<FahrzeugFall & PersonSpalten, [string]>(sql).all(status);
  return rows.map(({user_name, user_role, user_email, avatar_key, avatar_datei, ...fall}) =>
    mitBelegen(fall as FahrzeugFall, {
      ...personAngabe({id: fall.user_id, name: user_name, email: user_email, avatar_key, avatar_datei}),
      rolle: rolleLabel(user_role),
    }),
  );
}

function pruefeInput(input: FallInput): string | null {
  if (input.titel.trim() === '') return 'Bitte den Fall benennen, z. B. „Tanken September" oder „Inspektion".';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.von)) return 'Bitte ein Datum für den Beginn angeben.';
  if (input.von > todayISO()) return 'Ein Fall beginnt nicht in der Zukunft.';
  return null;
}

export function createFall(actor: User, userId: number, input: FallInput): string | null {
  if (!canEdit(actor, userId)) return 'Keine Berechtigung.';
  const invalid = pruefeInput(input);
  if (invalid) return invalid;
  getDb()
    .query('INSERT INTO fahrzeug_faelle (user_id, titel, kennzeichen, von) VALUES (?, ?, ?, ?)')
    .run(userId, input.titel.trim(), input.kennzeichen?.trim() || null, input.von);
  return null;
}

/** Was nach einer Zustandsprüfung noch geändert werden darf. */
function aenderbar(actor: User, fall: FahrzeugFall): string | null {
  if (!canEdit(actor, fall.user_id)) return 'Keine Berechtigung.';
  if (fall.status === 'abgerechnet') return 'Ein abgerechneter Fall ändert sich nicht mehr.';
  return null;
}

export function updateFall(actor: User, id: number, input: FallInput): string | null {
  const fall = fallById(id);
  if (!fall) return 'Fall nicht gefunden.';
  const gesperrt = aenderbar(actor, fall);
  if (gesperrt) return gesperrt;
  const invalid = pruefeInput(input);
  if (invalid) return invalid;
  if (fall.bis && input.von > fall.bis) return 'Der Beginn liegt nach dem Ende des Falls.';
  const fruehester = getDb()
    .query<{d: string | null}, [number]>('SELECT min(datum) AS d FROM fahrzeug_belege WHERE fall_id = ?')
    .get(id)?.d;
  if (fruehester && input.von > fruehester) return 'Ein Beleg liegt vor diesem Beginn.';
  getDb()
    .query(
      `UPDATE fahrzeug_faelle SET titel = ?, kennzeichen = ?, von = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .run(input.titel.trim(), input.kennzeichen?.trim() || null, input.von, id);
  return null;
}

export function schliessen(actor: User, id: number): string | null {
  const fall = fallById(id);
  if (!fall) return 'Fall nicht gefunden.';
  const gesperrt = aenderbar(actor, fall);
  if (gesperrt) return gesperrt;
  if (fall.status !== 'offen') return 'Dieser Fall ist bereits geschlossen.';
  getDb()
    .query(`UPDATE fahrzeug_faelle SET status = 'geschlossen', bis = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(todayISO(), id);
  return null;
}

export function wiedereroeffnen(actor: User, id: number): string | null {
  const fall = fallById(id);
  if (!fall) return 'Fall nicht gefunden.';
  const gesperrt = aenderbar(actor, fall);
  if (gesperrt) return gesperrt;
  if (fall.status !== 'geschlossen') return 'Nur ein geschlossener Fall lässt sich wieder öffnen.';
  getDb()
    .query(`UPDATE fahrzeug_faelle SET status = 'offen', bis = NULL, updated_at = datetime('now') WHERE id = ?`)
    .run(id);
  return null;
}

export function abrechnen(actor: User, id: number): string | null {
  if (!hatRecht(actor, 'spesen.pruefen')) return 'Keine Berechtigung.';
  const fall = fallById(id);
  if (!fall) return 'Fall nicht gefunden.';
  if (fall.status !== 'geschlossen') return 'Nur ein geschlossener Fall kann abgerechnet werden.';
  getDb()
    .query(
      `UPDATE fahrzeug_faelle SET status = 'abgerechnet', abgerechnet_von = ?, abgerechnet_at = datetime('now'),
       updated_at = datetime('now') WHERE id = ?`,
    )
    .run(actor.id, id);
  return null;
}

export function deleteFall(actor: User, id: number): string | null {
  const fall = fallById(id);
  if (!fall) return 'Fall nicht gefunden.';
  const gesperrt = aenderbar(actor, fall);
  if (gesperrt) return gesperrt;
  for (const beleg of fahrzeugBelegeFor(id)) loescheBelegDatei(beleg.datei);
  getDb().query('DELETE FROM fahrzeug_faelle WHERE id = ?').run(id);
  return null;
}

// ---------------------------------------------------------------------------
// Belege
// ---------------------------------------------------------------------------

export function addFahrzeugBeleg(actor: User, fallId: number, input: FahrzeugBelegInput): string | null {
  const fall = fallById(fallId);
  if (!fall) return 'Fall nicht gefunden.';
  const gesperrt = aenderbar(actor, fall);
  if (gesperrt) return gesperrt;
  if (fall.status !== 'offen') return 'Ein geschlossener Fall nimmt keine Belege mehr an – öffne ihn wieder.';
  if (!Number.isInteger(input.betragCent) || input.betragCent <= 0) {
    return 'Bitte einen Betrag größer als 0,00 € angeben.';
  }
  if (input.datum < fall.von || input.datum > todayISO()) {
    return 'Das Belegdatum muss zwischen dem Beginn des Falls und heute liegen.';
  }
  getDb()
    .query(
      `INSERT INTO fahrzeug_belege (fall_id, art, datum, betrag_cent, beschreibung, datei, datei_name, datei_typ)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      fallId,
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

export function fahrzeugBelegById(id: number): (FahrzeugBeleg & {user_id: number}) | null {
  return getDb()
    .query<FahrzeugBeleg & {user_id: number}, [number]>(
      'SELECT b.*, f.user_id AS user_id FROM fahrzeug_belege b JOIN fahrzeug_faelle f ON f.id = b.fall_id WHERE b.id = ?',
    )
    .get(id);
}

export function deleteFahrzeugBeleg(actor: User, belegId: number): string | null {
  const beleg = fahrzeugBelegById(belegId);
  if (!beleg) return 'Beleg nicht gefunden.';
  const fall = fallById(beleg.fall_id);
  if (!fall) return 'Fall nicht gefunden.';
  const gesperrt = aenderbar(actor, fall);
  if (gesperrt) return gesperrt;
  if (fall.status !== 'offen') return 'Ein geschlossener Fall ändert seine Belege nicht – öffne ihn wieder.';
  loescheBelegDatei(beleg.datei);
  getDb().query('DELETE FROM fahrzeug_belege WHERE id = ?').run(belegId);
  return null;
}

// ---------------------------------------------------------------------------
// Für den Browser
// ---------------------------------------------------------------------------

export function fallAnsicht(eintrag: FallMitBelegen, actor: User): FallAnsicht {
  const {fall, belege, summeCent, person} = eintrag;
  const darfAendern = hatRecht(actor, 'spesen.pruefen') || actor.id === fall.user_id;
  return {
    id: fall.id,
    titel: fall.titel,
    kennzeichen: fall.kennzeichen,
    von: fall.von,
    bis: fall.bis,
    status: fall.status,
    statusLabel: FALL_STATUS_LABEL[fall.status],
    summeCent,
    person,
    darfBearbeiten: darfAendern && fall.status === 'offen',
    darfAbrechnen: hatRecht(actor, 'spesen.pruefen') && fall.status === 'geschlossen',
    belege: belege.map((b) => ({
      id: b.id,
      art: b.art,
      artLabel: FAHRZEUG_BELEG_ART_LABEL[b.art],
      datum: b.datum,
      betragCent: b.betrag_cent,
      beschreibung: b.beschreibung,
      hatDatei: b.datei !== null,
    })),
  };
}
