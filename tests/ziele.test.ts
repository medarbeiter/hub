import {afterEach, beforeEach, expect, test} from 'bun:test';
import {createDb, setDbForTesting} from '../lib/db';
import {createGoal, deleteGoal, kommendeJahrestage, ownGoals, setGoalRecurring, zieleFortsetzen, publicGoals, publicPerson, reagieren, reaktionenFuer, setGoalDone, setGoalVisibility, teamTimeline, timelineBesuch} from '../lib/ziele';
import type {GoalInput} from '../lib/ziele-arten';
import type {Database} from 'bun:sqlite';

let db: Database;
beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (id,email,password_hash,name,role,eintritt) VALUES (1,'one@test.de','x','Ada','mitarbeiter','2025-03-03'),(2,'two@test.de','x','Ben','mitarbeiter',NULL)").run();
});
afterEach(() => { setDbForTesting(undefined); db.close(); });
const input = (extra: Partial<GoalInput> = {}): GoalInput => ({titel: 'Zehn Stunden täglich',messung: 'arbeitszeit',vergleich: 'min',je: 'tag',wert: 600,von: '2026-08-03',bis: '2026-08-07',oeffentlich: false,wiederholung: 'keine',...extra});
function goal(extra: Partial<GoalInput> = {}): number {
  const id = createGoal(1,input(extra));
  db.query("UPDATE ziele SET created_at = '2026-08-01' WHERE id = ?").run(id);
  return id;
}
function work(date: string, minutes = 600, auto = 0): void {
  db.query("INSERT INTO segments (user_id,date,kind,start_min,end_min,auto_closed) VALUES (1,?,'arbeit',480,?,?)").run(date,480 + minutes,auto);
}

test('daily ten hours requires every eligible day and corrections revoke the public achievement', () => {
  goal({oeffentlich: true});
  for (const date of ['2026-08-03','2026-08-04','2026-08-05','2026-08-06']) work(date);
  expect(ownGoals(1,'2026-08-07')[0]).toMatchObject({fortschritt: 4,ziel: 5,erreicht: false});
  work('2026-08-07',600,1);
  expect(ownGoals(1,'2026-08-07')[0]!.erreicht).toBe(false);
  db.query('UPDATE segments SET auto_closed = 0').run();
  expect(ownGoals(1,'2026-08-07')[0]).toMatchObject({erreicht: true,erreichtAm: '2026-08-07'});
  expect(teamTimeline(1,'2026-08-07').events.some(e => e.art === 'ziel_erreicht')).toBe(true);
  db.query("UPDATE segments SET end_min = 900 WHERE date = '2026-08-07'").run();
  expect(teamTimeline(1,'2026-08-07').events.some(e => e.art === 'ziel_erreicht')).toBe(false);
});

test('privacy and ownership hold in domain and public payload contains no recorded hours', () => {
  const id = goal({messung: 'frei'});
  expect(publicGoals(1,'2026-08-07')).toEqual([]);
  expect(() => setGoalDone(2,id,true)).toThrow();
  expect(() => deleteGoal(2,id)).toThrow();
  expect(() => setGoalVisibility(2,id,true)).toThrow();
  setGoalDone(1,id,true);
  setGoalVisibility(1,id,true);
  const exposed = publicGoals(1,'2099-01-01')[0]!;
  expect(exposed.erreicht).toBe(true);
  expect(Object.keys(exposed).sort()).toEqual(['automatisch','bis','erreicht','erreichtAm','id','regel','titel','von']);
  expect(publicPerson(1)).not.toHaveProperty('email');
  setGoalDone(1,id,false);
  expect(publicGoals(1,'2099-01-01')[0]!.erreicht).toBe(false);
});

test('weekly minutes exclude running days and automatic goals cannot be completed manually', () => {
  const id = goal({je: 'woche',bis: '2026-08-09',wert: 600});
  work('2026-08-03');
  db.query("INSERT INTO segments (user_id,date,kind,start_min,end_min) VALUES (1,'2026-08-03','pause',1100,NULL)").run();
  expect(ownGoals(1,'2026-08-09')[0]!.fortschritt).toBe(0);
  expect(() => setGoalDone(1,id,true)).toThrow('automatisch');
  db.query("DELETE FROM segments WHERE kind = 'pause'").run();
  expect(ownGoals(1,'2026-08-09')[0]!.erreicht).toBe(true);
});

