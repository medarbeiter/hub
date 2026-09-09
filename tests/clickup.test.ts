import {afterEach, beforeEach, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {aufgabenAus, setClickupForTesting, zeitAus} from '../lib/clickup';
import {createGoal, ownGoals, reagieren, setGoalVisibility, teamGoals, teamTimeline} from '../lib/ziele';
import type {GoalInput} from '../lib/ziele-arten';

let db: Database;
const tag = (datum: string, id: string) => ({id, name: `Aufgabe ${id}`, date_done: String(new Date(`${datum}T10:00:00+02:00`).getTime()), assignees: [{email: 'ADA@test.de'}], list: {name: 'Marketing'}, url: `https://app.clickup.com/t/${id}`});
beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  process.env.CLICKUP_API_KEY = 'test';
  db.query("INSERT INTO users (id,email,password_hash,name,role,eintritt) VALUES (1,'ada@test.de','x','Ada','mitarbeiter','2025-03-03'),(2,'ben@test.de','x','Ben','mitarbeiter','2025-01-01')").run();
  const start = (datum: string) => String(new Date(`${datum}T09:00:00+02:00`).getTime());
  setClickupForTesting({
    aufgaben: aufgabenAus({tasks: [tag('2026-09-07', 'a'), tag('2026-09-07', 'b'), tag('2026-09-08', 'c'), {id: 'x', name: 'offen', date_done: null, assignees: [{email: 'ada@test.de'}]},
      {...tag('2026-09-08', 'd'), assignees: [{email: 'ben@test.de'}, {email: 'ada@test.de'}]}, {...tag('2026-09-08', 'e'), assignees: [{email: 'fremd@test.de'}]}]}),
    zeit: zeitAus({data: [{user: {email: 'Ada@test.de'}, start: start('2026-09-07'), duration: '3600000'}, {user: {email: 'ada@test.de'}, start: start('2026-09-07'), duration: '1800000'},
      {user: {email: 'ben@test.de'}, start: start('2026-09-08'), duration: '7200000'}, {user: {email: 'ada@test.de'}, start: start('2026-09-08'), duration: '-500'}]}),
  });
});
afterEach(() => { setClickupForTesting(); setDbForTesting(undefined); db.close(); delete process.env.CLICKUP_API_KEY; });
const input = (extra: Partial<GoalInput>): GoalInput => ({titel: '', messung: 'aufgaben', vergleich: 'min', je: 'zeitraum', wert: 3, von: '2026-09-07', bis: '2026-09-13', oeffentlich: true, wiederholung: 'keine', ...extra});

test('task goals count ClickUp tasks done by the person in the period — total, per day, and only with ClickUp configured', () => {
  const gesamt = createGoal(1, input({}));
  const jeTag = createGoal(1, input({je: 'tag', wert: 1}));
  db.query("UPDATE ziele SET created_at = '2026-09-07'").run();
  const alle = (heute: string) => Object.fromEntries(ownGoals(1, heute).map(z => [z.id, z]));
  expect(alle('2026-09-08')[gesamt]).toMatchObject({titel: 'Insgesamt mindestens 3 Aufgaben in ClickUp erledigen', regel: 'mindestens 3 ClickUp-Aufgaben insgesamt', fortschritt: 4, ziel: 3, einheit: 'Aufgaben', erreicht: true, erreichtAm: '2026-09-08'});
  expect(alle('2026-09-08')[jeTag]).toMatchObject({fortschritt: 2, ziel: 5, erreicht: false});
  expect(ownGoals(2, '2026-09-08')).toEqual([]);
  expect(() => createGoal(1, input({wert: 0}))).toThrow('Anzahl');
  delete process.env.CLICKUP_API_KEY;
  expect(() => createGoal(1, input({}))).toThrow('ClickUp');
});

test('done ClickUp tasks never appear in the timeline themselves and take no reactions', () => {
  expect(teamTimeline(1, '2026-09-09').events.every(e => !e.id.startsWith('clickup-'))).toBe(true);
  expect(() => reagieren(2, 'clickup-aufgabe-c', '👏')).toThrow();
});

test('ClickUp time goals sum booked minutes per person; running entries do not count', () => {
  const id = createGoal(1, input({messung: 'clickupzeit', wert: 120}));
  db.query("UPDATE ziele SET created_at = '2026-09-07'").run();
  expect(ownGoals(1, '2026-09-08').find(z => z.id === id)).toMatchObject({titel: 'Insgesamt mindestens 2 Stunden Zeit in ClickUp erfassen', fortschritt: 90, ziel: 120, einheit: 'Minuten', erreicht: false});
});

test('team goals add everyone up, count a shared task once, ignore strangers, are always public, and only Verwaltung of the goal is its creator', () => {
  const id = createGoal(1, input({team: true, wert: 4, oeffentlich: false}));
  const zeit = createGoal(2, input({team: true, messung: 'clickupzeit', wert: 4 * 60}));
  db.query("UPDATE ziele SET created_at = '2026-09-07'").run();
  expect(() => createGoal(1, input({team: true, messung: 'arbeitszeit'}))).toThrow('Teamziel');
  expect(() => createGoal(1, input({team: true, je: 'tag', wert: 1}))).toThrow('pro Woche');
  expect(ownGoals(1, '2026-09-08').some(z => z.id === id)).toBe(false);
  const team = Object.fromEntries(teamGoals('2026-09-08').map(z => [z.id, z]));
  expect(team[id]).toMatchObject({fortschritt: 4, ziel: 4, erreicht: true, oeffentlich: 1, ersteller: 'Ada', team: 1});
  expect(team[zeit]).toMatchObject({fortschritt: 210, ziel: 240, erreicht: false, ersteller: 'Ben'});
  expect(() => setGoalVisibility(1, id, false)).toThrow('Teamziel');
  db.query("UPDATE users SET role = 'vertrieb' WHERE id = 2").run();
  const nurVertrieb = createGoal(1, input({team: true, wert: 2, rollen: ['vertrieb']}));
  db.query("UPDATE ziele SET created_at = '2026-09-07'").run();
  expect(teamGoals('2026-09-08').find(z => z.id === nurVertrieb)).toMatchObject({fortschritt: 1, rollenLabels: ['Vertrieb']});
  expect(() => createGoal(1, input({team: true, rollen: ['nope']}))).toThrow('Rolle');
  const events = teamTimeline(1, '2026-09-08').events.filter(e => e.goalId === id);
  expect(events.map(e => e.beschreibung)).toEqual([expect.stringContaining('Das Team hat sein Ziel erreicht'), expect.stringContaining('für das ganze Team')]);
});
