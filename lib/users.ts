import {personAngabe, type AvatarKey, type PersonAngabe} from './avatar';
import {getDb, type Role, type User} from './db';
import {isBundesland} from './feiertage';
import {istBekanntesRecht} from './eigene-rechte';
import {hatRecht, vereinigeRechte, type Recht} from './rechte';
import {istRolle, rechteDerRolle, rolleLabel} from './rollen';
import {ABWAEHLBARE_ARTEN, istMailArt, type MailArt} from './mail-arten';

// Benutzerverwaltung — jeder Aufruf prüft das Recht `mitarbeiter.verwalten`.

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  weeklyMinutes: number;
  /** Two-letter code, or '' to follow the company-wide setting. */
  bundesland?: string;
  /** Jahresanspruch an Urlaubstagen. Der Übertrag wird je Jahr eigens gepflegt. */
  urlaubstageJahr: number;
  /** Zusatzrechte über das Rollenbündel hinaus. */
  extraRechte: Recht[];
}

/** Ein Konto samt seiner Zusatzrechte — die Zeile der Mitarbeiterverwaltung. */
export interface VerwalteterUser extends User {
  extra_rechte: Recht[];
}

/** Die je Konto vergebenen Zusatzrechte (nur die über das Rollenbündel hinaus). */
export function zusatzRechte(userId: number): Recht[] {
  return getDb()
    .query<{recht: string}, [number]>('SELECT recht FROM benutzer_rechte WHERE user_id = ? ORDER BY recht')
    .all(userId)
    .map((r) => r.recht)
    .filter(istBekanntesRecht) as Recht[];
}

function schreibeZusatzRechte(userId: number, role: Role, rechte: Recht[]): void {
  const db = getDb();
  db.query('DELETE FROM benutzer_rechte WHERE user_id = ?').run(userId);
  // Nur, was das Rollenbündel nicht ohnehin enthält — sonst bliebe ein
  // „Zusatzrecht" nach einem Rollenwechsel unsichtbar kleben.
  const buendel = new Set<string>(vereinigeRechte(rechteDerRolle(role)));
  for (const recht of new Set(rechte)) {
    if (!buendel.has(recht)) db.query('INSERT INTO benutzer_rechte (user_id, recht) VALUES (?, ?)').run(userId, recht);
  }
}

// ---------------------------------------------------------------------------
// Abbestellte Nachrichten
// ---------------------------------------------------------------------------

/**
 * Die Spalte `users.mail_abbestellt` als Liste. Gespeichert wird, was jemand
 * *nicht* will — so bekommt eine später hinzukommende Nachrichtenart
 * automatisch alle bisherigen Empfänger (siehe Migration 20 in lib/db.ts).
 */
export function abbestellteAus(roh: string): MailArt[] {
  return roh.split(',').map((s) => s.trim()).filter(istMailArt);
}

export function abbestellteArten(userId: number): MailArt[] {
  const row = getDb()
    .query<{mail_abbestellt: string}, [number]>('SELECT mail_abbestellt FROM users WHERE id = ?')
    .get(userId);
  return row ? abbestellteAus(row.mail_abbestellt) : [];
}

/**
 * Nicht abwählbare Arten fallen still heraus, statt einen Fehler zu erzeugen:
 * das Formular bietet sie gar nicht an, und ein manipulierter Post soll die
 * Zugangspost nicht abschalten können.
 */
export function setzeAbbestellteArten(userId: number, arten: MailArt[]): void {
  const erlaubt = arten.filter((art) => ABWAEHLBARE_ARTEN.includes(art));
  getDb()
    .query('UPDATE users SET mail_abbestellt = ? WHERE id = ?')
    .run([...new Set(erlaubt)].sort().join(','), userId);
}

export function allUsers(): VerwalteterUser[] {
  const rows = getDb()
    .query<User, []>(
      `SELECT id, email, name, role, weekly_minutes, active, created_at, bundesland, urlaubstage_jahr,
              avatar_key, avatar_datei
         FROM users ORDER BY active DESC, name`,
    )
    .all();
  return rows.map((u) => ({...u, extra_rechte: zusatzRechte(u.id)}));
}

/**
 * Die Personenangabe eines einzelnen Kontos — was die Personenkarte nachlädt,
 * wenn die Liste, aus der sie geöffnet wurde, nur Name und Bild mitgeschickt
 * hat. Bewusst dieselbe Angabe wie überall (`personAngabe`), damit die Karte
 * nichts zeigen kann, was eine Zeile nicht auch zeigen dürfte.
 */
