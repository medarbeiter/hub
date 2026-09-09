import {afterEach, beforeEach, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {neueEreignisse, setWeckerForTesting} from '../lib/timeline-wecker';

let db: Database;
const key = process.env.CLICKUP_API_KEY;
beforeEach(() => {
  delete process.env.CLICKUP_API_KEY;
  db = createDb(':memory:');
  setDbForTesting(db);
  setWeckerForTesting();
  db.query("INSERT INTO users (id,email,password_hash,name,role,eintritt) VALUES (1,'a@t.de','x','Ada','mitarbeiter','2025-03-03')").run();
});
afterEach(() => { setWeckerForTesting(); setDbForTesting(undefined); db.close(); if (key) process.env.CLICKUP_API_KEY = key; });

test('first fill is silent, a goal is reported once when first seen, and the page is recomputed at most every 20 s', async () => {
  const ziel = (titel: string) => db.query("INSERT INTO ziele (user_id,titel,messung,von,bis,oeffentlich,created_at) VALUES (1,?,'frei','2026-09-07','2026-09-13',1,?)").run(titel, new Date().toISOString());
  expect((await neueEreignisse(0, 1_000)).ereignisse).toEqual([]);
  ziel('Neu');
  expect((await neueEreignisse(0, 5_000)).ereignisse).toEqual([]);
  const {ereignisse, jetzt} = await neueEreignisse(0, 30_000);
  expect(jetzt).toBe(30_000);
  expect(ereignisse.map((e) => [e.titel, e.art, e.person.name])).toEqual([['Neu', 'ziel_erstellt', 'Ada']]);
  expect(ereignisse[0]).not.toHaveProperty('person.email');
  expect((await neueEreignisse(30_000, 60_000)).ereignisse).toEqual([]);
  ziel('Später');
  expect((await neueEreignisse(30_000, 90_000)).ereignisse.map((e) => e.titel)).toEqual(['Später']);
});
