// Dienstfahrzeug — der Datensatz. DB-gebunden wie lib/spesen.ts: jede Funktion
// gibt eine deutsche Meldung oder null zurück, Berechtigung und Zustand werden
// hier geprüft und nicht in der Server Action.
//
// Zwei Dinge, zwei Wege. Ein Tank- oder Ladebeleg wird einzeln hochgeladen
// und einzeln abgerechnet — er braucht keinen Rahmen. Ein Servicefall
// (Reparatur, Inspektion, Reifen) ist ein Zeitraum, der mehrere Belege
// sammelt, bis er geschlossen wird; die Verwaltung übernimmt ihn dann als
// Ganzes. „Abgerechnet" ist in beiden Fällen der Endzustand: unveränderlich.
// Eigene Rechte: `fahrzeug.erfassen` (nicht in den Grundbündeln — wer keinen
// Wagen hat, sieht die Seite nicht), `fahrzeug.abrechnen` für die Verwaltung.

import type {FallAnsicht, TankbelegAnsicht} from '@/components/fahrzeug-ansicht';
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

interface PersonSpalten {
  user_name: string;
  user_role: string;
  user_email: string;
  avatar_key: AvatarKey;
  avatar_datei: string | null;
}

export interface FallMitBelegen {
  fall: FahrzeugFall;
  belege: FahrzeugBeleg[];
  summeCent: number;
  /** Nur in der Abrechnungsliste gesetzt: wessen Fall das ist. */
  person: PersonAngabe | null;
}

export interface TankbelegMitPerson {
  beleg: FahrzeugBeleg;
  person: PersonAngabe | null;
}

function canEdit(actor: User, ownerId: number): boolean {
  return hatRecht(actor, 'fahrzeug.abrechnen') || actor.id === ownerId;
}

function personAus(row: PersonSpalten, userId: number): PersonAngabe {
  return {
    ...personAngabe({id: userId, name: row.user_name, email: row.user_email, avatar_key: row.avatar_key, avatar_datei: row.avatar_datei}),
    rolle: rolleLabel(row.user_role),
  };
}

const PERSON_JOIN = 'u.name AS user_name, u.role AS user_role, u.email AS user_email, u.avatar_key, u.avatar_datei';

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export function fallById(id: number): FahrzeugFall | null {
  return getDb().query<FahrzeugFall, [number]>('SELECT * FROM fahrzeug_faelle WHERE id = ?').get(id);
}

