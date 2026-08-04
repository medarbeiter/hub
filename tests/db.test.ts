import {afterEach, describe, expect, test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDb, setDbForTesting} from '../lib/db';
import {getSetting, mergeWindowMin, setSetting} from '../lib/settings';

afterEach(() => setDbForTesting(undefined));

function tableNames(db: Database): string[] {
  return db
    .query<{name: string}, []>("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all()
    .map(r => r.name);
}

function userVersion(db: Database): number {
  return db.query<{user_version: number}, []>('PRAGMA user_version').get()!.user_version;
}

describe('migrations', () => {
  test('fresh database gets all tables and the latest version', () => {
    const db = createDb(':memory:');
    expect(tableNames(db)).toEqual(
      expect.arrayContaining(['users', 'sessions', 'segments', 'month_locks', 'settings']),
    );
    expect(userVersion(db)).toBe(2);
  });

  test('pre-versioning database (tables exist, user_version 0) migrates cleanly', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'medarbeiter-test-')), 'legacy.db');
    // Simulate the old schema: baseline tables, no settings, no version stamp.
    const legacy = new Database(path, {create: true, strict: true});
    legacy.exec(`
      CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL, name TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('mitarbeiter', 'verwaltung')),
        weekly_minutes INTEGER NOT NULL DEFAULT 2400, active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
      CREATE TABLE segments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date TEXT NOT NULL, kind TEXT NOT NULL CHECK (kind IN ('arbeit', 'pause')),
        start_min INTEGER NOT NULL, end_min INTEGER, note TEXT, edited_by INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
      CREATE TABLE month_locks (user_id INTEGER NOT NULL, month TEXT NOT NULL, locked_at TEXT NOT NULL DEFAULT (datetime('now')),
        locked_by INTEGER NOT NULL, PRIMARY KEY (user_id, month));
    `);
    legacy.query("INSERT INTO users (email, password_hash, name, role) VALUES ('a@b.de', 'x', 'Alte Daten', 'mitarbeiter')").run();
    legacy.close();

    const db = createDb(path);
    expect(userVersion(db)).toBe(2);
    expect(tableNames(db)).toContain('settings');
    // Existing rows survive the replayed baseline.
    expect(db.query<{name: string}, []>('SELECT name FROM users').get()!.name).toBe('Alte Daten');
  });

  test('reopening an already-migrated database is a no-op', () => {
    const path = join(mkdtempSync(join(tmpdir(), 'medarbeiter-test-')), 'twice.db');
    createDb(path).close();
    expect(userVersion(createDb(path))).toBe(2);
  });
});

describe('settings', () => {
  test('defaults apply without any rows', () => {
    setDbForTesting(createDb(':memory:'));
    expect(getSetting('merge_window_min')).toBe('2');
    expect(mergeWindowMin()).toBe(2);
  });

  test('set and read back, upsert overwrites', () => {
    setDbForTesting(createDb(':memory:'));
    setSetting('merge_window_min', '5');
    expect(mergeWindowMin()).toBe(5);
    setSetting('merge_window_min', '3');
    expect(mergeWindowMin()).toBe(3);
  });

  test('garbage values fall back to the default', () => {
    setDbForTesting(createDb(':memory:'));
    setSetting('merge_window_min', 'quatsch');
    expect(mergeWindowMin()).toBe(2);
  });
});
