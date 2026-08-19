// Google-Anbindung — das Konto. DB-gebunden wie lib/spesen.ts: hier liegen
// Autorisierungs-URL, Code-Tausch, Token-Auffrischung und Trennung. Was mit
// dem verbundenen Konto geschieht (der Kalender-Abgleich), steht in
// lib/google-kalender.ts — dieselbe Teilung wie Konto und Buchung überall
// sonst im Haus.
//
// Die Zugangsdaten der Anwendung kommen aus der Umgebung: GOOGLE_CLIENT_ID
// und GOOGLE_CLIENT_SECRET aus der Google Cloud Console (OAuth-Client vom Typ
// „Webanwendung", Weiterleitungs-URI `<Basis>/api/google/callback`). Ohne sie
// ist die Anbindung nicht konfiguriert und jede Funktion hier sagt das ehrlich.

import {getDb} from './db';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';

/**
 * `calendar.events` statt `calendar`: die Anwendung schreibt Ereignisse in den
 * Hauptkalender, sie verwaltet keine Kalender. Der kleinste Zuschnitt, der die
 * Aufgabe trägt.
 */
export const GOOGLE_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';

export interface GoogleKonto {
  user_id: number;
  google_sub: string;
  google_email: string;
  access_token: string;
  refresh_token: string | null;
  token_expiry: number;
  scope: string | null;
  verbunden_at: string;
}

export function googleKonfiguriert(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/**
 * Die Basis, unter der die Anwendung von außen erreichbar ist. Der vom Request
 * gesehene Origin taugt dafür nicht: Next leitet ihn aus der Bindeadresse des
 * Servers ab, im Entwicklungsbetrieb also `https://0.0.0.0:3000` — eine
 * Adresse, die kein Browser öffnen kann. APP_URL sagt, wie die Anwendung
 * wirklich heißt; nur ohne sie bleibt der Origin die Notlösung.
 */
export function appBasis(origin: string): string {
  return process.env.APP_URL?.replace(/\/$/, '') || origin;
}

export function googleRedirectUri(origin: string): string {
  return `${appBasis(origin)}/api/google/callback`;
}

export function googleAuthUrl(origin: string, state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? '',
    redirect_uri: googleRedirectUri(origin),
    response_type: 'code',
    scope: GOOGLE_SCOPES,
    // `offline` + `consent` erzwingen ein Refresh-Token: ohne das müsste sich
    // jede Person nach einer Stunde neu verbinden, und der Abgleich stünde still.
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  if (loginHint) params.set('login_hint', loginHint);
  return `${AUTH_ENDPOINT}?${params}`;
}

interface TokenAntwort {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
}

/**
 * Wer das Token ist, steht im id_token. Die Signatur wird nicht geprüft — das
 * Token kommt hier direkt aus Googles Token-Endpunkt über TLS, nicht vom
 * Browser, und genau dafür sieht OpenID Connect den Verzicht vor.
 */
function leseIdToken(idToken: string): {sub: string; email: string} | null {
  const mitte = idToken.split('.')[1];
  if (!mitte) return null;
  try {
    const payload = JSON.parse(Buffer.from(mitte, 'base64url').toString('utf8'));
    if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
    return {sub: payload.sub, email: payload.email};
  } catch {
    return null;
  }
}

export interface GoogleTausch {
  sub: string;
  email: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: number;
  scope: string | null;
}

/**
 * Tauscht den Autorisierungscode gegen Tokens; ein String ist die deutsche
 * Fehlermeldung.
 */
export async function tauscheGoogleCode(origin: string, code: string): Promise<GoogleTausch | string> {
  if (!googleKonfiguriert()) return 'Die Google-Anbindung ist nicht konfiguriert.';
  const antwort = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      redirect_uri: googleRedirectUri(origin),
      code,
    }),
  });
  if (!antwort.ok) {
    console.error('Google-Token-Tausch fehlgeschlagen:', antwort.status, await antwort.text());
    return 'Google hat die Verknüpfung nicht bestätigt. Bitte versuche es erneut.';
  }
  const daten = (await antwort.json()) as TokenAntwort;
  const wer = daten.id_token ? leseIdToken(daten.id_token) : null;
  if (!wer) return 'Google hat kein lesbares Konto zurückgegeben.';
  return {
    sub: wer.sub,
    email: wer.email,
    accessToken: daten.access_token,
    refreshToken: daten.refresh_token ?? null,
    tokenExpiry: Date.now() + daten.expires_in * 1000,
    scope: daten.scope ?? null,
  };
}

/**
 * Prüft ein ID-Token, das der **Browser** mitbringt (Anmeldung über den
 * GIS-Knopf). Anders als beim Code-Tausch kommt es hier nicht direkt von
 * Googles Token-Endpunkt, also muss die Signatur geprüft werden — das
 * erledigt Googles tokeninfo-Endpunkt, der ein ungültiges oder abgelaufenes
 * Token gar nicht erst beantwortet. Geprüft wird zusätzlich, dass das Token
 * für DIESE Anwendung ausgestellt wurde (`aud`) und die E-Mail bestätigt ist.
 */