export function personAngabeById(userId: number): PersonAngabe | null {
  const row = getDb()
    .query<
      {id: number; name: string; role: string; email: string; avatar_key: AvatarKey; avatar_datei: string | null},
      [number]
    >('SELECT id, name, role, email, avatar_key, avatar_datei FROM users WHERE id = ?')
    .get(userId);
  // Die Rolle geht als deutsches Wort hinaus, nicht als Schlüssel: die Karte
  // im Browser kann einen frei benannten Rollensatz nicht selbst übersetzen.
  return row ? {...personAngabe(row), rolle: rolleLabel(row.role)} : null;
}

function validateUserInput(actor: User, input: UserInput, excludeId?: number): string | null {
  if (!input.name.trim()) return 'Bitte einen Namen angeben.';
  if (input.extraRechte.includes('*') && !hatRecht(actor, '*')) {
    return 'Das Recht „Alle Rechte" kann nur vergeben, wer es selbst trägt.';
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'Bitte eine gültige E-Mail-Adresse angeben.';
  if (!istRolle(input.role)) return 'Ungültige Rolle.';
  if (input.extraRechte.some((r) => !istBekanntesRecht(r))) return 'Unbekanntes Recht.';
  if (input.weeklyMinutes < 60 || input.weeklyMinutes > 60 * 60) return 'Die Wochenstunden müssen zwischen 1 und 60 liegen.';
  if (input.bundesland && !isBundesland(input.bundesland)) return 'Unbekanntes Bundesland.';
  if (!Number.isInteger(input.urlaubstageJahr) || input.urlaubstageJahr < 0 || input.urlaubstageJahr > 365) {
    return 'Die Urlaubstage müssen zwischen 0 und 365 liegen.';
  }
  const existing = getDb()
    .query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?')
    .get(input.email.trim());
  if (existing && existing.id !== excludeId) return 'Diese E-Mail-Adresse ist bereits vergeben.';
  return null;
}

/** Readable one-time password: 4 groups from an unambiguous alphabet. */
export function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]!);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export async function createUser(
  actor: User,
  input: UserInput,
): Promise<{error: string} | {id: number; password: string}> {
  if (!hatRecht(actor, 'mitarbeiter.verwalten')) return {error: 'Keine Berechtigung.'};
  const invalid = validateUserInput(actor, input);
  if (invalid) return {error: invalid};
  const password = generatePassword();
  const hash = await Bun.password.hash(password);
  const db = getDb();
  db
    .query(
      `INSERT INTO users (
         email, password_hash, name, role, weekly_minutes, bundesland,
         urlaubstage_jahr, must_change_password, google_einrichtung_abgeschlossen
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
    )
    .run(
      input.email.trim(),
      hash,
      input.name.trim(),
      input.role,
      input.weeklyMinutes,
      input.bundesland || null,
      input.urlaubstageJahr,
    );
  const neu = db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(input.email.trim());
  if (neu) schreibeZusatzRechte(neu.id, input.role, input.extraRechte);
  // Die ID geht mit hinaus: der Aufrufer schickt die Willkommensnachricht und
  // soll die Adresse nicht ein zweites Mal aus dem Formular ziehen müssen.
  return {id: neu?.id ?? 0, password};
}

export function updateUser(actor: User, userId: number, input: UserInput): string | null {
  if (!hatRecht(actor, 'mitarbeiter.verwalten')) return 'Keine Berechtigung.';
  const invalid = validateUserInput(actor, input, userId);
  if (invalid) return invalid;
  // Wer sich selbst bearbeitet, darf sich die Benutzerverwaltung nicht nehmen —
  // sonst sperrte sich das letzte Verwalterkonto mit einem Klick selbst aus.
  if (actor.id === userId
      && !vereinigeRechte(rechteDerRolle(input.role), input.extraRechte).includes('mitarbeiter.verwalten')) {
    return 'Du kannst dir nicht selbst das Recht zur Benutzerverwaltung entziehen.';
  }
  const db = getDb();
  const vorher = db
    .query<{
      name: string;
      email: string;
      role: Role;
      weekly_minutes: number;
      bundesland: string | null;
      urlaubstage_jahr: number;
    }, [number]>(
      `SELECT name, email, role, weekly_minutes, bundesland, urlaubstage_jahr
       FROM users WHERE id = ?`,
    )
    .get(userId);
  const name = input.name.trim();
  const email = input.email.trim();
  const bundesland = input.bundesland || null;
  // Geänderte Zusatzrechte zählen bewusst nicht hinein: die profile_version
  // schickt jemanden erneut durch die Stammdaten-Bestätigung, und Rechte sind
  // keine Stammdaten, die die Person bestätigen müsste.
  const geaendert = Boolean(
    vorher && (
      vorher.name !== name ||
      vorher.email !== email ||
      vorher.role !== input.role ||
      vorher.weekly_minutes !== input.weeklyMinutes ||
      vorher.bundesland !== bundesland ||
      vorher.urlaubstage_jahr !== input.urlaubstageJahr
    ),
  );
  db
    .query(
      `UPDATE users SET name = ?, email = ?, role = ?, weekly_minutes = ?, bundesland = ?,
       urlaubstage_jahr = ?, profile_version = profile_version + ? WHERE id = ?`,
    )
    .run(
      name,
      email,
      input.role,
      input.weeklyMinutes,
      bundesland,
      input.urlaubstageJahr,
      geaendert ? 1 : 0,
      userId,
    );
  schreibeZusatzRechte(userId, input.role, input.extraRechte);
  return null;
}

export async function resetPassword(actor: User, userId: number): Promise<{error: string} | {password: string}> {
  if (!hatRecht(actor, 'mitarbeiter.verwalten')) return {error: 'Keine Berechtigung.'};
  const password = generatePassword();
  const hash = await Bun.password.hash(password);
  const db = getDb();
  db.query('UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?').run(hash, userId);
  db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return {password};
}

export function mussPasswortAendern(userId: number): boolean {
  const row = getDb()
    .query<{must_change_password: number}, [number]>(
      'SELECT must_change_password FROM users WHERE id = ? AND active = 1',
    )
    .get(userId);
  return row?.must_change_password === 1;
}

export async function eigenesPasswortAendern(
  userId: number,
  passwort: string,
): Promise<string | null> {
  if (passwort.length < 12) return 'Das neue Passwort muss mindestens 12 Zeichen lang sein.';
  if (!/[A-Za-zÄÖÜäöüß]/.test(passwort) || !/\d/.test(passwort)) {
    return 'Verwende mindestens einen Buchstaben und eine Zahl.';
  }
  const row = getDb()
    .query<{password_hash: string; must_change_password: number}, [number]>(
      'SELECT password_hash, must_change_password FROM users WHERE id = ? AND active = 1',
    )
    .get(userId);
  if (!row) return 'Das Mitarbeiterkonto wurde nicht gefunden.';
  if (row.must_change_password !== 1) return 'Für dieses Konto ist kein Passwortwechsel mehr offen.';
  if (await Bun.password.verify(passwort, row.password_hash)) {
    return 'Das neue Passwort darf nicht dem Startpasswort entsprechen.';
  }
  const hash = await Bun.password.hash(passwort);
  const result = getDb()
    .query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ? AND active = 1')
    .run(hash, userId);
  return result.changes === 1 ? null : 'Das Mitarbeiterkonto wurde nicht gefunden.';
}

export function setUserActive(actor: User, userId: number, active: boolean): string | null {
  if (!hatRecht(actor, 'mitarbeiter.verwalten')) return 'Keine Berechtigung.';
  if (!active) {
    if (actor.id === userId) return 'Du kannst dich nicht selbst deaktivieren.';
    // Mindestens ein aktives Konto muss Benutzer verwalten können — ob aus dem
    // Rollenbündel oder als Zusatzrecht, entscheidet hatRecht, nicht das SQL.
    const target = getDb().query<{role: Role}, [number]>('SELECT role FROM users WHERE id = ?').get(userId);
    const targetVerwaltet = target
      ? vereinigeRechte(rechteDerRolle(target.role), zusatzRechte(userId)).includes('mitarbeiter.verwalten')
      : false;
    if (targetVerwaltet) {
      const andere = getDb()
        .query<{id: number; role: Role}, [number]>('SELECT id, role FROM users WHERE active = 1 AND id != ?')
        .all(userId);
      const nochJemand = andere.some((u) =>
        vereinigeRechte(rechteDerRolle(u.role), zusatzRechte(u.id)).includes('mitarbeiter.verwalten'),
      );
      if (!nochJemand) return 'Das letzte Konto mit Benutzerverwaltung kann nicht deaktiviert werden.';
    }
  }
  const db = getDb();
  db.query('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, userId);
  if (!active) db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return null;
}
