import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

declare global {
  // eslint-disable-next-line no-var
  var __medarbeiterDb: Database | undefined;
}

type Migration = (db: Database) => void;

// Append-only: shipped migrations are never edited, only new ones added.
// Exception: the baseline must stay idempotent (IF NOT EXISTS), because
// databases created before versioning existed sit at user_version 0 and
// replay it as a no-op.
const MIGRATIONS: Migration[] = [migration1Baseline, migration2Settings, migration3AutoClose];

/** The `PRAGMA user_version` a fully migrated database carries. */
export const SCHEMA_VERSION = MIGRATIONS.length;

function migration1Baseline(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('mitarbeiter', 'verwaltung')),
      weekly_minutes INTEGER NOT NULL DEFAULT 2400,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('arbeit', 'pause')),
      start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
      end_min INTEGER CHECK (end_min > start_min AND end_min <= 1440),
      note TEXT,
      edited_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_segments_user_date ON segments(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_segments_date ON segments(date);

    CREATE TABLE IF NOT EXISTS month_locks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      locked_at TEXT NOT NULL DEFAULT (datetime('now')),
      locked_by INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (user_id, month)
    );
  `);
}

function migration2Settings(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migration3AutoClose(db: Database) {
  // A provisionally closed entry: the cutoff sweep ended it because the
  // clock-out was forgotten. It stays flagged until a human confirms or
  // corrects it — never silently accepted as fact.
  db.exec('ALTER TABLE segments ADD COLUMN auto_closed INTEGER NOT NULL DEFAULT 0');
}

function migrate(db: Database) {
  const row = db.query<{user_version: number}, []>('PRAGMA user_version').get();
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      MIGRATIONS[version]!(db);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}

export function createDb(path: string): Database {
  const db = new Database(path, {create: true, strict: true});
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  migrate(db);
  return db;
}

export function getDb(): Database {
  if (!globalThis.__medarbeiterDb) {
    const dir = join(process.cwd(), 'data');
    mkdirSync(dir, {recursive: true});
    globalThis.__medarbeiterDb = createDb(join(dir, 'medarbeiter.db'));
  }
  return globalThis.__medarbeiterDb;
}

/** Test-only: point the process-wide handle at another database (e.g. ':memory:'). */
export function setDbForTesting(db: Database | undefined): void {
  globalThis.__medarbeiterDb = db;
}

export type Role = 'mitarbeiter' | 'verwaltung';

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  weekly_minutes: number;
  active: number;
  created_at: string;
}

export interface Segment {
  id: number;
  user_id: number;
  date: string;
  kind: 'arbeit' | 'pause';
  start_min: number;
  end_min: number | null;
  note: string | null;
  edited_by: number | null;
  /** 1 = provisionally closed by the cutoff sweep, awaiting confirmation. */
  auto_closed: number;
  created_at: string;
  updated_at: string;
}

export interface MonthLock {
  user_id: number;
  month: string;
  locked_at: string;
  locked_by: number;
}
