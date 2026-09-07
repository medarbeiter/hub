import {afterEach, describe, expect, test} from 'bun:test';
import {createDb, setDbForTesting} from '../lib/db';
import {ALLE_RECHTE, type Recht} from '../lib/rechte';
import {basisDomain, hostNormieren, seitenParsen, treffer} from '../lib/zugangscode-treffer';
import {codesFuerSeite, seiteMerken, zugangskontoAnlegen, zugangskontoById} from '../lib/zugangscodes';

describe('hostNormieren / basisDomain / seitenParsen', () => {
  test('liest Adresse, Host, Port, Pfad und www weg', () => {
    expect(hostNormieren('https://Login.Example.com:8443/pfad?x=1')).toBe('login.example.com');
    expect(hostNormieren('www.github.com')).toBe('github.com');
    expect(hostNormieren('  ')).toBeNull();
    expect(hostNormieren('nicht ein host')).toBeNull();
  });

  test('basisDomain kennt zweistufige Endungen', () => {
    expect(basisDomain('accounts.google.com')).toBe('google.com');
    expect(basisDomain('login.amazon.co.uk')).toBe('amazon.co.uk');
    expect(basisDomain('github.com')).toBe('github.com');
  });

  test('seitenParsen entdoppelt und verwirft Unlesbares', () => {
    expect(seitenParsen('github.com, https://github.com/login  foo bar.de')).toEqual(['github.com', 'foo', 'bar.de']);
  });
});

describe('treffer', () => {
  const z = (dienst: string, konto: string | null = null, seiten = '') => ({dienst, konto, seiten});

  test('gemerkte Seite: genau (3), gleiche Domäne (2)', () => {
    expect(treffer(z('IONOS', null, 'login.ionos.de'), 'login.ionos.de')).toBe(3);
    expect(treffer(z('IONOS', null, 'ionos.de'), 'login.ionos.de')).toBe(2);
    expect(treffer(z('IONOS', null, 'my.ionos.de'), 'login.ionos.de')).toBe(2);
  });

  test('Dienstname klingt nach der Domäne (1), sonst nichts (0)', () => {
    expect(treffer(z('GitHub Felix'), 'github.com')).toBe(1);
    expect(treffer(z('Facebook Basti'), 'www.facebook.com')).toBe(1);
    expect(treffer(z('Microsoft 365'), 'login.microsoftonline.com')).toBe(1);
    expect(treffer(z('Strato'), 'github.com')).toBe(0);
    expect(treffer(z('B.I.S. GmbH'), 'bis.de')).toBe(1);
  });

  test('Konto-Adresse auf der eigenen Domäne (1); ohne Host nichts', () => {
    expect(treffer(z('Alfahosting', 'agentur@secure.alfahosting.de'), 'alfahosting.de')).toBe(1);
    expect(treffer(z('Alfahosting'), null)).toBe(0);
  });
});

describe('codesFuerSeite / seiteMerken (Datensatz)', () => {
  afterEach(() => setDbForTesting(undefined));
  const ADMIN = {id: 1, role: 'verwaltung', rechte: [...ALLE_RECHTE]};
  const BASIS: Recht[] = ['zugangscodes.sehen', 'zugangscodes.erfassen'];
  const VERFAHREN = {algorithmus: 'SHA1', stellen: 6, periode: 30} as const;

  function frisch() {
    const db = createDb(':memory:');
    db.query(
      "INSERT INTO users (email, password_hash, name, role) VALUES ('admin@firma.de', 'x', 'Admin', 'verwaltung'), ('m@firma.de', 'x', 'Mia', 'mitarbeiter')",
    ).run();
    setDbForTesting(db);
  }

  test('sortiert nach Treffer, merkt eine Seite nur für Sichtbare, nie doppelt', () => {
    frisch();
    const github = zugangskontoAnlegen(ADMIN, {
      dienst: 'GitHub Felix',
      konto: null,
      secret: 'GEZDGNBVGY3TQOJQ',
      verfahren: VERFAHREN,
      sichtbarkeit: 'alle',
    });
    const strato = zugangskontoAnlegen(ADMIN, {
      dienst: 'Strato',
      konto: null,
      secret: 'GEZDGNBVGY3TQOJQ',
      verfahren: VERFAHREN,
      sichtbarkeit: 'personen',
      personen: [1],
    });
    if (typeof github === 'string' || typeof strato === 'string') throw new Error('anlegen');

    let liste = codesFuerSeite(ADMIN, 'github.com');
    expect(liste.map((c) => [c.dienst, c.treffer])).toEqual([
      ['GitHub Felix', 1],
      ['Strato', 0],
    ]);
    expect(liste[0]!.code).toMatch(/^\d{6}$/);
    expect(JSON.stringify(liste)).not.toContain('GEZDGNBVGY3TQOJQ');

    // Ein Mitarbeiter sieht Strato nicht und darf ihm auch keine Seite geben.
    const mia = {id: 2, role: 'mitarbeiter', rechte: BASIS};
    expect(codesFuerSeite(mia, 'strato.de').map((c) => c.dienst)).toEqual(['GitHub Felix']);
    expect(typeof seiteMerken(mia, strato.id, 'https://www.strato.de/apps')).toBe('string');

    expect(seiteMerken(ADMIN, strato.id, 'https://www.strato.de/apps')).toBe(null);
    expect(seiteMerken(ADMIN, strato.id, 'strato.de')).toBe(null);
    expect(zugangskontoById(strato.id)?.seiten).toBe('strato.de');
    liste = codesFuerSeite(ADMIN, 'login.strato.de');
    expect(liste.map((c) => [c.dienst, c.treffer])).toEqual([
      ['Strato', 2],
      ['GitHub Felix', 0],
    ]);
    expect(typeof seiteMerken(ADMIN, strato.id, '???')).toBe('string');
  });
});