test('absence days are exempt; empty ranges never earn completion; pauses use existing 15-minute rule', () => {
  goal({messung: 'pausen',wert: null,bis: '2026-08-04'});
  db.query("INSERT INTO day_types (user_id,date,type) VALUES (1,'2026-08-04','urlaub')").run();
  work('2026-08-03');
  expect(ownGoals(1,'2026-08-04')[0]).toMatchObject({ziel: 1,erreicht: false});
  db.query("INSERT INTO segments (user_id,date,kind,start_min,end_min) VALUES (1,'2026-08-03','pause',1080,1125)").run();
  expect(ownGoals(1,'2026-08-04')[0]!.erreicht).toBe(true);
  goal({messung: 'erfassung',von: '2026-08-08',bis: '2026-08-09'});
  expect(ownGoals(1,'2026-08-09')[0]).toMatchObject({ziel: 0,erreicht: false});
});

test('history has real entry and anniversary dates, clamps month ends, never invents entry for registration', () => {
  db.query("UPDATE users SET eintritt = '2024-08-31' WHERE id = 1").run();
  const events = teamTimeline(1,'2026-08-31').events;
  expect(events.find(e => e.id === 'jubilaeum-1-6')?.date).toBe('2025-02-28');
  expect(events.find(e => e.id === 'jubilaeum-1-24')?.date).toBe('2026-08-31');
  expect(events.some(e => e.person.id === 2 && e.art === 'jubilaeum')).toBe(false);
  db.query("UPDATE users SET geburtstag = '1990-02-29' WHERE id = 1").run();
  const geburtstage = teamTimeline(1,'2026-08-31').events.filter(e => e.art === 'geburtstag');
  expect(geburtstage.map(e => [e.id, e.date])).toEqual([['geburtstag-1-2026','2026-02-28'],['geburtstag-1-2025','2025-02-28']]); // nicht vor dem Eintritt, kein Alter
  expect(geburtstage.every(e => !/\d/.test(e.beschreibung))).toBe(true);
  expect(events.every(e => e.date <= '2026-08-31')).toBe(true);
  db.query("UPDATE users SET eintritt = '2025-11-15' WHERE id = 2").run();
  expect(kommendeJahrestage('2026-08-31', 90).map(j => [j.art, j.person.id, j.date, j.titel])).toEqual([['jubilaeum', 2, '2026-11-15', '1 Jahr im Team']]);
  expect(kommendeJahrestage('2027-02-01', 60).map(j => [j.art, j.date])).toEqual([['geburtstag', '2027-02-28']]); // heute selbst nie
});

test('range, type and threshold are validated at the write boundary', () => {
  for (const extra of [{von: '2026-02-30'}, {bis: '2027-08-04'}, {wert: NaN}, {wert: 1441}, {je: 'woche' as const}, {messung: 'anfang' as const, wert: 1440}]) expect(() => createGoal(1,input(extra))).toThrow();
});

test('registration uses the house calendar date across UTC midnight', () => {
  db.query("UPDATE users SET created_at = '2026-08-03 23:30:00' WHERE id = 2").run();
  expect(teamTimeline(1,'2026-08-03').events.find(e => e.id === 'person-2')).toBeUndefined();
  expect(teamTimeline(1,'2026-08-04').events.find(e => e.id === 'person-2')?.date).toBe('2026-08-04');
});

test('partial Freizeitausgleich does not exempt the remaining working day', () => {
  goal({messung: 'erfassung',bis: '2026-08-03'});
  db.query("INSERT INTO day_types (user_id,date,type,minuten) VALUES (1,'2026-08-03','freizeitausgleich',30)").run();
  expect(ownGoals(1,'2026-08-03')[0]).toMatchObject({ziel: 1,fortschritt: 0,erreicht: false});
  work('2026-08-03',450);
  expect(ownGoals(1,'2026-08-03')[0]).toMatchObject({ziel: 1,fortschritt: 1,erreicht: true});
});