export function fahrzeugBelegById(id: number): FahrzeugBeleg | null {
  return getDb().query<FahrzeugBeleg, [number]>('SELECT * FROM fahrzeug_belege WHERE id = ?').get(id);
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

/** Die eigenen Servicefälle, offene zuerst, dann die jüngsten. */
export function faelleFor(userId: number): FallMitBelegen[] {
  return getDb()
    .query<FahrzeugFall, [number]>(
      `SELECT * FROM fahrzeug_faelle WHERE user_id = ?
       ORDER BY CASE status WHEN 'offen' THEN 0 ELSE 1 END, von DESC, id DESC`,
    )
    .all(userId)
    .map((f) => mitBelegen(f));
}

/** Die eigenen Tank- und Ladebelege, jüngste zuerst. */
export function tankbelegeFor(userId: number): TankbelegMitPerson[] {
  return getDb()
    .query<FahrzeugBeleg, [number]>(
      'SELECT * FROM fahrzeug_belege WHERE user_id = ? AND fall_id IS NULL ORDER BY datum DESC, id DESC',
    )
    .all(userId)
    .map((beleg) => ({beleg, person: null}));
}

/**
 * Die Liste der Verwaltung. `offen` heißt hier „bereit zur Abrechnung":
 * ein Tankbeleg, sobald er da ist, ein Servicefall erst, wenn er geschlossen ist.
 */
export type AbrechnungsFilter = 'offen' | 'abgerechnet' | 'alle';

export function faelleZurAbrechnung(filter: AbrechnungsFilter): FallMitBelegen[] {
  const wo = filter === 'offen' ? "WHERE f.status = 'geschlossen'" : filter === 'abgerechnet' ? "WHERE f.status = 'abgerechnet'" : '';
  return getDb()
    .query<FahrzeugFall & PersonSpalten, []>(
      `SELECT f.*, ${PERSON_JOIN} FROM fahrzeug_faelle f JOIN users u ON u.id = f.user_id ${wo} ORDER BY f.bis, f.von, f.id`,
    )
    .all()
    .map(({user_name, user_role, user_email, avatar_key, avatar_datei, ...fall}) =>
      mitBelegen(fall as FahrzeugFall, personAus({user_name, user_role, user_email, avatar_key, avatar_datei}, fall.user_id)),
    );
}

export function tankbelegeZurAbrechnung(filter: AbrechnungsFilter): TankbelegMitPerson[] {
  const wo = filter === 'offen' ? 'AND b.abgerechnet_at IS NULL' : filter === 'abgerechnet' ? 'AND b.abgerechnet_at IS NOT NULL' : '';
  return getDb()
    .query<FahrzeugBeleg & PersonSpalten, []>(
      `SELECT b.*, ${PERSON_JOIN} FROM fahrzeug_belege b JOIN users u ON u.id = b.user_id
       WHERE b.fall_id IS NULL ${wo} ORDER BY u.name, b.datum, b.id`,
    )
    .all()
    .map(({user_name, user_role, user_email, avatar_key, avatar_datei, ...beleg}) => ({
      beleg: beleg as FahrzeugBeleg,
      person: personAus({user_name, user_role, user_email, avatar_key, avatar_datei}, beleg.user_id),
    }));
}

/** Für die Seitenleiste: Tankbelege plus geschlossene Fälle, die auf die Abrechnung warten. */
export function abzurechnen(): number {
  const db = getDb();
  return (
    db.query<{c: number}, []>('SELECT count(*) AS c FROM fahrzeug_belege WHERE fall_id IS NULL AND abgerechnet_at IS NULL').get()!.c +
    db.query<{c: number}, []>("SELECT count(*) AS c FROM fahrzeug_faelle WHERE status = 'geschlossen'").get()!.c
  );
}

// ---------------------------------------------------------------------------
// Belege — Tanken/Laden einzeln, Service im Fall
// ---------------------------------------------------------------------------

function pruefeBeleg(input: FahrzeugBelegInput, fruehestens: string): string | null {
  if (!Number.isInteger(input.betragCent) || input.betragCent <= 0) return 'Bitte einen Betrag größer als 0,00 € angeben.';
  if (!input.datei) return 'Bitte den Beleg als Foto oder PDF anhängen.';
  if (input.datum < fruehestens || input.datum > todayISO()) {
    return fruehestens === '0000-00-00'
      ? 'Das Belegdatum liegt in der Zukunft.'
      : 'Das Belegdatum muss zwischen dem Beginn des Falls und heute liegen.';
  }
  return null;
}

/**
 * Ein Beleg zu einer Person — mit `fallId` als Servicebeleg in einen offenen
 * Fall, ohne als Tank-/Ladebeleg für sich.
 */
export function addFahrzeugBeleg(actor: User, userId: number, fallId: number | null, input: FahrzeugBelegInput): string | null {
  if (!canEdit(actor, userId)) return 'Keine Berechtigung.';
  let fruehestens = '0000-00-00';
  if (fallId !== null) {
    const fall = fallById(fallId);
    if (!fall || fall.user_id !== userId) return 'Fall nicht gefunden.';
    if (fall.status !== 'offen') return 'Ein geschlossener Fall nimmt keine Belege mehr an – öffne ihn wieder.';
    if (input.art !== 'service') return 'In einen Servicefall gehören Servicebelege.';
    fruehestens = fall.von;
  } else if (input.art === 'service') {
    return 'Ein Servicebeleg gehört in einen Servicefall.';
  }
  const invalid = pruefeBeleg(input, fruehestens);
  if (invalid) return invalid;
  getDb()
    .query(
      `INSERT INTO fahrzeug_belege (user_id, fall_id, art, datum, betrag_cent, beschreibung, datei, datei_name, datei_typ)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, fallId, input.art, input.datum, input.betragCent, input.beschreibung?.trim() || null, input.datei!, input.dateiName ?? null, input.dateiTyp ?? null);
  return null;
}

export function deleteFahrzeugBeleg(actor: User, belegId: number): string | null {
  const beleg = fahrzeugBelegById(belegId);
  if (!beleg) return 'Beleg nicht gefunden.';
  if (!canEdit(actor, beleg.user_id)) return 'Keine Berechtigung.';
  if (beleg.fall_id !== null) {
    const fall = fallById(beleg.fall_id);
    if (fall?.status === 'abgerechnet') return 'Ein abgerechneter Fall ändert sich nicht mehr.';
    if (fall?.status !== 'offen') return 'Ein geschlossener Fall ändert seine Belege nicht – öffne ihn wieder.';
  } else if (beleg.abgerechnet_at) {
    return 'Ein abgerechneter Beleg ändert sich nicht mehr.';
  }
  loescheBelegDatei(beleg.datei);
  getDb().query('DELETE FROM fahrzeug_belege WHERE id = ?').run(belegId);
  return null;
}

/** Einen einzelnen Tank-/Ladebeleg in die Abrechnung übernehmen. */
export function tankbelegAbrechnen(actor: User, belegId: number): string | null {
  if (!hatRecht(actor, 'fahrzeug.abrechnen')) return 'Keine Berechtigung.';
  const beleg = fahrzeugBelegById(belegId);
  if (!beleg || beleg.fall_id !== null) return 'Beleg nicht gefunden.';
  if (beleg.abgerechnet_at) return 'Dieser Beleg ist bereits abgerechnet.';
  getDb()
    .query(`UPDATE fahrzeug_belege SET abgerechnet_von = ?, abgerechnet_at = datetime('now') WHERE id = ?`)
    .run(actor.id, belegId);
  return null;
}

// ---------------------------------------------------------------------------
// Servicefälle
// ---------------------------------------------------------------------------

function pruefeFall(input: FallInput): string | null {
  if (input.titel.trim() === '') return 'Bitte den Fall benennen, z. B. „Inspektion" oder „Reifenwechsel".';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.von)) return 'Bitte ein Datum für den Beginn angeben.';
  if (input.von > todayISO()) return 'Ein Fall beginnt nicht in der Zukunft.';
  return null;
}

/**
 * Legt den Fall an — mit dem ersten Beleg in derselben Transaktion, denn ein
 * Servicefall entsteht, weil eine Rechnung da ist. Scheitert der Beleg, gibt
 * es auch keinen Fall.
 */
export function createFall(actor: User, userId: number, input: FallInput, erster: FahrzeugBelegInput): string | null {
  if (!canEdit(actor, userId)) return 'Keine Berechtigung.';
  const invalid = pruefeFall(input);
  if (invalid) return invalid;
  const db = getDb();
  try {
    db.transaction(() => {
      db.query('INSERT INTO fahrzeug_faelle (user_id, titel, von) VALUES (?, ?, ?)').run(userId, input.titel.trim(), input.von);
      const fallId = db.query<{id: number}, []>('SELECT last_insert_rowid() AS id').get()!.id;
      const fehler = addFahrzeugBeleg(actor, userId, fallId, {...erster, art: 'service'});
      if (fehler) throw new Error(fehler);
    }).immediate();
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : 'Der Fall konnte nicht angelegt werden.';
  }
}

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
  const invalid = pruefeFall(input);
  if (invalid) return invalid;
  if (fall.bis && input.von > fall.bis) return 'Der Beginn liegt nach dem Ende des Falls.';
  const fruehester = getDb()
    .query<{d: string | null}, [number]>('SELECT min(datum) AS d FROM fahrzeug_belege WHERE fall_id = ?')
    .get(id)?.d;
  if (fruehester && input.von > fruehester) return 'Ein Beleg liegt vor diesem Beginn.';
  getDb()
    .query(`UPDATE fahrzeug_faelle SET titel = ?, von = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(input.titel.trim(), input.von, id);
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
  if (!hatRecht(actor, 'fahrzeug.abrechnen')) return 'Keine Berechtigung.';
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
// Für den Browser
// ---------------------------------------------------------------------------

function belegAnsicht(b: FahrzeugBeleg) {
  return {
    id: b.id,
    art: b.art,
    artLabel: FAHRZEUG_BELEG_ART_LABEL[b.art],
    datum: b.datum,
    betragCent: b.betrag_cent,
    beschreibung: b.beschreibung,
    hatDatei: b.datei !== null,
  };
}

export function tankbelegAnsicht({beleg, person}: TankbelegMitPerson, actor: User): TankbelegAnsicht {
  const abgerechnet = beleg.abgerechnet_at !== null;
  return {
    ...belegAnsicht(beleg),
    person,
    abgerechnet,
    darfLoeschen: !abgerechnet && canEdit(actor, beleg.user_id),
    darfAbrechnen: !abgerechnet && hatRecht(actor, 'fahrzeug.abrechnen'),
  };
}

export function fallAnsicht(eintrag: FallMitBelegen, actor: User): FallAnsicht {
  const {fall, belege, summeCent, person} = eintrag;
  return {
    id: fall.id,
    titel: fall.titel,
    von: fall.von,
    bis: fall.bis,
    status: fall.status,
    statusLabel: FALL_STATUS_LABEL[fall.status],
    summeCent,
    person,
    darfBearbeiten: canEdit(actor, fall.user_id) && fall.status === 'offen',
    darfAbrechnen: hatRecht(actor, 'fahrzeug.abrechnen') && fall.status === 'geschlossen',
    belege: belege.map(belegAnsicht),
  };
}
