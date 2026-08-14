import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {ereignisFuer, ereignisStand, syncGoogleAbwesenheiten} from '../lib/google-kalender';

// ---------------------------------------------------------------------------
// Ereignis-Bau (rein)
// ---------------------------------------------------------------------------

describe('ereignisFuer', () => {
  test('ganztägig mit exklusivem Ende, Name im Titel, Herkunft in der Beschreibung', () => {
    const e = ereignisFuer({id: 7, art: 'urlaub', von: '2026-08-10', bis: '2026-08-14'}, 'Max Muma');
    expect(e.summary).toBe('Urlaub – Max Muma');
    expect(e.description).toContain('MedArbeiter Hub');
    expect(e.start.date).toBe('2026-08-10');
    expect(e.end.date).toBe('2026-08-15');
    expect(e.extendedProperties.private.medarbeiterAbwesenheit).toBe('7');
    // Eine Abwesenheit weckt niemanden um acht.
    expect(e.reminders.useDefault).toBe(false);
  });

  test('das exklusive Ende trägt über den Monatswechsel', () => {
    const e = ereignisFuer({id: 1, art: 'fortbildung', von: '2026-08-31', bis: '2026-08-31'}, 'Max Muma');
    expect(e.start.date).toBe('2026-08-31');
    expect(e.end.date).toBe('2026-09-01');
  });

  test('jede Art trägt ihre eigene Farbe', () => {
    const farbe = (art: 'urlaub' | 'krank' | 'fortbildung' | 'freizeitausgleich') =>
      ereignisFuer({id: 1, art, von: '2026-08-03', bis: '2026-08-03'}, 'X').colorId;
    const farben = ['urlaub', 'krank', 'fortbildung', 'freizeitausgleich'].map((a) => farbe(a as never));
    expect(new Set(farben).size).toBe(4);
  });

  test('Krank verlässt das Haus nur als „Abwesend" — keine Gesundheitsangabe bei Google', () => {
    const e = ereignisFuer({id: 3, art: 'krank', von: '2026-08-03', bis: '2026-08-05'}, 'Max Muma');
    expect(e.summary).toBe('Abwesend – Max Muma');
    expect(JSON.stringify(e)).not.toContain('rank');
  });
});

describe('ereignisStand', () => {
  test('ändert sich mit Titel, Spanne und Name, sonst nicht', () => {
    const a = {art: 'urlaub' as const, von: '2026-08-10', bis: '2026-08-14'};
    expect(ereignisStand(a, 'Max')).toBe(ereignisStand({...a}, 'Max'));
    expect(ereignisStand(a, 'Max')).not.toBe(ereignisStand({...a, bis: '2026-08-15'}, 'Max'));
    expect(ereignisStand(a, 'Max')).not.toBe(ereignisStand(a, 'Maxi'));
  });
});

// ---------------------------------------------------------------------------
// Abgleich (gegen eine aufgezeichnete fetch)
// ---------------------------------------------------------------------------

let db: Database;
let userId: number;
let aufrufe: Array<{methode: string; url: string; body: unknown}>;
const echteFetch = globalThis.fetch;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('t@t.de', 'x', 'Test', 'mitarbeiter')").run();
  userId = db.query<{id: number}, []>('SELECT id FROM users').get()!.id;
  // Ein verbundenes Konto mit noch lange gültigem Token — der Abgleich darf
  // den Token-Endpunkt gar nicht erst anfragen.
  db.query(
    `INSERT INTO google_konten (user_id, google_sub, google_email, access_token, refresh_token, token_expiry)
     VALUES (?, 'sub', 't@gmail.com', 'token', 'refresh', ?)`,
  ).run(userId, Date.now() + 3_600_000);
  process.env.GOOGLE_CLIENT_ID = 'test-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';

  aufrufe = [];
  let laufendeId = 0;
  globalThis.fetch = (async (eingabe: string | URL | Request, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = init?.method ?? 'GET';
    aufrufe.push({methode, url, body: init?.body ? JSON.parse(String(init.body)) : null});
    const body = methode === 'POST' ? JSON.stringify({id: `ereignis-${++laufendeId}`}) : '{}';
    return new Response(body, {status: 200, headers: {'Content-Type': 'application/json'}});
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = echteFetch;
  setDbForTesting(undefined);
});