export async function pruefeIdToken(credential: string): Promise<{sub: string; email: string} | string> {
  if (!googleKonfiguriert()) return 'Die Google-Anbindung ist nicht konfiguriert.';
  const antwort = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
  );
  if (!antwort.ok) return 'Die Google-Anmeldung konnte nicht bestätigt werden.';
  const daten = (await antwort.json()) as {
    aud?: string;
    iss?: string;
    sub?: string;
    email?: string;
    email_verified?: string;
  };
  if (daten.aud !== process.env.GOOGLE_CLIENT_ID) return 'Das Google-Token gehört nicht zu dieser Anwendung.';
  if (daten.iss !== 'accounts.google.com' && daten.iss !== 'https://accounts.google.com') {
    return 'Das Google-Token stammt nicht von Google.';
  }
  if (!daten.sub || !daten.email || daten.email_verified !== 'true') {
    return 'Das Google-Konto hat keine bestätigte E-Mail-Adresse.';
  }
  return {sub: daten.sub, email: daten.email};
}

/**
 * Wessen Mitarbeiterkonto zu dieser Google-Identität gehört. Zuerst zählt die
 * ausdrückliche Verknüpfung (google_konten, über die Einrichtung bewiesen);
 * erst dann die Firmen-E-Mail — die genügt, weil Google sie nur bestätigt
 * ausliefert und `pruefeIdToken` genau das verlangt: wer sich so anmeldet,
 * kontrolliert das Postfach, auf das das Konto ausgestellt ist.
 */
export function benutzerFuerGoogleLogin(sub: string, email: string): number | null {
  const db = getDb();
  const verknuepft = db
    .query<{user_id: number}, [string]>(
      `SELECT g.user_id FROM google_konten g JOIN users u ON u.id = g.user_id
       WHERE g.google_sub = ? AND u.active = 1`,
    )
    .get(sub);
  if (verknuepft) return verknuepft.user_id;
  const perEmail = db
    .query<{id: number}, [string]>('SELECT id FROM users WHERE email = ? AND active = 1')
    .get(email.trim());
  return perEmail?.id ?? null;
}

export function googleKontoFuer(userId: number): GoogleKonto | null {
  return getDb()
    .query<GoogleKonto, [number]>('SELECT * FROM google_konten WHERE user_id = ?')
    .get(userId);
}

/**
 * Beim erneuten Verbinden schickt Google nicht immer ein neues Refresh-Token
 * mit — dann bleibt das alte gültig und wird behalten.
 */
export function speichereGoogleKonto(userId: number, tausch: GoogleTausch): void {
  getDb()
    .query(
      `INSERT INTO google_konten (user_id, google_sub, google_email, access_token, refresh_token, token_expiry, scope)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         google_sub = excluded.google_sub,
         google_email = excluded.google_email,
         access_token = excluded.access_token,
         refresh_token = COALESCE(excluded.refresh_token, google_konten.refresh_token),
         token_expiry = excluded.token_expiry,
         scope = excluded.scope,
         verbunden_at = datetime('now')`,
    )
    .run(userId, tausch.sub, tausch.email, tausch.accessToken, tausch.refreshToken, tausch.tokenExpiry, tausch.scope);
}

/**
 * Ein Access-Token, das noch mindestens eine Minute trägt — bei Bedarf
 * aufgefrischt und zurückgeschrieben. `null` heißt: kein verbundenes Konto,
 * keine Konfiguration oder ein drüben widerrufener Zugriff. Der Aufrufer
 * behandelt das als „kein Abgleich möglich", nie als Fehler der Buchung.
 */
export async function frischesAccessToken(userId: number): Promise<string | null> {
  const konto = googleKontoFuer(userId);
  if (!konto || !googleKonfiguriert()) return null;
  if (konto.token_expiry - Date.now() > 60_000) return konto.access_token;
  if (!konto.refresh_token) return null;
  const antwort = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: 'refresh_token',
      refresh_token: konto.refresh_token,
    }),
  });
  if (!antwort.ok) {
    console.error('Google-Token-Auffrischung fehlgeschlagen:', antwort.status, await antwort.text());
    return null;
  }
  const daten = (await antwort.json()) as TokenAntwort;
  getDb()
    .query('UPDATE google_konten SET access_token = ?, token_expiry = ? WHERE user_id = ?')
    .run(daten.access_token, Date.now() + daten.expires_in * 1000, userId);
  return daten.access_token;
}

/**
 * Trennt das Konto: Widerruf bei Google nach bestem Bemühen, danach werden
 * Tokens und Ereignis-Zuordnungen gelöscht. Die Kalender-Ereignisse selbst
 * räumt der Aufrufer vorher über lib/google-kalender.ts ab — nach dem Widerruf
 * käme kein Aufruf mehr durch.
 */
export async function trenneGoogleKonto(userId: number): Promise<void> {
  const konto = googleKontoFuer(userId);
  if (!konto) return;
  try {
    await fetch(REVOKE_ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded'},
      body: new URLSearchParams({token: konto.refresh_token ?? konto.access_token}),
    });
  } catch (fehler) {
    // absichtlich still — ein nicht erreichter Widerruf hält die Trennung nicht auf
    console.error('Google-Widerruf nicht erreicht:', fehler);
  }
  const db = getDb();
  db.query('DELETE FROM google_kalender_eintraege WHERE user_id = ?').run(userId);
  db.query('DELETE FROM google_konten WHERE user_id = ?').run(userId);
}
