import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createElement, type ComponentType} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {
  codeAusstellen,
  codeEinloesen,
  geheimnisErzeugen,
  oauthClientAnlegen,
  oauthClientById,
  oauthClientSetzeAktiv,
  oauthTokensEntziehen,
  redirectUriGueltig,
  tokenAusstellen,
  tokenPruefen,
  weiterZielGueltig,
} from '../lib/oauth-apps';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});
afterEach(() => setDbForTesting(undefined));

function neuerBenutzer(role: string, email = `${crypto.randomUUID()}@firma.de`): number {
  return db
    .query<{id: number}, [string, string]>(
      `INSERT INTO users (email, password_hash, name, role) VALUES (?, 'x', 'Testperson', ?) RETURNING id`,
    )
    .get(email, role)!.id;
}

function alsActor(id: number, role: string): User {
  return {id, role} as unknown as User;
}

async function neueAnbindung(uris = ['https://app.firma.de/rueckkehr']) {
  const verwalter = alsActor(neuerBenutzer('verwaltung'), 'verwaltung');
  const ergebnis = await oauthClientAnlegen(verwalter, 'Dienstplan', uris);
  if (typeof ergebnis === 'string') throw new Error(ergebnis);
  return {verwalter, ...ergebnis};
}

describe('redirectUriGueltig', () => {
  test('https wird angenommen, Fragment und Relatives nicht', () => {
    expect(redirectUriGueltig('https://app.firma.de/rueckkehr')).toBeNull();
    expect(redirectUriGueltig('/rueckkehr')).not.toBeNull();
    expect(redirectUriGueltig('https://app.firma.de/rueckkehr#dort')).not.toBeNull();
    expect(redirectUriGueltig('ftp://app.firma.de')).not.toBeNull();
  });

  test('http nur auf localhost', () => {
    expect(redirectUriGueltig('http://localhost:4000/callback')).toBeNull();
    expect(redirectUriGueltig('http://127.0.0.1/callback')).toBeNull();
    expect(redirectUriGueltig('http://app.firma.de/callback')).not.toBeNull();
  });
});

describe('weiterZielGueltig', () => {
  test('genau der eigene Autorisierungs-Endpunkt, sonst nichts', () => {
    expect(weiterZielGueltig('/api/oauth/authorize?client_id=x')).toBe(true);
    expect(weiterZielGueltig('/mitarbeiter')).toBe(false);
    expect(weiterZielGueltig('https://boese.de/api/oauth/authorize?x')).toBe(false);
    expect(weiterZielGueltig(undefined)).toBe(false);
  });
});

