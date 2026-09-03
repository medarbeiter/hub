// Die Erinnerung — was liegen bleibt, und wann davon jemand erfährt.
//
// Geprüft wird hier die *Frist*, nicht der Versand: dass eine Nachricht
// hinausgeht, wenn `mail_aktiv` an ist und ein Schlüssel hinterlegt ist,
// gehört lib/mail.ts, und im Test ist ohnehin keiner hinterlegt (der Versand
// verbucht dann „übersprungen"). Was hier zählt, ist die Entscheidung davor:
// wer wird gemahnt, ab wann, und wie oft.

import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {ERINNERUNG_AB, WIEDERVORLAGE, erinnerungslauf, jubilaeumJahre, tageSeit, vergiss} from '../lib/erinnerungen';
import {hausZeit} from '../lib/format';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

afterEach(() => {
  setDbForTesting(undefined);
  db.close();
});

/** UTC-Zeitstempel in der Form, in der SQLite ihn schreibt. */
function stempel(vorTagen: number, jetzt = new Date()): string {
  return new Date(jetzt.getTime() - vorTagen * 86_400_000).toISOString().slice(0, 19).replace('T', ' ');
}

function person(name: string, email: string, role = 'mitarbeiter'): number {
  db.query('INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, 1)')
    .run(email, 'x', name, role);
  return db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(email)!.id;
}

function antrag(userId: number, vorTagen: number, status = 'eingereicht'): number {
  db.query(
    `INSERT INTO abwesenheiten (user_id, von, bis, art, status, eingereicht_at)
     VALUES (?, '2026-09-07', '2026-09-11', 'urlaub', ?, ?)`,
  ).run(userId, status, stempel(vorTagen));
  return db.query<{id: number}, []>('SELECT last_insert_rowid() AS id').get()!.id;
}

function reise(userId: number, vorTagen: number, status = 'eingereicht'): number {
  db.query(
    `INSERT INTO reisen (user_id, start_date, start_min, end_date, end_min, zweck, status, eingereicht_at)
     VALUES (?, '2026-07-14', 480, '2026-07-16', 1020, 'Messe', ?, ?)`,
  ).run(userId, status, stempel(vorTagen));
  return db.query<{id: number}, []>('SELECT last_insert_rowid() AS id').get()!.id;
}

function gedaechtnis(bereich: string, id: number) {
  return db
    .query<{anzahl: number; zuletzt_am: string}, [string, number]>(
      'SELECT anzahl, zuletzt_am FROM erinnerungen WHERE bereich = ? AND gegenstand_id = ?',
    )
    .get(bereich, id);
}

describe('die Wartezeit', () => {
  test('zählt ganze Tage, nie Bruchteile', () => {
    // „Seit 3 Tagen offen" muss jemand nachrechnen können; 2,9 Tage wäre keine
    // andere Nachricht, nur eine unehrlichere.
    expect(tageSeit(stempel(3))).toBe(3);
    expect(tageSeit(stempel(0))).toBe(0);
    const knapp = new Date(Date.now() - (3 * 86_400_000 - 60_000));
    expect(tageSeit(knapp.toISOString().slice(0, 19).replace('T', ' '))).toBe(2);
  });

  test('ein unlesbarer Stempel mahnt nicht, statt zu raten', () => {
    expect(tageSeit('irgendwas')).toBe(0);
  });
});

