import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, uebernehmeTagesartenInSpannen, type User} from '../lib/db';
import {
  abwesenheitById,
  anspruchFor,
  createAbwesenheit,
  deleteAbwesenheit,
  einreichen,
  genehmigen,
  setUebertrag,
  setAuDatei,
  ueberschneidung,
  updateAbwesenheit,
  zurueckweisen,
  zurueckziehen,
} from '../lib/abwesenheit';
import {restanspruch} from '../lib/abwesenheit-arten';
import {setSetting} from '../lib/settings';
import {lockMonth, zeitkontoSummary} from '../lib/time';

// August 2026: Mo 03 … Fr 07, Sa 08, So 09, Mo 10 … Fr 14.
const MO = '2026-08-03';
const DI = '2026-08-04';
const MI = '2026-08-05';
const DO = '2026-08-06';
const FR = '2026-08-07';
const SA = '2026-08-08';
const MO2 = '2026-08-10';
const FR2 = '2026-08-14';

let db: Database;
let anna: User;
let chef: User;

const SPALTEN = 'id, email, name, role, weekly_minutes, active, created_at, bundesland, urlaubstage_jahr';

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('anna@t.de', 'x', 'Anna', 'mitarbeiter')").run();
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('chef@t.de', 'x', 'Chef', 'verwaltung')").run();
  [anna, chef] = db.query<User, []>(`SELECT ${SPALTEN} FROM users ORDER BY id`).all() as [User, User];
});

afterEach(() => setDbForTesting(undefined));

/** Legt eine Abwesenheit an und gibt ihre Kennung zurück — im Test nie fehlerhaft. */
function anlegen(art: 'urlaub' | 'krank' | 'freizeitausgleich' | 'fortbildung', von: string, bis: string, actor = anna) {
  const result = createAbwesenheit(actor, anna.id, {art, von, bis});
  if ('error' in result) throw new Error(result.error);
  return result.id;
}

const tagesarten = (): Array<{date: string; type: string; abwesenheit_id: number | null}> =>
  db
    .query<{date: string; type: string; abwesenheit_id: number | null}, []>(
      'SELECT date, type, abwesenheit_id FROM day_types ORDER BY date',
    )
    .all();

describe('Projektion: die Spanne schreibt die Tage', () => {
  test('ein Antrag wirkt erst mit der Genehmigung', () => {
    const id = anlegen('urlaub', MO, MI);
    expect(tagesarten()).toEqual([]);

    expect(einreichen(anna, id)).toBeNull();
    expect(tagesarten()).toEqual([]); // eingereicht ist noch nicht gewährt

    expect(genehmigen(chef, id)).toBeNull();
    expect(tagesarten().map((r) => r.date)).toEqual([MO, DI, MI]);
    expect(tagesarten().every((r) => r.type === 'urlaub' && r.abwesenheit_id === id)).toBe(true);
  });

  test('eine Meldung wirkt sofort — Krankheit fragt nicht um Erlaubnis', () => {
    anlegen('krank', MO, DI);
    expect(tagesarten().map((r) => r.type)).toEqual(['krank', 'krank']);
    expect(abwesenheitById(1)!.status).toBe('gemeldet');
  });

  test('Wochenendtage der Spanne werden mitgeschrieben, kosten aber nichts', () => {
    const id = anlegen('urlaub', FR, MO2);
    einreichen(anna, id);
    genehmigen(chef, id);
    expect(tagesarten().map((r) => r.date)).toEqual([FR, SA, '2026-08-09', MO2]);
    // Vier Kalendertage, aber nur zwei Arbeitstage kosten Anspruch.
    expect(anspruchFor(anna, '2026').genehmigt).toBe(2);
  });

  test('Zurückweisen nimmt die Tage wieder weg', () => {
    const id = anlegen('urlaub', MO, DI);
    einreichen(anna, id);
    genehmigen(chef, id);
    expect(tagesarten()).toHaveLength(2);
    // Erst durch eine Änderung zurück in die Prüfung, dann abgelehnt.
    expect(updateAbwesenheit(chef, id, {art: 'urlaub', von: MO, bis: DI})).toBeNull();
    expect(zurueckweisen(chef, id, 'Bitte im September nehmen.')).toBeNull();
    expect(tagesarten()).toEqual([]);
  });

  test('Löschen räumt die projizierten Tage mit ab', () => {
    const id = anlegen('krank', MO, MI);
    expect(tagesarten()).toHaveLength(3);
    expect(deleteAbwesenheit(anna, id)).toBeNull();
    expect(tagesarten()).toEqual([]);
  });

  test('eine gekürzte Spanne gibt die verlorenen Tage frei', () => {
    const id = anlegen('krank', MO, FR);
    expect(tagesarten()).toHaveLength(5);
    expect(updateAbwesenheit(anna, id, {art: 'krank', von: MO, bis: DI})).toBeNull();
    expect(tagesarten().map((r) => r.date)).toEqual([MO, DI]);
  });

  test('Krankheit gewinnt den Tag, den sie mit einem Urlaub teilt', () => {
    const urlaub = anlegen('urlaub', MO, FR);
    einreichen(anna, urlaub);
    genehmigen(chef, urlaub);
    anlegen('krank', MI, DO);
    const arten = Object.fromEntries(tagesarten().map((r) => [r.date, r.type]));
    expect(arten).toEqual({[MO]: 'urlaub', [DI]: 'urlaub', [MI]: 'krank', [DO]: 'krank', [FR]: 'urlaub'});
  });

  test('eine von Hand gesetzte Feiertagszeile überschreibt keine Spanne', () => {
    db.query("INSERT INTO day_types (user_id, date, type) VALUES (?, ?, 'feiertag')").run(anna.id, DI);
    const id = anlegen('urlaub', MO, MI);
    einreichen(anna, id);
    genehmigen(chef, id);
    const arten = Object.fromEntries(tagesarten().map((r) => [r.date, r.type]));
    expect(arten[DI]).toBe('feiertag');
    expect(arten[MO]).toBe('urlaub');
    // Und der Feiertag mitten im Urlaub kostet keinen Anspruch.
    expect(anspruchFor(anna, '2026').genehmigt).toBe(2);
  });
});