describe('Anbindungen', () => {
  test('Anlegen: Geheimnis prüft gegen den Hash und steht nirgends im Klartext', async () => {
    const {client, secret} = await neueAnbindung();
    const zeile = db
      .query<{secret_hash: string; client_id: string; redirect_uris: string}, [number]>(
        'SELECT secret_hash, client_id, redirect_uris FROM oauth_clients WHERE id = ?',
      )
      .get(client.id)!;
    expect(await Bun.password.verify(secret, zeile.secret_hash)).toBe(true);
    expect(zeile.secret_hash).not.toContain(secret);
    expect(zeile.redirect_uris).toBe('https://app.firma.de/rueckkehr');
    expect(client.client_id).toBe(zeile.client_id);
  });

  test('ohne apps.verwalten kein Anlegen', async () => {
    const person = alsActor(neuerBenutzer('mitarbeiter'), 'mitarbeiter');
    expect(await oauthClientAnlegen(person, 'Dienstplan', ['https://app.firma.de/r'])).toBe('Keine Berechtigung.');
  });

  test('gesperrte Anbindung ist für die Endpunkte unbekannt und verliert Tokens', async () => {
    const {verwalter, client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    tokenAusstellen(client, nutzerId);
    expect(oauthClientSetzeAktiv(verwalter, client.id, false)).toBeNull();
    expect(oauthClientById(client.client_id)).toBeNull();
    expect(db.query<{n: number}, [number]>('SELECT COUNT(*) n FROM oauth_tokens WHERE client_id = ?').get(client.id)!.n).toBe(0);
  });
});

describe('Code-Rundlauf', () => {
  test('ausstellen und einlösen liefert die Person zurück', async () => {
    const {client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    const code = codeAusstellen(client, nutzerId, client.redirect_uris[0]!);
    expect(codeEinloesen(client, code, client.redirect_uris[0]!)).toEqual({userId: nutzerId});
  });

  test('falsche redirect_uri und fremder Client scheitern', async () => {
    const {client} = await neueAnbindung();
    const fremd = await neueAnbindung(['https://andere.firma.de/r']);
    const nutzerId = neuerBenutzer('mitarbeiter');
    const code = codeAusstellen(client, nutzerId, client.redirect_uris[0]!);
    expect(codeEinloesen(client, code, 'https://app.firma.de/anders')).toBe('invalid_grant');
    expect(codeEinloesen(fremd.client, code, client.redirect_uris[0]!)).toBe('invalid_grant');
  });

  test('genau eine Einlösung — die zweite widerruft die ausgestellten Tokens', async () => {
    const {client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    const code = codeAusstellen(client, nutzerId, client.redirect_uris[0]!);
    const erste = codeEinloesen(client, code, client.redirect_uris[0]!);
    expect(erste).toEqual({userId: nutzerId});
    const {token} = tokenAusstellen(client, nutzerId);
    expect(tokenPruefen(token)).not.toBeNull();
    expect(codeEinloesen(client, code, client.redirect_uris[0]!)).toBe('invalid_grant');
    expect(tokenPruefen(token)).toBeNull();
  });

  test('abgelaufener Code löst nicht mehr ein', async () => {
    const {client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    const code = codeAusstellen(client, nutzerId, client.redirect_uris[0]!);
    db.query('UPDATE oauth_codes SET expires_at = ?').run(Date.now() - 1);
    expect(codeEinloesen(client, code, client.redirect_uris[0]!)).toBe('invalid_grant');
  });
});

describe('tokenPruefen', () => {
  test('liefert wirksame Rechte samt Zusatzrechten', async () => {
    const {client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    db.query('INSERT INTO benutzer_rechte (user_id, recht) VALUES (?, ?)').run(nutzerId, 'berichte.sehen');
    const {token} = tokenAusstellen(client, nutzerId);
    const ergebnis = tokenPruefen(token);
    expect(ergebnis).not.toBeNull();
    expect(ergebnis!.user.rechte).toContain('zeit.erfassen');
    expect(ergebnis!.user.rechte).toContain('berichte.sehen');
    expect(ergebnis!.user.rechte).not.toContain('apps.verwalten');
    expect(ergebnis!.clientId).toBe(client.id);
  });

  test('deaktiviertes Konto und abgelaufenes Token sind unbekannt', async () => {
    const {client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    const {token} = tokenAusstellen(client, nutzerId);
    db.query('UPDATE users SET active = 0 WHERE id = ?').run(nutzerId);
    expect(tokenPruefen(token)).toBeNull();
    db.query('UPDATE users SET active = 1 WHERE id = ?').run(nutzerId);
    db.query('UPDATE oauth_tokens SET expires_at = ?').run(Date.now() - 1);
    expect(tokenPruefen(token)).toBeNull();
  });

  test('oauthTokensEntziehen räumt Codes und Tokens einer Person ab', async () => {
    const {client} = await neueAnbindung();
    const nutzerId = neuerBenutzer('mitarbeiter');
    codeAusstellen(client, nutzerId, client.redirect_uris[0]!);
    const {token} = tokenAusstellen(client, nutzerId);
    oauthTokensEntziehen(nutzerId);
    expect(tokenPruefen(token)).toBeNull();
    expect(db.query<{n: number}, [number]>('SELECT COUNT(*) n FROM oauth_codes WHERE user_id = ?').get(nutzerId)!.n).toBe(0);
  });
});

describe('geheimnisErzeugen', () => {
  test('lang, ohne Bindestriche, nie doppelt', () => {
    const a = geheimnisErzeugen();
    expect(a.length).toBeGreaterThanOrEqual(64);
    expect(a).not.toContain('-');
    expect(geheimnisErzeugen()).not.toBe(a);
  });
});

test('die Freigabe sendet als normaler POST statt als Server Action', async () => {
  const seite = (await import('../app/freigeben/page')) as Record<string, unknown>;
  const Formulare = seite.FreigabeFormulare;
  expect(typeof Formulare).toBe('function');
  if (typeof Formulare !== 'function') return;

  const html = renderToStaticMarkup(
    createElement(Formulare as ComponentType<{clientId: string; redirectUri: string; state: string}>, {
      clientId: 'haus-app',
      redirectUri: 'https://app.firma.de/rueckkehr',
      state: 'csrf-wert',
    }),
  );
  expect(html.match(/<form action="\/api\/oauth\/authorize" method="post">/g)).toHaveLength(2);
  expect(html).not.toContain('$ACTION_');
});
