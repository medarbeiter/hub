import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {appBasis, benutzerFuerGoogleLogin, googleRedirectUri, pruefeIdToken} from '../lib/google';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  process.env.GOOGLE_CLIENT_ID = 'test-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-secret';
});

afterEach(() => setDbForTesting(undefined));

function nutzer(email: string, active = 1): number {
  db.query("INSERT INTO users (email, password_hash, name, role, active) VALUES (?, 'x', 'Test', 'mitarbeiter', ?)").run(
    email,
    active,
  );
  return db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(email)!.id;
}

describe('benutzerFuerGoogleLogin', () => {
  test('die ausdrückliche Verknüpfung schlägt die E-Mail', () => {
    const a = nutzer('a@firma.de');
    const b = nutzer('b@gmail.com');
    // b hat sein privates Google-Konto verknüpft — dessen sub gewinnt, auch
    // wenn die Google-E-Mail zu keiner Firmen-Adresse passt.
    db.query(
      `INSERT INTO google_konten (user_id, google_sub, google_email, access_token, token_expiry)
       VALUES (?, 'sub-b', 'b@gmail.com', 't', 0)`,
    ).run(b);
    expect(benutzerFuerGoogleLogin('sub-b', 'b@gmail.com')).toBe(b);
    expect(benutzerFuerGoogleLogin('unbekannt', 'a@firma.de')).toBe(a);
  });

  test('Groß- und Kleinschreibung der E-Mail spielt keine Rolle', () => {
    const id = nutzer('c@firma.de');
    expect(benutzerFuerGoogleLogin('unbekannt', 'C@Firma.de')).toBe(id);
  });

  test('ein deaktiviertes Konto meldet sich auch über Google nicht an', () => {
    const id = nutzer('weg@firma.de', 0);
    db.query(
      `INSERT INTO google_konten (user_id, google_sub, google_email, access_token, token_expiry)
       VALUES (?, 'sub-weg', 'weg@firma.de', 't', 0)`,
    ).run(id);
    expect(benutzerFuerGoogleLogin('sub-weg', 'weg@firma.de')).toBeNull();
  });

  test('ohne Treffer null', () => {
    expect(benutzerFuerGoogleLogin('niemand', 'fremd@anderswo.de')).toBeNull();
  });
});

describe('pruefeIdToken', () => {
  const echteFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = echteFetch;
  });

  const antwortet = (status: number, body: Record<string, string>) => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}})) as unknown as typeof fetch;
  };

  test('nimmt nur Tokens, die für diese Anwendung ausgestellt sind', async () => {
    antwortet(200, {aud: 'fremde-id', iss: 'accounts.google.com', sub: 's', email: 'x@y.de', email_verified: 'true'});
    expect(await pruefeIdToken('token')).toContain('gehört nicht zu dieser Anwendung');
  });

  test('verlangt eine bestätigte E-Mail', async () => {
    antwortet(200, {aud: 'test-id', iss: 'accounts.google.com', sub: 's', email: 'x@y.de', email_verified: 'false'});
    expect(await pruefeIdToken('token')).toContain('bestätigte E-Mail');
  });

  test('ein von Google abgewiesenes Token kommt nicht durch', async () => {
    antwortet(400, {error: 'invalid_token'});
    expect(await pruefeIdToken('token')).toContain('nicht bestätigt');
  });

  test('ein gültiges Token liefert sub und email', async () => {
    antwortet(200, {aud: 'test-id', iss: 'https://accounts.google.com', sub: 's-1', email: 'x@y.de', email_verified: 'true'});
    expect(await pruefeIdToken('token')).toEqual({sub: 's-1', email: 'x@y.de'});
  });
});

// Die Basis eines Rücksprungs ist APP_URL, nie der vom Request gesehene
// Origin: Next leitet den aus der Bindeadresse des Servers ab und liefert im
// Entwicklungsbetrieb `https://0.0.0.0:3000` — eine Adresse, an die kein
// Browser zurückfindet.
describe('appBasis', () => {
  const vorher = process.env.APP_URL;
  afterEach(() => {
    if (vorher === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = vorher;
  });

  test('APP_URL schlägt den Origin des Requests', () => {
    process.env.APP_URL = 'https://zeit.example.de/';
    expect(appBasis('https://0.0.0.0:3000')).toBe('https://zeit.example.de');
    expect(googleRedirectUri('https://0.0.0.0:3000')).toBe('https://zeit.example.de/api/google/callback');
  });

  test('ohne APP_URL bleibt der Origin die Notlösung', () => {
    delete process.env.APP_URL;
    expect(appBasis('http://localhost:3000')).toBe('http://localhost:3000');
  });
});