test('same-day events sort by actual moment, with completion after posting and numeric tie breaks', () => {
  const ids: number[] = [];
  for (let i = 0; i < 12; i++) {
    const id = createGoal(1,input({messung: 'frei',oeffentlich: true}));
    ids.push(id);
    db.query('UPDATE ziele SET created_at = ? WHERE id = ?').run(`2026-08-04T08:${String(i).padStart(2,'0')}:00.000Z`,id);
  }
  db.query("UPDATE ziele SET done_at = '2026-08-04T08:20:00.000Z' WHERE id = ?").run(ids[0]!);
  const events = teamTimeline(1,'2026-08-04').events.filter(e => e.goalId !== undefined);
  expect(events[0]!.id).toBe(`ziel-${ids[0]}-erreicht`);
  expect(events.slice(1).map(e => e.goalId)).toEqual([...ids].reverse());
  expect(ownGoals(1,'2026-08-04').find(g => g.id === ids[0])).toMatchObject({created_at: '2026-08-04',done_at: '2026-08-04',erreichtAm: '2026-08-04'});
  db.query("UPDATE ziele SET created_at = '2026-08-04T08:00:00.000Z',done_at = NULL").run();
  expect(teamTimeline(1,'2026-08-04').events.filter(e => e.goalId !== undefined).map(e => e.goalId)).toEqual([...ids].reverse());
});

test('reactions toggle per person, count everyone, and refuse events that do not exist or are private', () => {
  const id = goal({messung: 'frei',oeffentlich: true});
  expect(reagieren(1,`ziel-${id}-erstellt`,'👏')).toBe(true);
  expect(reagieren(2,`ziel-${id}-erstellt`,'👏')).toBe(true);
  expect(reagieren(2,'person-1','❤️')).toBe(true);
  const stand = reaktionenFuer([`ziel-${id}-erstellt`,'person-1'],1);
  expect(stand[`ziel-${id}-erstellt`]).toMatchObject([{art: '👏',anzahl: 2,eigene: true}]);
  expect(stand['person-1']![0]).toMatchObject({art: '❤️',anzahl: 1,eigene: false});
  expect(stand['person-1']![0]!.personen.map(p => p.id)).toEqual([2]);
  expect(reagieren(1,`ziel-${id}-erstellt`,'👏')).toBe(false);
  expect(reaktionenFuer([`ziel-${id}-erstellt`],1)[`ziel-${id}-erstellt`]![0]!.anzahl).toBe(1);
  const privat = goal({messung: 'frei'});
  expect(() => reagieren(1,`ziel-${privat}-erstellt`,'❤️')).toThrow();
  expect(() => reagieren(1,'person-99','❤️')).toThrow();
  expect(() => reagieren(1,'jubilaeum-2-12','❤️')).toThrow();
  expect(() => reagieren(1,'person-1','🍕')).toThrow();
  expect(reagieren(1,'jubilaeum-1-12','✨')).toBe(true);
});