function abwesenheit(art: string, von: string, bis: string, status: string): number {
  return db
    .query<{id: number}, [number, string, string, string, string]>(
      `INSERT INTO abwesenheiten (user_id, von, bis, art, status) VALUES (?, ?, ?, ?, ?) RETURNING id`,
    )
    .get(userId, von, bis, art, status)!.id;
}

function eintraege(): Array<{abwesenheit_id: number; event_id: string}> {
  return db
    .query<{abwesenheit_id: number; event_id: string}, [number]>(
      'SELECT abwesenheit_id, event_id FROM google_kalender_eintraege WHERE user_id = ? ORDER BY abwesenheit_id',
    )
    .all(userId);
}

describe('syncGoogleAbwesenheiten', () => {
  test('legt für wirksame Spannen Ereignisse an, für Entwürfe nicht', async () => {
    abwesenheit('urlaub', '2026-08-10', '2026-08-14', 'genehmigt');
    abwesenheit('urlaub', '2026-09-01', '2026-09-02', 'entwurf');
    await syncGoogleAbwesenheiten(userId);
    const posts = aufrufe.filter((a) => a.methode === 'POST');
    expect(posts).toHaveLength(1);
    expect((posts[0]!.body as {summary: string}).summary).toBe('Urlaub – Test');
    expect(eintraege()).toHaveLength(1);
  });

  test('eine Umbenennung zieht den Titel nach', async () => {
    abwesenheit('urlaub', '2026-08-10', '2026-08-14', 'genehmigt');
    await syncGoogleAbwesenheiten(userId);
    db.query("UPDATE users SET name = 'Test Neu' WHERE id = ?").run(userId);
    aufrufe = [];
    await syncGoogleAbwesenheiten(userId);
    const patches = aufrufe.filter((a) => a.methode === 'PATCH');
    expect(patches).toHaveLength(1);
    expect((patches[0]!.body as {summary: string}).summary).toBe('Urlaub – Test Neu');
  });

  test('ohne Abweichung kein einziger API-Aufruf', async () => {
    abwesenheit('urlaub', '2026-08-10', '2026-08-14', 'genehmigt');
    await syncGoogleAbwesenheiten(userId);
    aufrufe = [];
    await syncGoogleAbwesenheiten(userId);
    expect(aufrufe).toHaveLength(0);
  });

  test('eine verschwundene Spanne räumt ihr Ereignis ab — der §9-Fall', async () => {
    const id = abwesenheit('urlaub', '2026-08-10', '2026-08-14', 'genehmigt');
    await syncGoogleAbwesenheiten(userId);
    db.query('DELETE FROM abwesenheiten WHERE id = ?').run(id);
    abwesenheit('urlaub', '2026-08-10', '2026-08-11', 'genehmigt');
    aufrufe = [];
    await syncGoogleAbwesenheiten(userId);
    expect(aufrufe.some((a) => a.methode === 'DELETE')).toBe(true);
    expect(aufrufe.filter((a) => a.methode === 'POST')).toHaveLength(1);
    expect(eintraege()).toHaveLength(1);
  });

  test('eine verschobene Spanne ändert ihr Ereignis statt es zu verdoppeln', async () => {
    const id = abwesenheit('urlaub', '2026-08-10', '2026-08-14', 'genehmigt');
    await syncGoogleAbwesenheiten(userId);
    db.query("UPDATE abwesenheiten SET bis = '2026-08-17' WHERE id = ?").run(id);
    aufrufe = [];
    await syncGoogleAbwesenheiten(userId);
    expect(aufrufe.filter((a) => a.methode === 'PATCH')).toHaveLength(1);
    expect(eintraege()).toHaveLength(1);
  });

  test('ohne verbundenes Konto ein No-op', async () => {
    db.query('DELETE FROM google_konten WHERE user_id = ?').run(userId);
    abwesenheit('urlaub', '2026-08-10', '2026-08-14', 'genehmigt');
    await syncGoogleAbwesenheiten(userId);
    expect(aufrufe).toHaveLength(0);
  });
});
