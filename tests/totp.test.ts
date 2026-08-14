import {afterEach, describe, expect, test} from 'bun:test';
import {createDb, getDb, setDbForTesting} from '../lib/db';
import {base32Dekodieren, otpauthParsen, periodeEnde, totpCode} from '../lib/totp';
import {
  aktuelleZugangscodes,
  alleZugangskonten,
  zugangskontoAendern,
  zugangskontoAnlegen,
  zugangskontoLoeschen,
  zugangskontoName,
} from '../lib/zugangscodes';

const ascii = (text: string) => new TextEncoder().encode(text);

// Die Prüfvektoren aus RFC 6238, Anhang B — die Geheimnisse sind dort die
// ASCII-Ziffernfolge in der jeweils zum Verfahren passenden Länge.
const GEHEIM_SHA1 = ascii('12345678901234567890');
const GEHEIM_SHA256 = ascii('12345678901234567890123456789012');
const GEHEIM_SHA512 = ascii('1234567890123456789012345678901234567890123456789012345678901234');

describe('totpCode (RFC 6238, Anhang B)', () => {
  const faelle: Array<[number, string, string, string]> = [
    [59, '94287082', '46119246', '90693936'],
    [1111111109, '07081804', '68084774', '25091201'],
    [1111111111, '14050471', '67062674', '99943326'],
    [1234567890, '89005924', '91819424', '93441116'],
    [2000000000, '69279037', '90698825', '38618901'],
    [20000000000, '65353130', '77737706', '47863826'],
  ];

  for (const [sekunden, sha1, sha256, sha512] of faelle) {
    test(`T=${sekunden}`, () => {
      const beiMs = sekunden * 1000;
      expect(totpCode(GEHEIM_SHA1, {algorithmus: 'SHA1', stellen: 8, periode: 30}, beiMs)).toBe(sha1);
      expect(totpCode(GEHEIM_SHA256, {algorithmus: 'SHA256', stellen: 8, periode: 30}, beiMs)).toBe(sha256);
      expect(totpCode(GEHEIM_SHA512, {algorithmus: 'SHA512', stellen: 8, periode: 30}, beiMs)).toBe(sha512);
    });
  }

  test('6 Stellen sind die letzten sechs Ziffern des 8-Stellen-Werts', () => {
    expect(totpCode(GEHEIM_SHA1, {algorithmus: 'SHA1', stellen: 6, periode: 30}, 59_000)).toBe('287082');
  });

  test('periodeEnde nennt den nächsten Fensterwechsel', () => {
    expect(periodeEnde(30, 59_000)).toBe(60_000);
    expect(periodeEnde(30, 60_000)).toBe(90_000);
  });
});

describe('base32Dekodieren', () => {
  test('liest das RFC-Geheimnis', () => {
    expect(base32Dekodieren('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ')).toEqual(GEHEIM_SHA1);
  });

  test('glättet Gruppen, Kleinschreibung und Füllzeichen', () => {
    expect(base32Dekodieren('gezd gnbv-GY3T QOJQ gezd gnbv gy3t qojq==')).toEqual(GEHEIM_SHA1);
  });

  test('weist fremde Zeichen und Leeres ab', () => {
    // „1" und „0" gehören nicht ins Base32-Alphabet — der typische Tippfehler.
    expect(base32Dekodieren('GEZ1')).toBeNull();
    expect(base32Dekodieren('')).toBeNull();
  });
});

describe('otpauthParsen', () => {
  test('liest einen vollständigen Link samt Verfahren', () => {
    const angaben = otpauthParsen(
      'otpauth://totp/ACME%20Co:info@firma.de?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=ACME%20Co&algorithm=SHA256&digits=8&period=60',
    );
    expect(angaben).toEqual({
      dienst: 'ACME Co',
      konto: 'info@firma.de',
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      verfahren: {algorithmus: 'SHA256', stellen: 8, periode: 60},
    });
  });

  test('fehlende Parameter fallen auf den Standard (SHA1, 6, 30)', () => {
    const angaben = otpauthParsen('otpauth://totp/info@firma.de?secret=GEZDGNBVGY3TQOJQ');
    expect(angaben).toEqual({
      dienst: '',
      konto: 'info@firma.de',
      secret: 'GEZDGNBVGY3TQOJQ',
      verfahren: {algorithmus: 'SHA1', stellen: 6, periode: 30},
    });
  });

  test('weist HOTP, fehlendes Geheimnis und Unlesbares mit deutschem Satz ab', () => {
    expect(typeof otpauthParsen('otpauth://hotp/x?secret=GEZDGNBVGY3TQOJQ&counter=0')).toBe('string');
    expect(typeof otpauthParsen('otpauth://totp/x')).toBe('string');
    expect(typeof otpauthParsen('kein link')).toBe('string');
  });
});

