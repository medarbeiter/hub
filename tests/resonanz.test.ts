import {afterEach, beforeEach, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {erinnerungslauf, RESONANZ_ABSTAND_MS} from '../lib/erinnerungen';
import {resonanzFuer} from '../lib/resonanz';
import {createGoal, reagieren} from '../lib/ziele';
import {schreibeKommentar} from '../lib/profil-kommentare';

let db: Database;
beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (id,email,password_hash,name,role,eintritt) VALUES (1,'a@t.de','x','Ada','mitarbeiter','2025-03-03')").run();
  db.query("INSERT INTO users (id,email,password_hash,name,role) VALUES (2,'b@t.de','x','Ben','mitarbeiter')").run();
});
afterEach(() => { setDbForTesting(undefined); db.close(); });

test('Resonanz: fremde Kommentare und Reaktionen auf eigene Ereignisse, nie die eigene Stimme', () => {
  const seit = new Date(Date.now() - 60_000);
  schreibeKommentar(1, 2, 'Willkommen!');
  schreibeKommentar(1, 1, 'Danke mir selbst');
  reagieren(2, 'person-1', '👏');
  reagieren(1, 'person-1', '❤️');
  createGoal(1, {titel: 'Laufen', messung: 'frei', vergleich: 'min', je: 'zeitraum', wert: null, von: '2026-09-01', bis: '2026-09-30', oeffentlich: true, wiederholung: 'keine'});
  reagieren(2, 'ziel-1-erstellt', '✨');
  expect(resonanzFuer(1, seit).map((r) => [r.art, r.von, r.text, r.ereignis])).toEqual([
    ['kommentar', 'Ben', 'Willkommen!', undefined],
    ['reaktion', 'Ben', '👏', 'Neu im Team'],
    ['reaktion', 'Ben', '✨', 'Laufen'],
  ]);
  expect(resonanzFuer(2, seit)).toEqual([]);
});

test('Sammelmail: eine je Tag, deckt alles seither ab', async () => {
  const jetzt = new Date();
  reagieren(2, 'person-1', '👏');
  schreibeKommentar(1, 2, 'Hallo');
  expect(await erinnerungslauf(jetzt)).toBe(1);
  const post = () => db.query<{empfaenger: string; betreff: string}, []>("SELECT empfaenger, betreff FROM mail_versand WHERE art = 'team.resonanz'").all();
  expect(post()).toEqual([{empfaenger: 'a@t.de', betreff: '1 Kommentar und 1 Reaktion für dich'}]);

  reagieren(2, 'person-1', '❤️');
  db.query("UPDATE reaktionen SET created_at = ? WHERE art = '❤️'").run(new Date(jetzt.getTime() + 7_200_000).toISOString());
  expect(await erinnerungslauf(new Date(jetzt.getTime() + 3_600_000))).toBe(0); // Ruhezeit
  expect(await erinnerungslauf(new Date(jetzt.getTime() + RESONANZ_ABSTAND_MS + 1))).toBe(1);
  expect(post()[1]!.betreff).toBe('1 Reaktion für dich');
  expect(await erinnerungslauf(new Date(jetzt.getTime() + 2 * RESONANZ_ABSTAND_MS + 2))).toBe(0); // nichts Neues
});
