// Verbundene Apps — MedArbeiter als Anmeldestelle. DB-gebunden wie
// lib/google.ts, nur mit vertauschten Rollen: dort holt sich MedArbeiter eine
// Identität bei Google, hier holen sich die anderen Hausanwendungen die
// Identität des angemeldeten Nutzers bei MedArbeiter (OAuth 2.0,
// Authorization-Code, opake Tokens — die Prüfung ist ein Datenbank-Nachschlag
// wie bei der Sitzung, kein Signaturverfahren).
//
// Was hier liegt: die Anbindungen (Verwaltung), das Ausstellen und Einlösen
// der Codes, das Ausstellen und Prüfen der Tokens. Die drei Endpunkte unter
// app/api/oauth/ sind nur die HTTP-Haut darüber.
//
// Geheimnisse verlassen dieses Modul genau einmal: das App-Geheimnis beim
// Anlegen/Erneuern (danach nur noch Bun.password-Hash), Codes und Tokens als
// Rückgabewert an den Endpunkt (gespeichert wird ihr SHA-256). Wer die
// Datenbank liest, kann sich damit nirgends anmelden.

import type {AvatarKey} from './avatar';
import {getDb, type User} from './db';
import {hatRecht, type Recht} from './rechte';
import {wirksameRechte} from './rollen';

/** Ein Code trägt genau einen Anmelde-Rundlauf; 60 s decken jede Weiterleitung. */
const CODE_TTL_MS = 60_000;
/** Die App liest einmal die Identität und führt danach ihre eigene Sitzung. */
const TOKEN_TTL_S = 3600;

export interface OauthClient {
  id: number;
  client_id: string;
  name: string;
  redirect_uris: string[];
  aktiv: 0 | 1;
  created_at: string;
}

interface ClientZeile {
  id: number;
  client_id: string;
  name: string;
  redirect_uris: string;
  aktiv: 0 | 1;
  created_at: string;
}

function ausZeile(zeile: ClientZeile): OauthClient {
  return {...zeile, redirect_uris: zeile.redirect_uris.split('\n').filter(Boolean)};
}

function sha256Hex(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text, 'utf8').digest('hex');
}

/** Opaker Wert nach dem Sitzungsmuster (lib/auth.ts): zweimal randomUUID. */
function opakerWert(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

/** Das App-Geheimnis: dieselbe Entropie, ohne Bindestriche — es wird als Passwort abgetippt oder kopiert. */
export function geheimnisErzeugen(): string {
  return opakerWert().replaceAll('-', '');
}

/**
 * Prüft eine Weiterleitungs-URI beim Registrieren. Absolut, http(s), ohne
 * Fragment; unverschlüsselt nur auf localhost — die Apps sind hauseigen, aber
 * ein Code auf offener Leitung bleibt ein Code auf offener Leitung.
 */
export function redirectUriGueltig(uri: string): string | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return 'Die Weiterleitungs-URI muss eine vollständige Adresse sein (https://…).';
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return 'Die Weiterleitungs-URI muss mit http(s) beginnen.';
  }
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    return 'Unverschlüsseltes http ist nur für localhost erlaubt.';
  }
  if (url.hash !== '') {
    return 'Die Weiterleitungs-URI darf kein Fragment (#…) enthalten.';
  }
  return null;
}

/**
 * Das eine erlaubte Rücksprungziel der Anmeldeseite (`/login?weiter=…`):
 * genau der eigene Autorisierungs-Endpunkt, als relativer Pfad. Ein festes
 * Präfix statt einer Liste — alles andere wäre der Anfang einer offenen
 * Weiterleitung.
 */
export function weiterZielGueltig(weiter: string | undefined | null): weiter is string {
  return typeof weiter === 'string' && weiter.startsWith('/api/oauth/authorize?');
}

// ---------------------------------------------------------------------------
// Anbindungen — die Verwaltung
// ---------------------------------------------------------------------------

export function oauthClients(): OauthClient[] {
  return getDb()
    .query<ClientZeile, []>('SELECT id, client_id, name, redirect_uris, aktiv, created_at FROM oauth_clients ORDER BY name')
    .all()
    .map(ausZeile);
}