describe('Überschneidung', () => {
  test('zwei Urlaube dürfen sich nicht überlappen', () => {
    anlegen('urlaub', MO, MI);
    const result = createAbwesenheit(anna, anna.id, {art: 'urlaub', von: DI, bis: FR});
    expect(result).toEqual({error: expect.stringContaining('Überschneidung mit Urlaub')});
  });

  test('Krankheit darf über einem Urlaub liegen — §9 BUrlG verlangt es', () => {
    const id = anlegen('urlaub', MO, FR);
    einreichen(anna, id);
    genehmigen(chef, id);
    expect(ueberschneidung(anna.id, MI, DO, 'krank')).toBeNull();
    expect(createAbwesenheit(anna, anna.id, {art: 'krank', von: MI, bis: DO})).toEqual({id: 2});
  });

  test('aber nicht über einer zweiten Krankmeldung', () => {
    anlegen('krank', MO, MI);
    expect(createAbwesenheit(anna, anna.id, {art: 'krank', von: DI, bis: FR})).toEqual({
      error: expect.stringContaining('Überschneidung mit Krank'),
    });
  });

  test('eine abgelehnte Spanne blockiert nichts mehr', () => {
    const id = anlegen('urlaub', MO, MI);
    einreichen(anna, id);
    zurueckweisen(chef, id, 'Zu kurzfristig.');
    expect(createAbwesenheit(anna, anna.id, {art: 'urlaub', von: DI, bis: FR})).toEqual({id: 2});
  });

  test('die eigene Spanne blockiert die eigene Änderung nicht', () => {
    const id = anlegen('urlaub', MO, MI);
    expect(updateAbwesenheit(anna, id, {art: 'urlaub', von: MO, bis: FR})).toBeNull();
  });
});

