import {describe, expect, test} from 'bun:test';
import {base32Kodieren, migrationParsen, migrationSammeln} from '../lib/otp-migration';
import {base32Dekodieren} from '../lib/totp';

// --- Ein Payload von Hand, mit demselben Drahtformat, das Google schreibt ---

const varint = (n: number): number[] => {
  let v = BigInt(n);
  const aus: number[] = [];
  do {
    let byte = Number(v & 0x7fn);
    v >>= 7n;
    if (v > 0n) byte |= 0x80;
    aus.push(byte);
  } while (v > 0n);
  return aus;
};
const feldBytes = (nr: number, wert: Uint8Array | number[]): number[] => [
  ...varint((nr << 3) | 2),
  ...varint(wert.length),
  ...wert,
];
const feldVarint = (nr: number, wert: number): number[] => [...varint(nr << 3), ...varint(wert)];

interface Eintrag {
  secret: Uint8Array;
  name?: string;
  issuer?: string;
  algorithm?: number;
  digits?: number;
  type?: number;
}
const ascii = (text: string) => new TextEncoder().encode(text);
const eintrag = (e: Eintrag): number[] => [
  ...feldBytes(1, e.secret),
  ...(e.name ? feldBytes(2, ascii(e.name)) : []),
  ...(e.issuer ? feldBytes(3, ascii(e.issuer)) : []),
  ...(e.algorithm !== undefined ? feldVarint(4, e.algorithm) : []),
  ...(e.digits !== undefined ? feldVarint(5, e.digits) : []),
  ...(e.type !== undefined ? feldVarint(6, e.type) : []),
];
const payloadB64 = (eintraege: Eintrag[]): string => {
  const bytes = eintraege.flatMap((e) => feldBytes(1, Uint8Array.from(eintrag(e))));
  return btoa(String.fromCharCode(...bytes));
};
const payloadUri = (eintraege: Eintrag[]): string =>
  `otpauth-migration://offline?data=${encodeURIComponent(payloadB64(eintraege))}`;

const GEHEIM = ascii('12345678901234567890');

describe('migrationParsen', () => {
  test('liest den bekannten Beispiel-Export (Example / alice@google.com)', () => {
    // Der in der Formatbeschreibung verbreitete Prüfvektor: ein TOTP-Konto,
    // secret „Hello!\xde\xad\xbe\xef" → JBSWY3DPEHPK3PXP.
    const ergebnis = migrationParsen(
      'otpauth-migration://offline?data=CjEKCkhlbGxvId6tvu8SGEV4YW1wbGU6YWxpY2VAZ29vZ2xlLmNvbRoHRXhhbXBsZSABKAEwAg%3D%3D',
    );
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.uebersprungen).toBe(0);
    expect(ergebnis.konten).toEqual([
      {
        dienst: 'Example',
        konto: 'alice@google.com',
        secret: 'JBSWY3DPEHPK3PXP',
        verfahren: {algorithmus: 'SHA1', stellen: 6, periode: 30},
      },
    ]);
  });

  test('mehrere Konten, Verfahren und Stellen werden übernommen', () => {
    const uri = payloadUri([
      {secret: GEHEIM, name: 'Acme:kasse@firma.de', algorithm: 2, digits: 2, type: 2},
      {secret: GEHEIM, name: 'buero@firma.de', issuer: 'Post', algorithm: 1, digits: 1, type: 2},
    ]);
    const ergebnis = migrationParsen(uri);
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.konten).toHaveLength(2);
    expect(ergebnis.konten[0]).toMatchObject({
      dienst: 'Acme',
      konto: 'kasse@firma.de',
      verfahren: {algorithmus: 'SHA256', stellen: 8, periode: 30},
    });
    expect(ergebnis.konten[1]).toMatchObject({dienst: 'Post', konto: 'buero@firma.de'});
    // Das Geheimnis übersteht den Weg Bytes → Base32 → Bytes unverändert.
    expect(base32Dekodieren(ergebnis.konten[0]!.secret)).toEqual(GEHEIM);
  });

  test('ohne Aussteller wird der Name zum Dienst', () => {
    const ergebnis = migrationParsen(payloadUri([{secret: GEHEIM, name: 'nur-ein-konto@firma.de', type: 2}]));
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.konten[0]).toMatchObject({dienst: 'nur-ein-konto@firma.de', konto: ''});
  });

  test('zählerbasierte (HOTP) Einträge werden gezählt, nicht verweigert', () => {
    const uri = payloadUri([
      {secret: GEHEIM, name: 'Alt:hotp@firma.de', type: 1},
      {secret: GEHEIM, name: 'Gut:totp@firma.de', type: 2},
    ]);
    const ergebnis = migrationParsen(uri);
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.uebersprungen).toBe(1);
    expect(ergebnis.konten).toHaveLength(1);
    expect(ergebnis.konten[0]!.dienst).toBe('Gut');
  });

  test('ein namenloser Eintrag wird „Unbenannt" statt verworfen', () => {
    const ergebnis = migrationParsen(payloadUri([{secret: GEHEIM, type: 2}]));
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.uebersprungen).toBe(0);
    expect(ergebnis.konten[0]).toMatchObject({dienst: 'Unbenannt', konto: ''});
  });

  test('ein unlesbarer Einzeleintrag reißt den Export nicht mit', () => {
    // Feld 1 mit kaputtem Inhalt (ein Fortsetzungsbit ohne Fortsetzung) neben
    // einem gesunden Eintrag: der gesunde kommt durch, der kaputte wird gezählt.
    const bytes = [
      ...feldBytes(1, [0xff]),
      ...feldBytes(1, Uint8Array.from(eintrag({secret: GEHEIM, name: 'Gut:totp@firma.de', type: 2}))),
    ];
    const ergebnis = migrationParsen(`otpauth-migration://offline?data=${encodeURIComponent(btoa(String.fromCharCode(...bytes)))}`);
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.uebersprungen).toBe(1);
    expect(ergebnis.konten).toHaveLength(1);
    expect(ergebnis.konten[0]!.dienst).toBe('Gut');
  });

  test('ein „+" im Base64 überlebt die URL-Lesung (URLSearchParams liest es als Leerzeichen)', () => {
    // Ein Payload suchen, dessen Base64 tatsächlich ein „+" enthält, und den
    // Link ungeschützt (ohne Prozent-Kodierung) übergeben — so kommt er aus
    // manch einer Zwischenablage.
    // Zwei benachbarte variable Bytes überdecken bei jeder Base64-Phase ein
    // volles 6-Bit-Fenster — ein einzelnes Byte täte das je nach Lage nicht.
    let roh: string | null = null;
    for (let i = 0; i < 65536 && roh === null; i++) {
      const b64 = payloadB64([{secret: Uint8Array.from([i >> 8, i & 0xff, ...GEHEIM]), name: 'Plus:test@firma.de', type: 2}]);
      if (b64.includes('+')) roh = b64;
    }
    if (roh === null) throw new Error('Kein Payload mit „+" gefunden');
    const ergebnis = migrationParsen(`otpauth-migration://offline?data=${roh}`);
    if (typeof ergebnis === 'string') throw new Error(ergebnis);
    expect(ergebnis.konten).toHaveLength(1);
  });

  test('fremde Links und Unlesbares geben einen deutschen Satz zurück', () => {
    expect(typeof migrationParsen('otpauth://totp/x?secret=GEZDGNBV')).toBe('string');
    expect(typeof migrationParsen('https://example.com')).toBe('string');
    expect(typeof migrationParsen('otpauth-migration://offline?data=%%%')).toBe('string');
    expect(typeof migrationParsen('otpauth-migration://offline?data=nicht-base64!')).toBe('string');
    expect(typeof migrationParsen('kein link')).toBe('string');
  });
});

