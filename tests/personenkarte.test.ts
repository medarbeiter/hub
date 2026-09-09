import {afterEach, beforeEach, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {todayISO} from '../lib/format';
import {personenKarte} from '../lib/personenkarte';
import {wirksameRechte} from '../lib/rollen';

const SPALTEN = 'id, email, name, role, weekly_minutes, active, created_at, bundesland, urlaubstage_jahr, eintritt';

let db: Database;
let anna: User;
let ben: User;
let chef: User;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query(
    "INSERT INTO users (email, password_hash, name, role, eintritt) VALUES ('anna@t.de','x','Anna','mitarbeiter','2019-03-01'),('ben@t.de','x','Ben','mitarbeiter',NULL),('chef@t.de','x','Chef','verwaltung',NULL)",
  ).run();
  [anna, ben, chef] = db.query<User, []>(`SELECT ${SPALTEN} FROM users ORDER BY id`).all() as [User, User, User];
  for (const u of [anna, ben, chef]) u.rechte = wirksameRechte(u.role, []);
  const heute = todayISO();
  db.query("INSERT INTO abwesenheiten (user_id, von, bis, art, status) VALUES (1, ?, ?, 'krank', 'gemeldet')").run(heute, heute);
});
afterEach(() => setDbForTesting(undefined));

test('ein Kollege bekommt weder Einblick noch den Grund', () => {
  const karte = personenKarte(ben, anna.id)!;
  expect(karte.person.name).toBe('Anna');
  expect(karte.eintritt).toBe('2019-03-01');
  expect(karte.selbst).toBe(false);
  expect(karte.heute).toBe('Abwesend');
  expect(karte.einblick).toBeUndefined();
});

test('die Verwaltung sieht Zahlen, Wege und den Grund', () => {
  const karte = personenKarte(chef, anna.id)!;
  expect(karte.heute).toBe('Krank');
  const einblick = karte.einblick!;
  expect(typeof einblick.zeitkontoMin).toBe('number');
  expect(typeof einblick.resturlaub).toBe('number');
  expect(einblick.offeneTage).toBe(0);
  expect(einblick.status?.status).toBe('aus');
  expect(einblick.wege.map((w) => w.art)).toEqual(['zeitblatt', 'konto', 'protokoll', 'bearbeiten']);
  expect(einblick.wege.find((w) => w.art === 'bearbeiten')?.href).toBe('/mitarbeiter?bearbeiten=1');
});

test('die eigene Karte trägt die eigenen Zahlen und die eigenen Wege', () => {
  const karte = personenKarte(anna, anna.id)!;
  expect(karte.selbst).toBe(true);
  expect(karte.heute).toBe('Krank');
  expect(typeof karte.einblick?.zeitkontoMin).toBe('number');
  expect(karte.einblick?.wege.map((w) => w.art)).toEqual(['profil', 'ziele']);
});

test('ein unbekanntes Konto ist keine Karte', () => {
  expect(personenKarte(chef, 99)).toBeNull();
});

test('dauerSeit zählt ganze Monate', async () => {
  const {dauerSeit} = await import('../lib/format');
  expect(dauerSeit('2026-09-01', '2026-09-09')).toBe('neu im Team');
  expect(dauerSeit('2026-05-10', '2026-09-09')).toBe('3 Monate');
  expect(dauerSeit('2025-09-09', '2026-09-09')).toBe('1 Jahr');
  expect(dauerSeit('2019-03-01', '2026-09-09')).toBe('7 Jahre');
});
