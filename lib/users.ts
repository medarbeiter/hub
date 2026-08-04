import {getDb, type Role, type User} from './db';
import {isBundesland} from './feiertage';

// User administration (Verwaltung only — callers enforce the role).

export interface UserInput {
  name: string;
  email: string;
  role: Role;
  weeklyMinutes: number;
  /** Two-letter code, or '' to follow the company-wide setting. */
  bundesland?: string;
}

export function allUsers(): User[] {
  return getDb()
    .query<User, []>(
      'SELECT id, email, name, role, weekly_minutes, active, created_at, bundesland FROM users ORDER BY active DESC, name',
    )
    .all();
}

function validateUserInput(input: UserInput, excludeId?: number): string | null {
  if (!input.name.trim()) return 'Bitte einen Namen angeben.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return 'Bitte eine gültige E-Mail-Adresse angeben.';
  if (!['mitarbeiter', 'verwaltung'].includes(input.role)) return 'Ungültige Rolle.';
  if (input.weeklyMinutes < 60 || input.weeklyMinutes > 60 * 60) return 'Die Wochenstunden müssen zwischen 1 und 60 liegen.';
  if (input.bundesland && !isBundesland(input.bundesland)) return 'Unbekanntes Bundesland.';
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

export async function createUser(actor: User, input: UserInput): Promise<{error: string} | {password: string}> {
  if (actor.role !== 'verwaltung') return {error: 'Keine Berechtigung.'};
  const invalid = validateUserInput(input);
  if (invalid) return {error: invalid};
  const password = generatePassword();
  const hash = await Bun.password.hash(password);
  getDb()
    .query('INSERT INTO users (email, password_hash, name, role, weekly_minutes, bundesland) VALUES (?, ?, ?, ?, ?, ?)')
    .run(input.email.trim(), hash, input.name.trim(), input.role, input.weeklyMinutes, input.bundesland || null);
  return {password};
}

export function updateUser(actor: User, userId: number, input: UserInput): string | null {
  if (actor.role !== 'verwaltung') return 'Keine Berechtigung.';
  const invalid = validateUserInput(input, userId);
  if (invalid) return invalid;
  if (actor.id === userId && input.role !== 'verwaltung') {
    return 'Sie können sich nicht selbst die Verwaltungsrolle entziehen.';
  }
  getDb()
    .query('UPDATE users SET name = ?, email = ?, role = ?, weekly_minutes = ?, bundesland = ? WHERE id = ?')
    .run(input.name.trim(), input.email.trim(), input.role, input.weeklyMinutes, input.bundesland || null, userId);
  return null;
}

export async function resetPassword(actor: User, userId: number): Promise<{error: string} | {password: string}> {
  if (actor.role !== 'verwaltung') return {error: 'Keine Berechtigung.'};
  const password = generatePassword();
  const hash = await Bun.password.hash(password);
  const db = getDb();
  db.query('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);
  db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return {password};
}

export function setUserActive(actor: User, userId: number, active: boolean): string | null {
  if (actor.role !== 'verwaltung') return 'Keine Berechtigung.';
  if (!active) {
    if (actor.id === userId) return 'Sie können sich nicht selbst deaktivieren.';
    const admins = getDb()
      .query<{n: number}, [number]>("SELECT COUNT(*) AS n FROM users WHERE role = 'verwaltung' AND active = 1 AND id != ?")
      .get(userId)!;
    const target = getDb().query<{role: Role}, [number]>('SELECT role FROM users WHERE id = ?').get(userId);
    if (target?.role === 'verwaltung' && admins.n === 0) return 'Das letzte aktive Verwaltungskonto kann nicht deaktiviert werden.';
  }
  const db = getDb();
  db.query('UPDATE users SET active = ? WHERE id = ?').run(active ? 1 : 0, userId);
  if (!active) db.query('DELETE FROM sessions WHERE user_id = ?').run(userId);
  return null;
}