describe('der Erinnerungslauf', () => {
  test('ein frischer Antrag löst nichts aus', async () => {
    const chef = person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    antrag(anna, ERINNERUNG_AB - 1);
    expect(chef).toBeGreaterThan(0);
    expect(await erinnerungslauf()).toBe(0);
  });

  test('nach der Frist geht genau eine Erinnerung hinaus', async () => {
    person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    const id = antrag(anna, ERINNERUNG_AB);

    expect(await erinnerungslauf()).toBe(1);
    expect(gedaechtnis('abwesenheit', id)?.anzahl).toBe(1);

    // Der zweite Lauf am selben Tag mahnt nicht noch einmal — sonst schickte
    // jeder Seitenaufruf eine neue Nachricht.
    expect(await erinnerungslauf()).toBe(0);
    expect(gedaechtnis('abwesenheit', id)?.anzahl).toBe(1);
  });

  test('nach der Wiedervorlage mahnt sie erneut', async () => {
    person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    const id = antrag(anna, ERINNERUNG_AB);
    await erinnerungslauf();

    // Das Gedächtnis um die Wiedervorlage zurückdatieren: derselbe Zustand
    // wie ein paar Tage später, ohne den Test warten zu lassen.
    db.query('UPDATE erinnerungen SET zuletzt_am = ? WHERE bereich = ? AND gegenstand_id = ?')
      .run(stempel(WIEDERVORLAGE), 'abwesenheit', id);

    expect(await erinnerungslauf()).toBe(1);
    expect(gedaechtnis('abwesenheit', id)?.anzahl).toBe(2);
  });

  test('jede prüfende Person bekommt die Mahnung, die betroffene nicht', async () => {
    person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    person('Ben Kraus', 'ben@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    antrag(anna, ERINNERUNG_AB);
    await erinnerungslauf();

    const zeilen = db
      .query<{empfaenger: string; art: string}, []>('SELECT empfaenger, art FROM mail_versand')
      .all();
    expect(zeilen.map((z) => z.empfaenger).sort()).toEqual(['ben@t.de', 'chef@t.de']);
    expect(new Set(zeilen.map((z) => z.art))).toEqual(new Set(['abwesenheit.erinnerung']));
  });

  test('reicht die Verwaltung selbst ein, mahnt sie sich nicht selbst', async () => {
    const chef = person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    antrag(chef, ERINNERUNG_AB);
    expect(await erinnerungslauf()).toBe(0);
  });

  test('nur wirklich offene Vorgänge — entschieden heißt still', async () => {
    person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    antrag(anna, ERINNERUNG_AB + 5, 'genehmigt');
    antrag(anna, ERINNERUNG_AB + 5, 'entwurf');
    antrag(anna, ERINNERUNG_AB + 5, 'abgelehnt');
    expect(await erinnerungslauf()).toBe(0);
  });

  test('eine liegen gebliebene Abrechnung mahnt ihren eigenen Kreis', async () => {
    person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    const id = reise(anna, ERINNERUNG_AB + 1);

    expect(await erinnerungslauf()).toBe(1);
    expect(gedaechtnis('reise', id)?.anzahl).toBe(1);
    expect(db.query<{art: string}, []>('SELECT art FROM mail_versand').all().map((z) => z.art)).toEqual([
      'reise.erinnerung',
    ]);
  });

  test('der Feger räumt das Gedächtnis entschiedener Vorgänge weg', async () => {
    person('Jessica Peneva', 'chef@t.de', 'verwaltung');
    const anna = person('Anna Berger', 'anna@t.de');
    const id = antrag(anna, ERINNERUNG_AB);
    await erinnerungslauf();
    expect(gedaechtnis('abwesenheit', id)).not.toBeNull();

    // Entschieden — und damit beginnt eine spätere Einreichung wieder von vorn,
    // statt sofort eine Mahnung zu erben.
    db.query("UPDATE abwesenheiten SET status = 'genehmigt' WHERE id = ?").run(id);
    await erinnerungslauf();
    expect(gedaechtnis('abwesenheit', id)).toBeNull();
  });

  test('Zurückziehen vergisst die Frist sofort', () => {
    const anna = person('Anna Berger', 'anna@t.de');
    const id = antrag(anna, ERINNERUNG_AB);
    db.query('INSERT INTO erinnerungen (bereich, gegenstand_id) VALUES (?, ?)').run('abwesenheit', id);
    vergiss('abwesenheit', id);
    expect(gedaechtnis('abwesenheit', id)).toBeNull();
  });
});

describe('Dienstjubiläum', () => {
  test('nur am Jahrestag, und erst ab einem vollen Jahr', () => {
    expect(jubilaeumJahre('2024-09-03', '2026-09-03')).toBe(2);
    expect(jubilaeumJahre('2026-09-03', '2026-09-03')).toBeNull();
    expect(jubilaeumJahre('2024-09-03', '2026-09-04')).toBeNull();
    expect(jubilaeumJahre(null, '2026-09-03')).toBeNull();
    expect(jubilaeumJahre('2024-02-29', '2026-02-28')).toBe(2); // kein Schaltjahr
    expect(jubilaeumJahre('2024-02-29', '2028-02-28')).toBeNull(); // Schaltjahr: am 29.
    expect(jubilaeumJahre('2024-02-29', '2028-02-29')).toBe(4);
  });

  test('geht einmal an alle anderen, nicht an die Person selbst', async () => {
    const jetzt = new Date();
    const heute = hausZeit(jetzt).datum;
    const eintritt = `${Number(heute.slice(0, 4)) - 3}${heute.slice(4)}`;
    const jubilar = person('Jubilar', 'j@t.de');
    person('Kollegin', 'k@t.de');
    db.query('UPDATE users SET eintritt = ? WHERE id = ?').run(eintritt, jubilar);

    expect(await erinnerungslauf(jetzt)).toBe(1);
    expect(gedaechtnis('jubilaeum', jubilar)?.anzahl).toBe(1);
    const post = db.query<{empfaenger: string}, []>("SELECT empfaenger FROM mail_versand WHERE art = 'team.jubilaeum'").all();
    expect(post.map((p) => p.empfaenger)).toEqual(['k@t.de']);

    expect(await erinnerungslauf(jetzt)).toBe(0); // schon gefeiert
  });
});
