import {afterEach, beforeEach, expect, test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {wirksameRechte} from '../lib/rollen';
import {todayISO} from '../lib/format';
import {
  abrechnen,
  abzurechnen,
  addFahrzeugBeleg,
  createFall,
  deleteFahrzeugBeleg,
  faelleFor,
  faelleZurAbrechnung,
  fallById,
  schliessen,
  tankbelegAbrechnen,
  tankbelegeFor,
  tankbelegeZurAbrechnung,
  wiedereroeffnen,
} from '../lib/fahrzeug';

let db: Database;
let anna: User;
let chef: User;

function nutzer(id: number, name: string, role: 'mitarbeiter' | 'verwaltung', extra: string[] = []): User {
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
    rechte: wirksameRechte(role, extra),
  };
}

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('anna@t.de', 'x', 'Anna', 'mitarbeiter')").run();
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('chef@t.de', 'x', 'Chef', 'verwaltung')").run();
  const ids = db.query<{id: number}, []>('SELECT id FROM users ORDER BY id').all();
  anna = nutzer(ids[0]!.id, 'Anna', 'mitarbeiter', ['fahrzeug.erfassen']);
  chef = nutzer(ids[1]!.id, 'Chef', 'verwaltung');
});

afterEach(() => setDbForTesting(undefined));

const heute = todayISO();
const datei = {datei: '2026/x.jpg', dateiName: 'x.jpg', dateiTyp: 'image/jpeg'};

test('das Recht ist in keinem Grundbündel, die Verwaltung hat es über *', () => {
  expect(nutzer(1, 'x', 'mitarbeiter').rechte).not.toContain('fahrzeug.erfassen');
  expect(chef.rechte).toContain('fahrzeug.abrechnen');
});

test('ein Tankbeleg steht für sich: Datei Pflicht, einzeln abgerechnet, danach fest', () => {
  const tank = {art: 'tanken' as const, datum: heute, betragCent: 6450, ...datei};
  expect(addFahrzeugBeleg(anna, anna.id, null, {...tank, datei: undefined})).toBe('Bitte den Beleg als Foto oder PDF anhängen.');
  expect(addFahrzeugBeleg(anna, anna.id, null, {...tank, art: 'service'})).not.toBeNull();
  expect(addFahrzeugBeleg(anna, chef.id, null, tank)).toBe('Keine Berechtigung.');
  expect(addFahrzeugBeleg(anna, anna.id, null, tank)).toBeNull();
  expect(tankbelegeFor(anna.id)).toHaveLength(1);
  expect(abzurechnen()).toBe(1);

  const id = tankbelegeFor(anna.id)[0]!.beleg.id;
  expect(tankbelegAbrechnen(anna, id)).toBe('Keine Berechtigung.');
  expect(tankbelegAbrechnen(chef, id)).toBeNull();
  expect(tankbelegeZurAbrechnung('offen')).toHaveLength(0);
  expect(tankbelegeZurAbrechnung('abgerechnet')[0]!.person?.name).toBe('Anna');
  expect(deleteFahrzeugBeleg(anna, id)).not.toBeNull();
});

test('ein Servicefall entsteht mit seiner ersten Rechnung und sammelt, bis er geschlossen ist', () => {
  const rechnung = {art: 'service' as const, datum: heute, betragCent: 24900, ...datei};
  expect(createFall(anna, anna.id, {titel: 'Inspektion', von: heute}, {...rechnung, datei: undefined})).not.toBeNull();
  expect(faelleFor(anna.id)).toHaveLength(0);
  expect(createFall(anna, anna.id, {titel: 'Inspektion', von: heute}, rechnung)).toBeNull();

  const fall = faelleFor(anna.id)[0]!;
  expect(fall.belege).toHaveLength(1);
  expect(fall.summeCent).toBe(24900);
  expect(addFahrzeugBeleg(anna, anna.id, fall.fall.id, {...rechnung, art: 'tanken'})).not.toBeNull();
  expect(addFahrzeugBeleg(anna, anna.id, fall.fall.id, rechnung)).toBeNull();

  expect(abrechnen(chef, fall.fall.id)).toBe('Nur ein geschlossener Fall kann abgerechnet werden.');
  expect(schliessen(anna, fall.fall.id)).toBeNull();
  expect(fallById(fall.fall.id)!.bis).toBe(heute);
  expect(addFahrzeugBeleg(anna, anna.id, fall.fall.id, rechnung)).not.toBeNull();
  expect(faelleZurAbrechnung('offen')).toHaveLength(1);
  expect(wiedereroeffnen(anna, fall.fall.id)).toBeNull();
  expect(schliessen(anna, fall.fall.id)).toBeNull();

  expect(abrechnen(anna, fall.fall.id)).toBe('Keine Berechtigung.');
  expect(abrechnen(chef, fall.fall.id)).toBeNull();
  expect(wiedereroeffnen(chef, fall.fall.id)).not.toBeNull();
  expect(deleteFahrzeugBeleg(chef, fall.belege[0]!.id)).not.toBeNull();
});