export function oauthClientNachNummer(id: number): OauthClient | null {
  const zeile = getDb()
    .query<ClientZeile, [number]>('SELECT id, client_id, name, redirect_uris, aktiv, created_at FROM oauth_clients WHERE id = ?')
    .get(id);
  return zeile ? ausZeile(zeile) : null;
}

function pruefeEingabe(name: string, redirectUris: string[]): string | null {
  if (!name.trim()) return 'Bitte einen Namen für die App angeben.';
  if (name.trim().length > 80) return 'Der Name darf höchstens 80 Zeichen lang sein.';
  if (redirectUris.length === 0) return 'Bitte mindestens eine Weiterleitungs-URI angeben.';
  for (const uri of redirectUris) {
    const fehler = redirectUriGueltig(uri);
    if (fehler) return `${uri}: ${fehler}`;
  }
  return null;
}

export async function oauthClientAnlegen(
  actor: User,
  name: string,
  redirectUris: string[],
): Promise<{client: OauthClient; secret: string} | string> {
  if (!hatRecht(actor, 'apps.verwalten')) return 'Keine Berechtigung.';
  const fehler = pruefeEingabe(name, redirectUris);
  if (fehler) return fehler;
  const secret = geheimnisErzeugen();
  const zeile = getDb()
    .query<{id: number}, [string, string, string, string, number]>(
      `INSERT INTO oauth_clients (client_id, name, secret_hash, redirect_uris, erstellt_von)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(crypto.randomUUID(), name.trim(), await Bun.password.hash(secret), redirectUris.join('\n'), actor.id);
  const client = oauthClientNachNummer(zeile!.id)!;
  return {client, secret};
}

export function oauthClientAendern(
  actor: User,
  id: number,
  eingabe: {name: string; redirectUris: string[]},
): string | null {
  if (!hatRecht(actor, 'apps.verwalten')) return 'Keine Berechtigung.';
  if (!oauthClientNachNummer(id)) return 'Diese App-Anbindung gibt es nicht.';
  const fehler = pruefeEingabe(eingabe.name, eingabe.redirectUris);
  if (fehler) return fehler;
  getDb()
    .query('UPDATE oauth_clients SET name = ?, redirect_uris = ? WHERE id = ?')
    .run(eingabe.name.trim(), eingabe.redirectUris.join('\n'), id);
  return null;
}

/** Sperren statt löschen: eine gelöschte Anbindung risse per CASCADE auch die Spur ihrer Tokens mit. */
export function oauthClientSetzeAktiv(actor: User, id: number, aktiv: boolean): string | null {
  if (!hatRecht(actor, 'apps.verwalten')) return 'Keine Berechtigung.';
  if (!oauthClientNachNummer(id)) return 'Diese App-Anbindung gibt es nicht.';
  const db = getDb();
  db.query('UPDATE oauth_clients SET aktiv = ? WHERE id = ?').run(aktiv ? 1 : 0, id);
  if (!aktiv) {
    // Eine gesperrte App verliert sofort alles Ausgestellte, nicht erst beim Ablauf.
    db.query('DELETE FROM oauth_codes WHERE client_id = ?').run(id);
    db.query('DELETE FROM oauth_tokens WHERE client_id = ?').run(id);
  }
  return null;
}

/** Es gibt kein Ablesen des Geheimnisses — nur ein Ersetzen, wie beim Startpasswort. */
export async function oauthClientSecretErneuern(actor: User, id: number): Promise<{secret: string} | string> {
  if (!hatRecht(actor, 'apps.verwalten')) return 'Keine Berechtigung.';
  if (!oauthClientNachNummer(id)) return 'Diese App-Anbindung gibt es nicht.';
  const secret = geheimnisErzeugen();
  getDb().query('UPDATE oauth_clients SET secret_hash = ? WHERE id = ?').run(await Bun.password.hash(secret), id);
  return {secret};
}

// ---------------------------------------------------------------------------
// Der Anmelde-Rundlauf — Codes und Tokens
// ---------------------------------------------------------------------------

/** Nur aktive Anbindungen: eine gesperrte App ist für die Endpunkte unbekannt. */
export function oauthClientById(clientId: string): (OauthClient & {secret_hash: string}) | null {
  const zeile = getDb()
    .query<ClientZeile & {secret_hash: string}, [string]>(
      'SELECT id, client_id, name, secret_hash, redirect_uris, aktiv, created_at FROM oauth_clients WHERE client_id = ? AND aktiv = 1',
    )
    .get(clientId);
  return zeile ? {...ausZeile(zeile), secret_hash: zeile.secret_hash} : null;
}

export function codeAusstellen(client: OauthClient, userId: number, redirectUri: string): string {
  const db = getDb();
  const code = opakerWert();
  db.query('INSERT INTO oauth_codes (code_hash, client_id, user_id, redirect_uri, expires_at) VALUES (?, ?, ?, ?, ?)').run(
    sha256Hex(code),
    client.id,
    userId,
    redirectUri,
    Date.now() + CODE_TTL_MS,
  );
  // Abgelaufenes gleich mit abräumen — das Sitzungsmuster aus createSession().
  db.query('DELETE FROM oauth_codes WHERE expires_at < ?').run(Date.now());
  // Der bleibende Vermerk der Anmeldung: Tokens leben eine Stunde, dieser
  // Eintrag trägt „Angemeldete Apps" auf /profil.
  db.query(
    `INSERT INTO oauth_anmeldungen (client_id, user_id) VALUES (?, ?)
     ON CONFLICT(client_id, user_id) DO UPDATE SET zuletzt_at = datetime('now', 'localtime')`,
  ).run(client.id, userId);
  return code;
}

/**
 * Genau eine Einlösung. Wird ein Code ein zweites Mal vorgelegt, verlangt
 * RFC 6749 §4.1.2, die daraus hervorgegangenen Tokens zu widerrufen — wer den
 * Code zweimal hat, könnte der Falsche gewesen sein, und zwar auch beim
 * ersten Mal.
 */
export function codeEinloesen(
  client: OauthClient,
  code: string,
  redirectUri: string,
): {userId: number} | 'invalid_grant' {
  const db = getDb();
  return db.transaction((): {userId: number} | 'invalid_grant' => {
    const zeile = db
      .query<{client_id: number; user_id: number; redirect_uri: string; expires_at: number; eingeloest_at: number | null}, [string]>(
        'SELECT client_id, user_id, redirect_uri, expires_at, eingeloest_at FROM oauth_codes WHERE code_hash = ?',
      )
      .get(sha256Hex(code));
    if (!zeile || zeile.client_id !== client.id || zeile.redirect_uri !== redirectUri) return 'invalid_grant';
    if (zeile.eingeloest_at !== null) {
      db.query('DELETE FROM oauth_tokens WHERE client_id = ? AND user_id = ?').run(client.id, zeile.user_id);
      return 'invalid_grant';
    }
    if (zeile.expires_at < Date.now()) return 'invalid_grant';
    db.query('UPDATE oauth_codes SET eingeloest_at = ? WHERE code_hash = ?').run(Date.now(), sha256Hex(code));
    return {userId: zeile.user_id};
  })();
}

export function tokenAusstellen(client: OauthClient, userId: number): {token: string; expiresIn: number} {
  const db = getDb();
  const token = opakerWert();
  db.query('INSERT INTO oauth_tokens (token_hash, client_id, user_id, expires_at) VALUES (?, ?, ?, ?)').run(
    sha256Hex(token),
    client.id,
    userId,
    Date.now() + TOKEN_TTL_S * 1000,
  );
  db.query('DELETE FROM oauth_tokens WHERE expires_at < ?').run(Date.now());
  return {token, expiresIn: TOKEN_TTL_S};
}

/**
 * Der Nachschlag hinter /api/oauth/userinfo. `active = 1` steht im Join: ein
 * deaktiviertes Konto hört sofort auf, sich anzumelden, auch mit lebendem
 * Token — dieselbe Haltung wie in getSessionUser().
 */
export function tokenPruefen(token: string): {user: User & {rechte: Recht[]}; clientId: number} | null {
  const db = getDb();
  const zeile = db
    .query<
      {
        client_id: number;
        expires_at: number;
        id: number;
        email: string;
        name: string;
        role: string;
        weekly_minutes: number;
        active: number;
        created_at: string;
        urlaubstage_jahr: number;
        avatar_key: AvatarKey;
        avatar_datei: string | null;
      },
      [string]
    >(
      `SELECT t.client_id, t.expires_at,
              u.id, u.email, u.name, u.role, u.weekly_minutes, u.active, u.created_at, u.urlaubstage_jahr,
              u.avatar_key, u.avatar_datei
       FROM oauth_tokens t JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? AND u.active = 1`,
    )
    .get(sha256Hex(token));
  if (!zeile) return null;
  if (zeile.expires_at < Date.now()) {
    db.query('DELETE FROM oauth_tokens WHERE token_hash = ?').run(sha256Hex(token));
    return null;
  }
  const {client_id, expires_at: _ablauf, ...userZeile} = zeile;
  const extra = db
    .query<{recht: string}, [number]>('SELECT recht FROM benutzer_rechte WHERE user_id = ?')
    .all(userZeile.id)
    .map((r) => r.recht);
  const user = {...userZeile, rechte: wirksameRechte(userZeile.role, extra)} as User & {rechte: Recht[]};
  return {user, clientId: client_id};
}

/** Beim Deaktivieren eines Kontos aufgerufen, neben dem Google-Trennen: die Tokens gehen mit dem Zugang. */
export function oauthTokensEntziehen(userId: number): void {
  const db = getDb();
  db.query('DELETE FROM oauth_tokens WHERE user_id = ?').run(userId);
  db.query('DELETE FROM oauth_codes WHERE user_id = ?').run(userId);
}

// ---------------------------------------------------------------------------
// Angemeldete Apps — die Sicht der Person selbst (/profil)
// ---------------------------------------------------------------------------

export interface AppAnmeldung {
  /** Interne Nummer der Anbindung (oauth_clients.id) — nie die client_id. */
  clientNummer: number;
  name: string;
  zuletztAt: string;
}

/** Die aktiven Anbindungen, bei denen sich diese Person je angemeldet hat, jüngste zuerst. */
export function appAnmeldungenFuer(userId: number): AppAnmeldung[] {
  return getDb()
    .query<AppAnmeldung, [number]>(
      `SELECT c.id AS clientNummer, c.name, a.zuletzt_at AS zuletztAt
       FROM oauth_anmeldungen a
       JOIN oauth_clients c ON c.id = a.client_id AND c.aktiv = 1
       WHERE a.user_id = ?
       ORDER BY a.zuletzt_at DESC`,
    )
    .all(userId);
}

/**
 * Beendet den Zugriff einer App auf das eigene Konto: Tokens, offene Codes
 * und der Anmeldevermerk gehen. Die eigene Sitzung *in* der App endet erst
 * mit deren Abmeldung — der Hub gibt ihr nur nichts mehr heraus.
 */
export function appZugriffBeenden(userId: number, clientNummer: number): {name: string} | null {
  const db = getDb();
  const zeile = db
    .query<{name: string}, [number, number]>(
      `SELECT c.name FROM oauth_anmeldungen a
       JOIN oauth_clients c ON c.id = a.client_id
       WHERE a.user_id = ? AND a.client_id = ?`,
    )
    .get(userId, clientNummer);
  if (!zeile) return null;
  db.query('DELETE FROM oauth_tokens WHERE user_id = ? AND client_id = ?').run(userId, clientNummer);
  db.query('DELETE FROM oauth_codes WHERE user_id = ? AND client_id = ?').run(userId, clientNummer);
  db.query('DELETE FROM oauth_anmeldungen WHERE user_id = ? AND client_id = ?').run(userId, clientNummer);
  return zeile;
}
