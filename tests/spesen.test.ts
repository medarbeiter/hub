import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {addDays, todayISO} from '../lib/format';
import {setSpesenSaetze} from '../lib/settings';
import {lockMonth} from '../lib/time';
import {
  addBeleg,
  createReise,
  deleteBeleg,
  deleteReise,
  einreichen,
  genehmigen,
  reiseById,
  reisenForMonth,
  reisenZurPruefung,
  mitRechnung,
  ueberlappendeReise,
  updateReise,
  zurueckweisen,
  zurueckziehen,
} from '../lib/spesen';

// Die Reisen liegen bewusst in der Vergangenheit: eingereicht werden kann erst
// nach der Rückkehr. VOR_MONAT ist ein abgeschlossener Monat für die Sperrtests.
// Juli 2026 liegt hinter dem Stichtag 01.10.2025, es gilt also die Stufe 10/20 €:
// eine dreitägige Reise ergibt 10 + 20 + 10 = 40,00 €.
const VOR_MONAT = '2026-07';
const VON = '2026-07-06';
const BIS = '2026-07-08';

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
  };
}

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES ('anna@t.de', 'x', 'Anna', 'mitarbeiter')",
  ).run();
  db.query(
    "INSERT INTO users (email, password_hash, name, role) VALUES ('chef@t.de', 'x', 'Chef', 'verwaltung')",
  ).run();
  const ids = db.query<{id: number; name: string}, []>('SELECT id, name FROM users ORDER BY id').all();
  anna = nutzer(ids[0]!.id, 'Anna', 'mitarbeiter');
  chef = nutzer(ids[1]!.id, 'Chef', 'verwaltung');
});

afterEach(() => setDbForTesting(undefined));

function reise(von = VON, bis = BIS, zweck = 'Fotoshooting Klinik Nord'): number {
  const fehler = createReise(anna, anna.id, {
    startDate: von,
    startMin: 420,
    endDate: bis,
    endMin: 1140,
    zweck,
    ziel: 'Hamburg',
  });
  expect(fehler).toBeNull();
  return db.query<{id: number}, []>('SELECT id FROM reisen ORDER BY id DESC LIMIT 1').get()!.id;
}

describe('erfassen', () => {
  test('eine Reise wird angelegt und im Monat gefunden', () => {
    const id = reise();
    const monat = reisenForMonth(anna.id, VOR_MONAT);
    expect(monat).toHaveLength(1);
    expect(monat[0]!.reise.id).toBe(id);
    expect(monat[0]!.reise.status).toBe('entwurf');
    expect(monat[0]!.rechnung.pauschaleCent).toBe(1000 + 2000 + 1000);
  });

  test('eine Reise über den Monatswechsel erscheint in beiden Monaten', () => {
    createReise(anna, anna.id, {
      startDate: '2026-06-29',
      startMin: 480,
      endDate: '2026-07-02',
      endMin: 900,
      zweck: 'Messe',
    });
    expect(reisenForMonth(anna.id, '2026-06')).toHaveLength(1);
    expect(reisenForMonth(anna.id, '2026-07')).toHaveLength(1);
  });

  test('überschneidende Reisen werden abgewiesen und benennen den Konflikt', () => {
    reise();
    const fehler = createReise(anna, anna.id, {
      startDate: '2026-07-08',
      startMin: 600,
      endDate: '2026-07-09',
      endMin: 900,
      zweck: 'Zweiter Termin',
    });
    expect(fehler).toContain('Überschneidung');
    expect(fehler).toContain('6. – 8. Juli');
  });

  test('die eigene Reise ist beim Ändern nicht ihr eigener Konflikt', () => {
    const id = reise();
    expect(ueberlappendeReise(anna.id, VON, BIS, id)).toBeNull();
    expect(updateReise(anna, id, {startDate: VON, startMin: 400, endDate: BIS, endMin: 1200, zweck: 'Neu'})).toBeNull();
  });

  test('ohne Anlass geht es nicht', () => {
    expect(
      createReise(anna, anna.id, {startDate: VON, startMin: 420, endDate: VON, endMin: 1140, zweck: '   '}),
    ).toBe('Bitte den Anlass der Reise angeben.');
  });

  test('fremde Reisen kann nur die Verwaltung anlegen', () => {
    const bea = nutzer(999, 'Bea', 'mitarbeiter');
    expect(createReise(bea, anna.id, {startDate: VON, startMin: 420, endDate: VON, endMin: 1140, zweck: 'X'})).toBe(
      'Keine Berechtigung.',
    );
    expect(createReise(chef, anna.id, {startDate: VON, startMin: 420, endDate: VON, endMin: 1140, zweck: 'X'})).toBeNull();
  });
});

