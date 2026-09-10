import {afterEach, beforeEach, expect, test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {wirksameRechte} from '../lib/rollen';
import {todayISO} from '../lib/format';
import {
  abrechnen,
  addFahrzeugBeleg,
  createFall,
  deleteFahrzeugBeleg,
  faelleFor,
  faelleZurAbrechnung,
  fallById,
  schliessen,
  updateFall,
  wiedereroeffnen,
} from '../lib/fahrzeug';

let db: Database;
let anna: User;
let chef: User;

function nutzer(id: number, name: string, role: 'mitarbeiter' | 'verwaltung'): User {
  return {
    id,
    email: `${name}@t.de`,
    name,
    role,
    weekly_minutes: 2400,
    active: 1,
    created_at: '2026-01-01',
    bundesland: null,
    urlaubstage_jahr: 30,
    rechte: wirksameRechte(role, []),
  };
}

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('anna@t.de', 'x', 'Anna', 'mitarbeiter')").run();
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('chef@t.de', 'x', 'Chef', 'verwaltung')").run();
  const ids = db.query<{id: number}, []>('SELECT id FROM users ORDER BY id').all();
  anna = nutzer(ids[0]!.id, 'Anna', 'mitarbeiter');
  chef = nutzer(ids[1]!.id, 'Chef', 'verwaltung');
});

afterEach(() => setDbForTesting(undefined));

test('ein Fall sammelt Belege, bis er geschlossen ist; abgerechnet wird nur geschlossen', () => {
  const heute = todayISO();
  expect(createFall(anna, anna.id, {titel: 'Tanken September', von: '2026-09-01'})).toBeNull();
  expect(createFall(anna, anna.id, {titel: '', von: '2026-09-01'})).not.toBeNull();
  expect(createFall(chef, anna.id, {titel: 'Fremd', von: '2026-09-01'})).toBeNull();
  expect(createFall(anna, chef.id, {titel: 'Fremd', von: '2026-09-01'})).toBe('Keine Berechtigung.');

  const fall = faelleFor(anna.id)[0]!.fall;
  const beleg = {art: 'tanken' as const, datum: heute, betragCent: 6450, beschreibung: 'Aral'};
  expect(addFahrzeugBeleg(anna, fall.id, beleg)).toBeNull();
  expect(addFahrzeugBeleg(anna, fall.id, {...beleg, datum: '2026-08-31'})).not.toBeNull();
  expect(addFahrzeugBeleg(anna, fall.id, {...beleg, betragCent: 0})).not.toBeNull();
  expect(faelleFor(anna.id)[0]!.summeCent).toBe(6450);

  expect(updateFall(anna, fall.id, {titel: 'Tanken', von: heute > '2026-09-05' ? '2026-09-05' : '2026-09-01'})).toBeNull();

  expect(abrechnen(chef, fall.id)).toBe('Nur ein geschlossener Fall kann abgerechnet werden.');
  expect(schliessen(anna, fall.id)).toBeNull();
  expect(fallById(fall.id)!.bis).toBe(heute);
  expect(addFahrzeugBeleg(anna, fall.id, beleg)).not.toBeNull();
  expect(faelleZurAbrechnung('geschlossen')).toHaveLength(1);
  expect(faelleZurAbrechnung('geschlossen')[0]!.person?.name).toBe('Anna');

  expect(wiedereroeffnen(anna, fall.id)).toBeNull();
  expect(addFahrzeugBeleg(anna, fall.id, beleg)).toBeNull();
  expect(schliessen(anna, fall.id)).toBeNull();

  expect(abrechnen(anna, fall.id)).toBe('Keine Berechtigung.');
  expect(abrechnen(chef, fall.id)).toBeNull();
  expect(fallById(fall.id)!.status).toBe('abgerechnet');
  expect(wiedereroeffnen(chef, fall.id)).not.toBeNull();
  const belegId = db.query<{id: number}, []>('SELECT id FROM fahrzeug_belege LIMIT 1').get()!.id;
  expect(deleteFahrzeugBeleg(chef, belegId)).not.toBeNull();
});