describe('Urlaubsanspruch', () => {
  test('abgezogen wird bei der Genehmigung, nicht bei der Einreichung', () => {
    const id = anlegen('urlaub', MO, FR); // fünf Arbeitstage
    einreichen(anna, id);
    let a = anspruchFor(anna, '2026');
    expect(a).toMatchObject({jahresanspruch: 30, uebertrag: 0, genehmigt: 0, beantragt: 5});
    expect(restanspruch(a)).toBe(30);

    genehmigen(chef, id);
    a = anspruchFor(anna, '2026');
    expect(a).toMatchObject({genehmigt: 5, beantragt: 0});
    expect(restanspruch(a)).toBe(25);
  });

  test('der Übertrag der Verwaltung zählt mit', () => {
    expect(setUebertrag(chef, anna.id, '2026', 7)).toBeNull();
    expect(restanspruch(anspruchFor(anna, '2026'))).toBe(37);
  });

  test('ein Mitarbeiter trägt keinen Übertrag ein', () => {
    expect(setUebertrag(anna, anna.id, '2026', 7)).toBe('Keine Berechtigung.');
  });

  test('nur Urlaub kostet Anspruch — Fortbildung und Ausgleich nicht', () => {
    anlegen('fortbildung', MO, DI);
    const fza = anlegen('freizeitausgleich', MI, DO);
    einreichen(anna, fza);
    genehmigen(chef, fza);
    expect(anspruchFor(anna, '2026').genehmigt).toBe(0);
  });

  test('ein Feiertag im Urlaub wird nicht abgezogen', () => {
    setSetting('bundesland', 'SN');
    const user = {...anna, bundesland: 'SN'};
    // Mo 27.04. bis Fr 01.05.2026 — der 1. Mai fällt hier auf einen Freitag.
    const id = createAbwesenheit(user, anna.id, {art: 'urlaub', von: '2026-04-27', bis: '2026-05-01'});
    if ('error' in id) throw new Error(id.error);
    einreichen(anna, id.id);
    genehmigen(chef, id.id);
    // Mo–Fr sind fünf Arbeitstage, der 1. Mai fällt weg: vier.
    expect(anspruchFor(user, '2026').genehmigt).toBe(4);
  });

  test('eine Spanne über den Jahreswechsel zählt in jedem Jahr nur ihre Tage', () => {
    // Mo 28.12.2026 bis Fr 01.01.2027, durchgehend Werktage.
    const id = anlegen('urlaub', '2026-12-28', '2027-01-01');
    einreichen(anna, id);
    genehmigen(chef, id);
    expect(anspruchFor(anna, '2026').genehmigt).toBe(4); // Mo 28. bis Do 31.12.
    expect(anspruchFor(anna, '2027').genehmigt).toBe(1); // Fr 01.01.
  });
});

describe('Statusmaschine und Berechtigung', () => {
  test('nur die betroffene Person reicht ein, nur die Verwaltung entscheidet', () => {
    const id = anlegen('urlaub', MO, DI);
    expect(einreichen(chef, id)).toBe('Nur die betroffene Person kann den Antrag einreichen.');
    expect(einreichen(anna, id)).toBeNull();
    expect(genehmigen(anna, id)).toBe('Keine Berechtigung.');
    expect(genehmigen(chef, id)).toBeNull();
  });

  test('eine Meldung wird nicht beantragt', () => {
    const id = anlegen('krank', MO, DI);
    expect(einreichen(anna, id)).toBe('Diese Abwesenheit ist eine Meldung und wird nicht beantragt.');
  });

  test('Zurückziehen macht aus dem Antrag wieder einen Entwurf', () => {
    const id = anlegen('urlaub', MO, DI);
    einreichen(anna, id);
    expect(zurueckziehen(anna, id)).toBeNull();
    expect(abwesenheitById(id)).toMatchObject({status: 'entwurf', eingereicht_at: null});
  });

  test('eine geänderte Genehmigung geht zurück in die Prüfung', () => {
    const id = anlegen('urlaub', MO, DI);
    einreichen(anna, id);
    genehmigen(chef, id);
    expect(updateAbwesenheit(chef, id, {art: 'urlaub', von: MO, bis: MI})).toBeNull();
    expect(abwesenheitById(id)!.status).toBe('eingereicht');
    expect(tagesarten()).toEqual([]); // und wirkt bis dahin nicht mehr
  });

  test('die Verwaltung genehmigt sich selbst, aber sichtbar', () => {
    const result = createAbwesenheit(chef, chef.id, {art: 'urlaub', von: MO, bis: DI});
    if ('error' in result) throw new Error(result.error);
    expect(einreichen(chef, result.id)).toBeNull();
    expect(genehmigen(chef, result.id)).toBeNull();
    expect(abwesenheitById(result.id)).toMatchObject({status: 'genehmigt', selbst_genehmigt: 1});
  });

  test('die Art einer erfassten Abwesenheit wird nicht gewechselt', () => {
    const id = anlegen('urlaub', MO, DI);
    expect(updateAbwesenheit(anna, id, {art: 'krank', von: MO, bis: DI})).toBe(
      'Die Art einer erfassten Abwesenheit kann nicht gewechselt werden.',
    );
  });

  test('Krank bekommt keine Notiz — sonst stünde hier eine Diagnose', () => {
    const result = createAbwesenheit(anna, anna.id, {art: 'krank', von: MO, bis: DI, notiz: 'Bandscheibe'});
    if ('error' in result) throw new Error(result.error);
    expect(abwesenheitById(result.id)!.notiz).toBeNull();
    // Bei einem Urlaub ist die Notiz dagegen eine ganz gewöhnliche Angabe.
    const urlaub = createAbwesenheit(anna, anna.id, {art: 'urlaub', von: MO2, bis: FR2, notiz: 'Sommerurlaub'});
    if ('error' in urlaub) throw new Error(urlaub.error);
    expect(abwesenheitById(urlaub.id)!.notiz).toBe('Sommerurlaub');
  });
});