describe('Monatsabschluss', () => {
  test('ein abgeschlossener Monat ist auch für Reisen zu', () => {
    expect(lockMonth(chef, anna.id, VOR_MONAT)).toBeNull();
    expect(
      createReise(anna, anna.id, {startDate: VON, startMin: 420, endDate: VON, endMin: 1140, zweck: 'X'}),
    ).toBe('Dieser Monat ist abgeschlossen.');
  });

  test('eine eingereichte Reise blockiert den Abschluss', () => {
    const id = reise();
    expect(einreichen(anna, id)).toBeNull();
    expect(lockMonth(chef, anna.id, VOR_MONAT)).toBe(
      'Eingereichte Reisen müssen vor dem Abschluss geprüft werden.',
    );
    expect(genehmigen(chef, id)).toBeNull();
    expect(lockMonth(chef, anna.id, VOR_MONAT)).toBeNull();
  });
});

describe('einreichen', () => {
  test('nur die reisende Person reicht ein', () => {
    const id = reise();
    expect(einreichen(chef, id)).toBe('Nur die reisende Person kann die Abrechnung einreichen.');
    expect(einreichen(anna, id)).toBeNull();
    expect(reiseById(id)!.status).toBe('eingereicht');
  });

  test('vor der Rückkehr wird nicht abgerechnet', () => {
    const kuenftig = addDays(todayISO(), 5);
    const id = reise(kuenftig, addDays(kuenftig, 2), 'Geplante Reise');
    expect(einreichen(anna, id)).toBe('Die Abrechnung kann erst nach der Rückkehr eingereicht werden.');
  });

  test('die Sätze werden eingefroren — spätere Änderungen ändern den Betrag nicht', () => {
    const id = reise();
    expect(einreichen(anna, id)).toBeNull();
    const vorher = mitRechnung(reiseById(id)!).rechnung.pauschaleCent;

    setSpesenSaetze([{ab: '1900-01-01', halbCent: 9900, vollCent: 9900}]);

    const nachher = mitRechnung(reiseById(id)!);
    expect(nachher.rechnung.pauschaleCent).toBe(vorher);
    expect(nachher.saetzeAktuell).toBe(false);
  });

  test('ein Entwurf rechnet dagegen immer mit den aktuellen Sätzen', () => {
    const id = reise();
    setSpesenSaetze([{ab: '1900-01-01', halbCent: 1400, vollCent: 3000}]);
    const r = mitRechnung(reiseById(id)!);
    expect(r.saetzeAktuell).toBe(true);
    expect(r.rechnung.pauschaleCent).toBe(1400 + 3000 + 1400);
  });

  test('zurückziehen macht wieder einen Entwurf daraus', () => {
    const id = reise();
    einreichen(anna, id);
    expect(zurueckziehen(chef, id)).toBe('Nur die reisende Person kann die Abrechnung zurückziehen.');
    expect(zurueckziehen(anna, id)).toBeNull();
    const r = reiseById(id)!;
    expect(r.status).toBe('entwurf');
    expect(r.satz_teiltag_cent).toBeNull();
  });
});