describe('zugangscodes (Datensatz)', () => {
  afterEach(() => setDbForTesting(undefined));

  function frisch() {
    const db = createDb(':memory:');
    db.query(
      "INSERT INTO users (email, password_hash, name, role) VALUES ('admin@firma.de', 'x', 'Admin', 'verwaltung')",
    ).run();
    setDbForTesting(db);
  }

  const VERFAHREN = {algorithmus: 'SHA1', stellen: 6, periode: 30} as const;
  const ALLE = {sichtbarkeit: 'alle'} as const;
  const ADMIN = {id: 1, role: 'verwaltung'} as const;
  const SECRET = 'GEZDGNBVGY3TQOJQ';

  test('anlegen, ablesen, löschen — und das Geheimnis bleibt drinnen', () => {
    frisch();
    const konto = zugangskontoAnlegen(ADMIN, {
      dienst: 'Google',
      konto: 'info@firma.de',
      secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
      verfahren: VERFAHREN,
      ...ALLE,
    });
    expect(typeof konto).not.toBe('string');
    if (typeof konto === 'string') return;
    expect(zugangskontoName(konto)).toBe('Google (info@firma.de)');

    const codes = aktuelleZugangscodes(ADMIN, 59_000);
    expect(codes).toHaveLength(1);
    expect(codes[0]!.code).toBe('287082');
    expect(codes[0]!.gueltigBisMs).toBe(60_000);
    // Die Leseform der Seite trägt das Geheimnis nicht — nie an den Browser.
    expect('secret' in codes[0]!).toBe(false);

    const geloescht = zugangskontoLoeschen(ADMIN, konto.id);
    expect(typeof geloescht).not.toBe('string');
    if (typeof geloescht === 'string') return;
    expect(geloescht.dienst).toBe('Google');
    expect(alleZugangskonten()).toHaveLength(0);
  });

  test('derselbe Dienst mit demselben Konto wird nicht doppelt angelegt', () => {
    frisch();
    const eingabe = {dienst: 'Google', konto: null, secret: SECRET, verfahren: VERFAHREN, ...ALLE};
    expect(typeof zugangskontoAnlegen(ADMIN, eingabe)).not.toBe('string');
    expect(typeof zugangskontoAnlegen(ADMIN, eingabe)).toBe('string');
    // Ein anderes Konto beim selben Dienst ist dagegen ein zweiter Zugang.
    expect(typeof zugangskontoAnlegen(ADMIN, {...eingabe, konto: 'shop@firma.de'})).not.toBe('string');
  });

  test('ein unlesbares Geheimnis wird beim Anlegen abgewiesen', () => {
    frisch();
    expect(
      typeof zugangskontoAnlegen(ADMIN, {dienst: 'X', konto: null, secret: '0011', verfahren: VERFAHREN, ...ALLE}),
    ).toBe('string');
  });

  test('der Leserkreis schneidet zu: alle, Rollen, Personen — Verwaltende sehen jede Zeile', () => {
    frisch();
    const db = getDb();
    db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('v@f.de', 'x', 'Vera Vertrieb', 'vertrieb')").run();
    db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('m@f.de', 'x', 'Mia Mit', 'mitarbeiter')").run();
    const vera = {id: 2, role: 'vertrieb'} as const;
    const mia = {id: 3, role: 'mitarbeiter'} as const;

    zugangskontoAnlegen(ADMIN, {dienst: 'Offen', konto: null, secret: SECRET, verfahren: VERFAHREN, ...ALLE});
    zugangskontoAnlegen(ADMIN, {
      dienst: 'Vertriebstool',
      konto: null,
      secret: SECRET,
      verfahren: VERFAHREN,
      sichtbarkeit: 'rolle',
      rollen: ['vertrieb', 'fulfillment'],
    });
    zugangskontoAnlegen(ADMIN, {
      dienst: 'Nur-Mia',
      konto: null,
      secret: SECRET,
      verfahren: VERFAHREN,
      sichtbarkeit: 'personen',
      personen: [3],
    });

    // Verwaltung sieht jede Zeile, der Kreis steht als Schild daneben.
    const fuerAdmin = aktuelleZugangscodes(ADMIN, 0);
    expect(fuerAdmin.map((c) => c.dienst)).toEqual(['Nur-Mia', 'Offen', 'Vertriebstool']);
    expect(fuerAdmin.find((c) => c.dienst === 'Vertriebstool')!.sichtbar).toBe('Nur Fulfillment, Vertrieb');
    expect(fuerAdmin.find((c) => c.dienst === 'Nur-Mia')!.sichtbar).toBe('Nur Mia Mit');
    expect(fuerAdmin.every((c) => c.darfBearbeiten)).toBe(true);

    // Die Rolle sieht ihren Zugang, die Person ihren — als „Nur für dich" gruppiert unter selbst.
    expect(aktuelleZugangscodes(vera, 0).map((c) => c.dienst)).toEqual(['Offen', 'Vertriebstool']);
    const fuerMia = aktuelleZugangscodes(mia, 0);
    expect(fuerMia.map((c) => c.dienst)).toEqual(['Nur-Mia', 'Offen']);
    const nurMia = fuerMia.find((c) => c.dienst === 'Nur-Mia')!;
    expect(nurMia.sichtbar).toBe('Nur für dich');
    expect(nurMia.gruppe).toBe('selbst');
    // Mia hat den Zugang nicht angelegt — bearbeiten darf sie ihn nicht.
    expect(nurMia.darfBearbeiten).toBe(false);
    expect(nurMia.kreis).toBeNull();

    // Ein Rollenkreis ohne Rolle und ein Personenkreis ohne Person werden abgewiesen.
    expect(typeof zugangskontoAnlegen(ADMIN, {dienst: 'A', konto: null, secret: SECRET, verfahren: VERFAHREN, sichtbarkeit: 'rolle'})).toBe('string');
    expect(typeof zugangskontoAnlegen(ADMIN, {dienst: 'B', konto: null, secret: SECRET, verfahren: VERFAHREN, sichtbarkeit: 'personen', personen: []})).toBe('string');
  });

  test('wer nur erfasst: eigener Kreis, immer selbst darin, kein „alle" und keine Rollen', () => {
    frisch();
    const db = getDb();
    db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('m@f.de', 'x', 'Mia Mit', 'mitarbeiter')").run();
    db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('k@f.de', 'x', 'Kai Kollege', 'fulfillment')").run();
    const mia = {id: 2, role: 'mitarbeiter'} as const;
    const kai = {id: 3, role: 'fulfillment'} as const;

    // Für alle oder für Rollen freigeben kann nur, wer verwaltet.
    expect(typeof zugangskontoAnlegen(mia, {dienst: 'A', konto: null, secret: SECRET, verfahren: VERFAHREN, ...ALLE})).toBe('string');
    expect(typeof zugangskontoAnlegen(mia, {dienst: 'B', konto: null, secret: SECRET, verfahren: VERFAHREN, sichtbarkeit: 'rolle', rollen: ['vertrieb']})).toBe('string');

    // Mit Kai geteilt — und Mia steht automatisch selbst im Kreis.
    const geteilt = zugangskontoAnlegen(mia, {
      dienst: 'Geteilt',
      konto: null,
      secret: SECRET,
      verfahren: VERFAHREN,
      sichtbarkeit: 'personen',
      personen: [3],
    });
    expect(typeof geteilt).not.toBe('string');
    expect(aktuelleZugangscodes(mia, 0).map((c) => c.dienst)).toEqual(['Geteilt']);
    expect(aktuelleZugangscodes(kai, 0).map((c) => c.dienst)).toEqual(['Geteilt']);

    // Bearbeiten und löschen darf die Erstellerin und die Verwaltung — nicht der Mitleser.
    if (typeof geteilt === 'string') return;
    expect(zugangskontoAendern(kai, geteilt.id, {dienst: 'Gekapert', konto: null, secret: '', verfahren: VERFAHREN, sichtbarkeit: 'personen', personen: [3]})).toBe('Keine Berechtigung.');
    expect(typeof zugangskontoLoeschen(kai, geteilt.id)).toBe('string');
    expect(zugangskontoAendern(mia, geteilt.id, {dienst: 'Umbenannt', konto: null, secret: '', verfahren: VERFAHREN, sichtbarkeit: 'personen', personen: []})).toBeNull();
    const danach = aktuelleZugangscodes(mia, 0);
    expect(danach[0]!.dienst).toBe('Umbenannt');
    // Kai wurde aus dem Kreis genommen; Mia blieb automatisch darin.
    expect(danach[0]!.sichtbar).toBe('Nur für dich');
    expect(aktuelleZugangscodes(kai, 0)).toHaveLength(0);
  });

  test('ändern: leerer Schlüssel behält das Geheimnis, ein neuer ersetzt es', () => {
    frisch();
    const konto = zugangskontoAnlegen(ADMIN, {dienst: 'Google', konto: null, secret: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', verfahren: VERFAHREN, ...ALLE});
    if (typeof konto === 'string') throw new Error(konto);

    expect(zugangskontoAendern(ADMIN, konto.id, {dienst: 'Google Ads', konto: null, secret: '', verfahren: VERFAHREN, ...ALLE})).toBeNull();
    expect(aktuelleZugangscodes(ADMIN, 59_000)[0]!.code).toBe('287082');

    expect(zugangskontoAendern(ADMIN, konto.id, {dienst: 'Google Ads', konto: null, secret: SECRET, verfahren: VERFAHREN, ...ALLE})).toBeNull();
    expect(aktuelleZugangscodes(ADMIN, 59_000)[0]!.code).not.toBe('287082');
    // Ein unlesbarer neuer Schlüssel wird abgewiesen, der alte bleibt.
    expect(typeof zugangskontoAendern(ADMIN, konto.id, {dienst: 'Google Ads', konto: null, secret: '0011', verfahren: VERFAHREN, ...ALLE})).toBe('string');
  });
});