test('bricks: höchstens per day, spätestens Feierabend, weekly sums, generated title', () => {
  const hoechstens = goal({messung: 'arbeitszeit',vergleich: 'max',wert: 540,titel: ''});
  const feierabend = goal({messung: 'feierabend',vergleich: 'max',wert: 17 * 60,titel: ''});
  const wochen = goal({messung: 'arbeitszeit',je: 'woche',vergleich: 'min',wert: 600,von: '2026-08-03',bis: '2026-08-16',titel: ''});
  const alle = () => Object.fromEntries(ownGoals(1,'2026-08-16').map(z => [z.id,z]));
  expect(alle()[hoechstens]!.titel).toBe('An jedem Arbeitstag höchstens 9 Stunden arbeiten');
  expect(alle()[feierabend]!.titel).toBe('An jedem Arbeitstag spätestens um 17:00 Uhr Feierabend machen');
  expect(alle()[wochen]!.regel).toBe('mindestens 10 Stunden Arbeitszeit pro Woche');
  for (const date of ['2026-08-03','2026-08-04','2026-08-05','2026-08-06']) work(date,480);
  work('2026-08-07',600);
  expect(alle()[hoechstens]).toMatchObject({fortschritt: 4,ziel: 5,erreicht: false});
  expect(alle()[feierabend]).toMatchObject({fortschritt: 4,erreicht: false});
  expect(alle()[wochen]).toMatchObject({fortschritt: 1,ziel: 2,einheit: 'Wochen',erreicht: false});
  work('2026-08-10',600);
  expect(alle()[wochen]).toMatchObject({fortschritt: 2,erreicht: true,erreichtAm: '2026-08-10'});
  expect(() => createGoal(1,input({messung: 'erfassung',je: 'woche'}))).toThrow('Häufigkeit');
  expect(() => createGoal(1,input({messung: 'anfang',wert: 1500}))).toThrow('Uhrzeit');
  expect(() => createGoal(1,input({messung: 'frei',titel: ''}))).toThrow('vornimmst');
});

test('recurring goals roll into the next period, keep history, and post no new "erstellt" event', () => {
  const id = goal({oeffentlich: true,wiederholung: 'woche'});
  expect(() => createGoal(1,input({wiederholung: 'monat'}))).toThrow('Ersten');
  expect(zieleFortsetzen('2026-08-07')).toBe(0);
  expect(zieleFortsetzen('2026-08-18')).toBe(2);
  const alle = ownGoals(1,'2026-08-18');
  expect(alle.map(z => [z.von,z.bis,z.wiederholung,z.fortgesetzt])).toEqual([['2026-08-17','2026-08-21','woche',1],['2026-08-10','2026-08-14','keine',1],['2026-08-03','2026-08-07','keine',0]]);
  expect(zieleFortsetzen('2026-08-18')).toBe(0);
  expect(teamTimeline(1,'2026-08-18').events.filter(e => e.art === 'ziel_erstellt').map(e => e.goalId)).toEqual([id]);
  setGoalRecurring(1,alle[0]!.id,'keine');
  expect(zieleFortsetzen('2026-09-30')).toBe(0);
  const monat = goal({wiederholung: 'monat',von: '2026-08-01',bis: '2026-08-31'});
  expect(zieleFortsetzen('2026-10-02')).toBe(2);
  expect(ownGoals(1,'2026-10-02').filter(z => z.id > monat).map(z => [z.von,z.bis])).toEqual([['2026-10-01','2026-10-31'],['2026-09-01','2026-09-30']]);
});

test('a visit marks what is younger than the previous visit as new, never the viewer\'s own', () => {
  const id = goal({oeffentlich: true});
  db.query("UPDATE ziele SET created_at = '2026-08-05T10:00:00.000Z' WHERE id = ?").run(id);
  expect(timelineBesuch(2, new Date('2026-08-04T08:00:00Z'))).toBeNull();
  const ereignis = () => teamTimeline(1,'2026-08-31',{viewerId: 2, gesehenBis: timelineBesuch(2, new Date('2026-08-06T08:00:00Z'))}).events.find(e => e.id === `ziel-${id}-erstellt`)!;
  expect(ereignis().neu).toBe(true);
  // Innerhalb desselben Besuchs (Aktualisierung nach 30 s) bleibt es neu …
  expect(ereignis().neu).toBe(true);
  // … beim nächsten Besuch ist es gesehen, und die eigene Setzerin sah es nie als neu.
  expect(teamTimeline(1,'2026-08-31',{viewerId: 2, gesehenBis: timelineBesuch(2, new Date('2026-08-06T09:00:00Z'))}).events.find(e => e.id === `ziel-${id}-erstellt`)!.neu).toBe(false);
  expect(teamTimeline(1,'2026-08-31',{viewerId: 1, gesehenBis: '2026-08-01T00:00:00Z'}).events.find(e => e.id === `ziel-${id}-erstellt`)!.neu).toBe(false);
});