describe('Monatsabschluss', () => {
  test('ein abgeschlossener Monat nimmt keine Abwesenheit mehr an', () => {
    expect(lockMonth(chef, anna.id, '2026-07')).toBeNull();
    expect(createAbwesenheit(anna, anna.id, {art: 'krank', von: '2026-07-06', bis: '2026-07-07'})).toEqual({
      error: 'Dieser Monat ist abgeschlossen. Bitte wende dich an die Verwaltung.',
    });
  });

  test('ein offener Antrag hält den Abschluss auf', () => {
    const id = anlegen('urlaub', '2026-07-06', '2026-07-07');
    einreichen(anna, id);
    expect(lockMonth(chef, anna.id, '2026-07')).toBe(
      'Eingereichte Abwesenheitsanträge müssen vor dem Abschluss entschieden werden.',
    );
    genehmigen(chef, id);
    expect(lockMonth(chef, anna.id, '2026-07')).toBeNull();
  });
});

describe('Zeitkonto durch die Projektion hindurch', () => {
  test('genehmigter Urlaub bleibt saldenneutral, wie zuvor die Tagesart', () => {
    db.query("INSERT INTO segments (user_id, date, kind, start_min, end_min) VALUES (?, ?, 'arbeit', 480, 960)").run(
      anna.id,
      MO,
    );
    const id = anlegen('urlaub', DI, DI);
    einreichen(anna, id);
    genehmigen(chef, id);
    const summary = zeitkontoSummary(anna, MI);
    expect(summary.balanceMin).toBe(0);
    expect(summary.absenceDays).toBe(1);
  });
});

