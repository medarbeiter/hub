import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getDb, type User} from './db';
import {onboardingIstFertig} from './onboarding';
import {effektiveRechte, hatRecht, type Recht} from './rechte';

const SESSION_COOKIE = 'medarbeiter_session';
const SESSION_DAYS = 30;

export async function verifyLogin(email: string, password: string): Promise<User | null> {
  const db = getDb();
  const row = db
    .query<User & {password_hash: string}, [string]>('SELECT * FROM users WHERE email = ? AND active = 1')
    .get(email.trim());
  if (!row) return null;
  const ok = await Bun.password.verify(password, row.password_hash);
  if (!ok) return null;
  const {password_hash: _discard, ...user} = row;
  return user as User;
}

export async function createSession(userId: number): Promise<void> {
  const db = getDb();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  db.query('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  db.query('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    getDb().query('DELETE FROM sessions WHERE token = ?').run(token);
    jar.delete(SESSION_COOKIE);
  }
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const row = db
    .query<User & {expires_at: number}, [string]>(
      // Die Spalten stehen einzeln da, damit `password_hash` nicht mitkommt —
      // dann müssen aber auch alle anderen mitkommen. `bundesland` fehlte hier,
      // und weil dieser Weg jede Seite mit ihrem Benutzer versorgt, griff die
      // Feiertagseinstellung je Mitarbeiter für die eigenen Seiten nie.
      `SELECT u.id, u.email, u.name, u.role, u.weekly_minutes, u.active, u.created_at,
              u.bundesland, u.urlaubstage_jahr, u.avatar_key, u.must_change_password,
              s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND u.active = 1`,
    )
    .get(token);
  if (!row) return null;
  if (row.expires_at < Date.now()) {
    db.query('DELETE FROM sessions WHERE token = ?').run(token);
    return null;
  }
  const {expires_at: _discard, ...user} = row;
  // Die wirksamen Rechte reisen mit der Sitzung: Rollenbündel plus die je
  // Konto vergebenen Zusatzrechte. Jede Prüfung im Baum liest dieselbe Menge.
  const extra = db
    .query<{recht: string}, [number]>('SELECT recht FROM benutzer_rechte WHERE user_id = ?')
    .all(user.id)
    .map((r) => r.recht);
  (user as User).rechte = effektiveRechte(user.role, extra);
  return user as User;
}

/** Nur Sitzungsschutz — die Zugangsseite braucht diesen Weg selbst. */
export async function requireAuthenticatedUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/**
 * Schützt die eigentliche Anwendung. Die Prüfung liegt hier statt nur in der
 * Schale, damit auch Druckansicht, Exporte und Server-Aktionen erst nach der
 * persönlichen Datenbestätigung erreichbar sind.
 */
export async function requireUser(): Promise<User> {
  const user = await requireAuthenticatedUser();
  if (!onboardingIstFertig(user.id)) redirect('/login');
  return user;
}

/** Leitet auf / um, wenn dem Sitzungsbenutzer das benannte Recht fehlt. */
export async function requireRecht(recht: Recht): Promise<User> {
  const user = await requireUser();
  if (!hatRecht(user, recht)) redirect('/');
  return user;
}