describe('migrationSammeln', () => {
  test('faltet Doppelte über Codes hinweg und sammelt Fehler untauglicher Links', () => {
    const a = payloadUri([
      {secret: GEHEIM, name: 'Acme:kasse@firma.de', type: 2},
      {secret: GEHEIM, name: 'Post:buero@firma.de', type: 2},
    ]);
    const b = payloadUri([
      {secret: GEHEIM, name: 'Post:buero@firma.de', type: 2}, // schon in a
      {secret: GEHEIM, name: 'Bank:konto@firma.de', type: 2},
    ]);
    const sammlung = migrationSammeln([a, b, a, 'https://example.com']);
    expect(sammlung.konten.map((k) => k.dienst)).toEqual(['Acme', 'Post', 'Bank']);
    expect(sammlung.fehler).toHaveLength(1);
  });

  test('liest einzelne otpauth-Links neben Übertragungscodes — kein Code bleibt liegen', () => {
    const secret = base32Kodieren(GEHEIM);
    const sammlung = migrationSammeln([
      payloadUri([{secret: GEHEIM, name: 'Acme:kasse@firma.de', type: 2}]),
      // Dasselbe Konto noch einmal als Einzellink — wird gefaltet, nicht verdoppelt.
      `otpauth://totp/Acme:kasse@firma.de?secret=${secret}&issuer=Acme`,
      `otpauth://totp/Post:buero@firma.de?secret=${secret}&issuer=Post`,
      // Ohne Aussteller wird das Konto zum Dienst, ganz ohne Namen „Unbenannt".
      `otpauth://totp/nur-konto@firma.de?secret=${secret}`,
      `otpauth://totp/?secret=${secret}`,
      // Ein untauglicher Link wird benannt, die übrigen zählen trotzdem.
      'otpauth://totp/Kaputt:x@firma.de',
    ]);
    expect(sammlung.konten.map((k) => k.dienst)).toEqual(['Acme', 'Post', 'nur-konto@firma.de', 'Unbenannt']);
    expect(sammlung.konten[2]).toMatchObject({konto: '', secret});
    expect(sammlung.fehler).toHaveLength(1);
  });
});

describe('base32Kodieren', () => {
  test('ist das Gegenstück zu base32Dekodieren, auch bei krummen Längen', () => {
    for (const laenge of [1, 2, 3, 4, 5, 20, 32]) {
      const bytes = Uint8Array.from({length: laenge}, (_, i) => (i * 37 + laenge) % 256);
      expect(base32Dekodieren(base32Kodieren(bytes))).toEqual(bytes);
    }
  });
});