describe('§ 9 BUrlG — Krankheit im Urlaub', () => {
  /** Setzt eine Bescheinigung, ohne eine Datei zu schreiben — der Pfad genügt. */
  const bescheinigung = (id: number) =>
    setAuDatei(anna, id, {datei: `2026/${id}.pdf`, typ: 'application/pdf', name: 'au.pdf'});

  const genehmigterUrlaub = (von: string, bis: string) => {
    const id = anlegen('urlaub', von, bis);
    einreichen(anna, id);
    genehmigen(chef, id);
    return id;
  };

  const spannen = () =>
    db
      .query<{von: string; bis: string; art: string; status: string}, []>(
        'SELECT von, bis, art, status FROM abwesenheiten ORDER BY art, von',
      )
      .all();

  test('Krankheit mitten im Urlaub teilt ihn und gibt die Tage zurück', () => {
    genehmigterUrlaub(MO, FR); // fünf Arbeitstage
    expect(anspruchFor(anna, '2026').genehmigt).toBe(5);

    const krank = anlegen('krank', MI, DO);
    expect(bescheinigung(krank)).toBeNull();

    expect(spannen()).toEqual([
      {von: MI, bis: DO, art: 'krank', status: 'gemeldet'},
      {von: MO, bis: DI, art: 'urlaub', status: 'genehmigt'},
      {von: FR, bis: FR, art: 'urlaub', status: 'genehmigt'},
    ]);
    // Zwei Tage zurück: aus fünf werden drei.
    expect(anspruchFor(anna, '2026').genehmigt).toBe(3);
  });

  test('deckt die Krankheit den Urlaub ganz, bleibt keine Spanne übrig', () => {
    genehmigterUrlaub(DI, MI);
    const krank = anlegen('krank', MO, FR);
    bescheinigung(krank);
    expect(spannen()).toEqual([{von: MO, bis: FR, art: 'krank', status: 'gemeldet'}]);
    expect(anspruchFor(anna, '2026').genehmigt).toBe(0);
  });

  test('ohne Bescheinigung bleiben die Urlaubstage verbraucht', () => {
    genehmigterUrlaub(MO, FR);
    anlegen('krank', MI, DO); // keine AU
    expect(anspruchFor(anna, '2026').genehmigt).toBe(5);
    // Der Tag gehört trotzdem der Krankheit — nur bezahlt wird er aus dem Urlaub.
    const arten = Object.fromEntries(tagesarten().map((r) => [r.date, r.type]));
    expect(arten[MI]).toBe('krank');
  });

  test('ein nur beantragter Urlaub wird nicht angetastet', () => {
    const id = anlegen('urlaub', MO, FR);
    einreichen(anna, id);
    const krank = anlegen('krank', MI, DO);
    bescheinigung(krank);
    expect(abwesenheitById(id)).toMatchObject({von: MO, bis: FR, status: 'eingereicht'});
  });

  test('die Krankheit am Rand kürzt den Urlaub, statt ihn zu teilen', () => {
    genehmigterUrlaub(MO, FR);
    const krank = anlegen('krank', DO, FR);
    bescheinigung(krank);
    expect(spannen()).toEqual([
      {von: DO, bis: FR, art: 'krank', status: 'gemeldet'},
      {von: MO, bis: MI, art: 'urlaub', status: 'genehmigt'},
    ]);
    expect(anspruchFor(anna, '2026').genehmigt).toBe(3);
  });
});

describe('Migration: aus Tagen werden Spannen', () => {
  const tagesart = (date: string, type: string) =>
    db.query('INSERT INTO day_types (user_id, date, type) VALUES (?, ?, ?)').run(anna.id, date, type);

  test('aufeinanderfolgende Tage werden eine Spanne, das Wochenende trennt nicht', () => {
    for (const tag of [MO, DI, MI, DO, FR, MO2, '2026-08-11', '2026-08-12', '2026-08-13', FR2]) {
      tagesart(tag, 'urlaub');
    }
    uebernehmeTagesartenInSpannen(db);
    const spannen = db.query<{von: string; bis: string; art: string; status: string}, []>(
      'SELECT von, bis, art, status FROM abwesenheiten',
    ).all();
    expect(spannen).toEqual([{von: MO, bis: FR2, art: 'urlaub', status: 'genehmigt'}]);
    expect(tagesarten().every((r) => r.abwesenheit_id === 1)).toBe(true);
  });

  test('eine echte Lücke trennt zwei Spannen', () => {
    tagesart(MO, 'urlaub');
    tagesart(DI, 'urlaub');
    tagesart(FR, 'urlaub'); // Mittwoch und Donnerstag fehlen
    uebernehmeTagesartenInSpannen(db);
    expect(
      db.query<{von: string; bis: string}, []>('SELECT von, bis FROM abwesenheiten ORDER BY von').all(),
    ).toEqual([
      {von: MO, bis: DI},
      {von: FR, bis: FR},
    ]);
  });

  test('verschiedene Arten laufen nicht zusammen, und Krank wird gemeldet', () => {
    tagesart(MO, 'urlaub');
    tagesart(DI, 'krank');
    uebernehmeTagesartenInSpannen(db);
    expect(
      db.query<{art: string; status: string}, []>('SELECT art, status FROM abwesenheiten ORDER BY von').all(),
    ).toEqual([
      {art: 'urlaub', status: 'genehmigt'},
      {art: 'krank', status: 'gemeldet'},
    ]);
  });

  test('eine gespeicherte Feiertagszeile bleibt eine Zeile', () => {
    tagesart(MO, 'feiertag');
    uebernehmeTagesartenInSpannen(db);
    expect(db.query<{n: number}, []>('SELECT COUNT(*) AS n FROM abwesenheiten').get()!.n).toBe(0);
    expect(tagesarten()).toEqual([{date: MO, type: 'feiertag', abwesenheit_id: null}]);
  });
});