describe('prüfen', () => {
  test('genehmigen darf nur die Verwaltung, und nur Eingereichtes', () => {
    const id = reise();
    expect(genehmigen(chef, id)).toBe('Nur eine eingereichte Abrechnung kann genehmigt werden.');
    einreichen(anna, id);
    expect(genehmigen(anna, id)).toBe('Keine Berechtigung.');
    expect(genehmigen(chef, id)).toBeNull();
    expect(reiseById(id)!.entschieden_von).toBe(chef.id);
  });

  test('zurückweisen verlangt einen Grund', () => {
    const id = reise();
    einreichen(anna, id);
    expect(zurueckweisen(chef, id, '  ')).toBe('Bitte einen Grund für die Zurückweisung angeben.');
    expect(zurueckweisen(chef, id, 'Bitte Beleg für die Übernachtung nachreichen.')).toBeNull();
    const r = reiseById(id)!;
    expect(r.status).toBe('abgelehnt');
    expect(r.entscheidung_notiz).toContain('Übernachtung');
  });

  test('die Prüfliste zeigt Eingereichtes mit Namen', () => {
    const id = reise();
    einreichen(anna, id);
    const liste = reisenZurPruefung('eingereicht');
    expect(liste).toHaveLength(1);
    expect(liste[0]!.userName).toBe('Anna');
    expect(liste[0]!.rechnung.summeCent).toBe(4000);
  });

  test('eine geänderte Abrechnung verliert ihre Entscheidung', () => {
    const id = reise();
    einreichen(anna, id);
    genehmigen(chef, id);

    // Der Mitarbeiter kommt an eine genehmigte Abrechnung nicht mehr heran.
    expect(updateReise(anna, id, {startDate: VON, startMin: 400, endDate: BIS, endMin: 1200, zweck: 'Neu'})).toBe(
      'Eine genehmigte Reise kann nur die Verwaltung ändern.',
    );
    expect(updateReise(chef, id, {startDate: VON, startMin: 400, endDate: BIS, endMin: 1200, zweck: 'Neu'})).toBeNull();
    expect(reiseById(id)!.status).toBe('eingereicht');
  });

  test('eine abgelehnte Abrechnung wird durch Korrektur wieder zum Entwurf', () => {
    const id = reise();
    einreichen(anna, id);
    zurueckweisen(chef, id, 'Zeiten prüfen.');
    expect(updateReise(anna, id, {startDate: VON, startMin: 400, endDate: BIS, endMin: 1200, zweck: 'Korrigiert'})).toBeNull();
    expect(reiseById(id)!.status).toBe('entwurf');
  });
});

describe('Belege', () => {
  test('ein Beleg addiert sich zur Summe, ohne die Pauschale zu verändern', () => {
    const id = reise();
    expect(addBeleg(anna, id, {art: 'uebernachtung', datum: '2026-07-07', betragCent: 8900})).toBeNull();
    const r = mitRechnung(reiseById(id)!);
    expect(r.rechnung.pauschaleCent).toBe(4000);
    expect(r.rechnung.belegeCent).toBe(8900);
    expect(r.rechnung.summeCent).toBe(12900);
  });

  test('ein Beleg außerhalb des Reisezeitraums wird abgewiesen', () => {
    const id = reise();
    expect(addBeleg(anna, id, {art: 'parken', datum: '2026-07-12', betragCent: 500})).toBe(
      'Das Belegdatum muss in den Reisezeitraum fallen.',
    );
  });

  test('ein Betrag von 0 ist kein Beleg', () => {
    const id = reise();
    expect(addBeleg(anna, id, {art: 'parken', datum: '2026-07-07', betragCent: 0})).toContain('größer als 0,00 €');
  });

  test('Belege verschwinden mit ihrer Reise', () => {
    const id = reise();
    addBeleg(anna, id, {art: 'ticket', datum: '2026-07-06', betragCent: 4250});
    expect(deleteReise(anna, id)).toBeNull();
    expect(db.query<{n: number}, []>('SELECT COUNT(*) AS n FROM reise_belege').get()!.n).toBe(0);
  });

  test('einen Beleg löscht nur, wer die Reise ändern darf', () => {
    const id = reise();
    addBeleg(anna, id, {art: 'ticket', datum: '2026-07-06', betragCent: 4250});
    const belegId = db.query<{id: number}, []>('SELECT id FROM reise_belege ORDER BY id DESC LIMIT 1').get()!.id;
    const bea = nutzer(999, 'Bea', 'mitarbeiter');
    expect(deleteBeleg(bea, belegId)).toBe('Keine Berechtigung.');
    expect(deleteBeleg(anna, belegId)).toBeNull();
  });
});
