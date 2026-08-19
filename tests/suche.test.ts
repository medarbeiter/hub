import {afterEach, beforeEach, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {createAbwesenheit} from '../lib/abwesenheit';
import {suche} from '../lib/suche';

// Die eine Sache, die hier schiefgehen darf und nicht schiefgehen darf: der
// Rechteschnitt. Was eine Suche findet, hat man vorher nicht gekannt — ein
// Leck fällt hier niemandem auf, anders als auf einer Seite, die zu viel zeigt.

const SPALTEN = 'id, email, name, role, weekly_minutes, active, created_at, bundesland, urlaubstage_jahr';

let db: Database;
let anna: User;
let bert: User;
let chef: User;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  const konten: Array<[string, string, string]> = [
    ['anna@t.de', 'Anna Ackermann', 'mitarbeiter'],
    ['bert@t.de', 'Bert Bauer', 'mitarbeiter'],
    ['chef@t.de', 'Clara Chef', 'verwaltung'],
  ];
  for (const [email, name, rolle] of konten) {
    db.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(email, 'x', name, rolle);
  }
  [anna, bert, chef] = db.query<User, []>(`SELECT ${SPALTEN} FROM users ORDER BY id`).all() as [User, User, User];
});

afterEach(() => setDbForTesting(undefined));

const labels = (u: User, frage: string) => suche(u, frage).map((t) => t.label);

test('fremde Abwesenheit: der Kollege findet sie nicht, die Prüferin schon', () => {
  const r = createAbwesenheit(bert, bert.id, {art: 'krank', von: '2026-08-10', bis: '2026-08-12'});
  expect('error' in r).toBe(false);

  expect(labels(anna, 'bert').some((l) => l.startsWith('Krank'))).toBe(false);
  expect(labels(chef, 'bert').some((l) => l.startsWith('Krank'))).toBe(true);
  // Die eigene findet man immer.
  expect(labels(bert, 'krank').some((l) => l.startsWith('Krank'))).toBe(true);
});

test('Seiten folgen dem Recht, nicht der Rolle', () => {
  expect(labels(anna, 'mitarbeiter')).not.toContain('Mitarbeiter');
  expect(labels(chef, 'mitarbeiter')).toContain('Mitarbeiter');
});

test('Personen: aktive für alle, deaktivierte nur für die Verwaltung', () => {
  db.query('UPDATE users SET active = 0 WHERE id = ?').run(bert.id);
  expect(labels(anna, 'bauer')).not.toContain('Bert Bauer');
  expect(labels(chef, 'bauer')).toContain('Bert Bauer');
  expect(labels(anna, 'ackermann')).toContain('Anna Ackermann');
});

test('eine Person ohne Blattrecht hat keine Adresse — die Karte ist das Ziel', () => {
  const treffer = (u: User) => suche(u, 'bauer').find((t) => t.gruppe === 'Personen');
  // Ohne `zeit.team` führt der Treffer nirgendwohin: die Palette öffnet die
  // Personenkarte. Früher stand hier der Teamkalender.
  expect(treffer(anna)?.href).toBeUndefined();
  expect(treffer(anna)?.person?.id).toBe(bert.id);
  expect(treffer(chef)?.href).toBe(`/team/${bert.id}`);
  // Die eigene Zeile bleibt das eigene Profil.
  expect(suche(anna, 'ackermann').find((t) => t.gruppe === 'Personen')?.href).toBe('/profil');
});

test('ohne Frage das Sprungbrett — kein Inhaltsverzeichnis, kein Datensatz', () => {
  createAbwesenheit(bert, bert.id, {art: 'krank', von: '2026-08-10', bis: '2026-08-12'});
  const leer = suche(chef, '');
  expect(leer.every((t) => t.gruppe === 'Schnellzugriff')).toBe(true);
  expect(leer.length).toBeLessThanOrEqual(6);
});

test('ein fremder Entwurf bleibt fort — auch vor der Prüferin', () => {
  const r = createAbwesenheit(bert, bert.id, {
    art: 'urlaub',
    von: '2026-09-07',
    bis: '2026-09-11',
    ruecksprache_vorgesetzte: true,
  });
  expect('error' in r).toBe(false);

  const meins = suche(bert, 'urlaub').filter((t) => t.gruppe === 'Abwesenheiten');
  expect(meins).toHaveLength(1);
  expect(suche(chef, 'urlaub').filter((t) => t.gruppe === 'Abwesenheiten')).toHaveLength(0);
  expect(suche(anna, 'urlaub').filter((t) => t.gruppe === 'Abwesenheiten')).toHaveLength(0);
});

// Die zweite Sache, die hier schiefgehen kann: die Reihenfolge. Die erste
// Zeile ist das, was die Eingabetaste tut — sie muss die Frage treffen.

test('unscharf: Umlaut, Tippfehler und Anfangsbuchstaben finden trotzdem', () => {
  db.query('UPDATE users SET name = ? WHERE id = ?').run('Maria Schröder', bert.id);
  expect(labels(chef, 'schroder')).toContain('Maria Schröder');
  expect(labels(chef, 'schröder')).toContain('Maria Schröder');
  // Buchstaben der Reihe nach: „mnab" → Monatsabschluss.
  expect(labels(chef, 'mnabs')).toContain('Monatsabschluss');
  // Was gar nicht vorkommt, kommt auch nicht vor.
  expect(labels(chef, 'xyq')).toEqual(['„xyq" im Protokoll suchen']);
});

test('die beste Zeile steht oben, das Weitersuchen unten', () => {
  const treffer = suche(chef, 'Clara');
  expect(treffer[0]?.label).toBe('Clara Chef');
  expect(treffer.at(-1)?.gruppe).toBe('Weitersuchen');

  // Ein Datum sticht: „4.8." meint den Tag, nicht eine Seite mit einer 4.
  expect(suche(anna, '4.8.2026')[0]?.gruppe).toBe('Tag');
});

test('nie mehr als zwölf Zeilen und vier je Gruppe', () => {
  for (let i = 0; i < 9; i++) {
    db.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
      `test${i}@t.de`,
      'x',
      `Testperson ${i}`,
      'mitarbeiter',
    );
  }
  const treffer = suche(chef, 'test');
  expect(treffer.filter((t) => t.gruppe === 'Personen').length).toBeLessThanOrEqual(4);
  expect(treffer.length).toBeLessThanOrEqual(13); // zwölf plus das Weitersuchen
});

test('ein Reiter schneidet auf seine Gruppe zu — und hebt dabei die Vier auf', () => {
  for (let i = 0; i < 9; i++) {
    db.query('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)').run(
      `test${i}@t.de`,
      'x',
      `Testperson ${i}`,
      'mitarbeiter',
    );
  }
  const nurPersonen = suche(chef, 'test', 'Personen');
  expect(nurPersonen.every((t) => t.gruppe === 'Personen')).toBe(true);
  // Ohne Reiter vier, mit Reiter mehr: sonst verspräche er mehr, als er hält.
  expect(nurPersonen.length).toBeGreaterThan(4);
  // Und das Weiterreichen ans Protokoll bleibt auf „Alle" — es ist keine Gruppe.
  expect(nurPersonen.some((t) => t.gruppe === 'Weitersuchen')).toBe(false);
  expect(suche(chef, 'test', 'Reisen')).toHaveLength(0);
});
