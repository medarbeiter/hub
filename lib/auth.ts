import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {getDb, type User} from './db';

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
      `SELECT u.id, u.email, u.name, u.role, u.weekly_minutes, u.active, u.created_at, s.expires_at
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
  return user as User;
}

/** Redirects to /login when no valid session exists. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser();
  if (!user) redirect('/login');
  return user;
}

/** Redirects to / when the session user is not Verwaltung. */
export async function requireVerwaltung(): Promise<User> {
  const user = await requireUser();
  if (user.role !== 'verwaltung') redirect('/');
  return user;
}
