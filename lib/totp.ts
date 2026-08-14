// Einmalcodes nach RFC 6238 (TOTP) — der offene Standard hinter Google
// Authenticator und allen Verwandten. Rein im Sinne der Domäne (keine
// Datenbank), aber server-gebunden: `node:crypto` gehört nicht in den Browser,
// und das Geheimnis erst recht nicht. Der Browser bekommt nur den fertigen
// sechsstelligen Code (lib/zugangscodes.ts) — nie das, woraus er entsteht.

import {createHmac} from 'node:crypto';

export const TOTP_ALGORITHMEN = ['SHA1', 'SHA256', 'SHA512'] as const;
export type TotpAlgorithmus = (typeof TOTP_ALGORITHMEN)[number];

export interface TotpVerfahren {
  algorithmus: TotpAlgorithmus;
  /** Länge des Codes; der Standard erlaubt 6 bis 8, üblich sind 6. */
  stellen: number;
  /** Gültigkeitsdauer eines Codes in Sekunden, üblich 30. */
  periode: number;
}

export const VERFAHREN_STANDARD: TotpVerfahren = {algorithmus: 'SHA1', stellen: 6, periode: 30};

const B32_ZEICHEN = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Base32 (RFC 4648) in Bytes. Dienste schreiben den Schlüssel gern in Gruppen
 * („gezd gnbv gy3t …") und mal klein, mal groß — beides wird hier geglättet,
 * damit ein abgetippter Schlüssel nicht an einem Leerzeichen scheitert.
 * `null`, wenn ein Zeichen nicht ins Alphabet gehört.
 */
export function base32Dekodieren(text: string): Uint8Array | null {
  const bereinigt = text.toUpperCase().replace(/[\s-]/g, '').replace(/=+$/, '');
  if (bereinigt.length === 0) return null;
  let bits = 0;
  let wert = 0;
  const bytes: number[] = [];
  for (const zeichen of bereinigt) {
    const index = B32_ZEICHEN.indexOf(zeichen);
    if (index === -1) return null;
    wert = (wert << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((wert >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

/** HOTP (RFC 4226): HMAC über den Zähler, dynamisch beschnitten, als Ziffern. */
export function hotp(
  geheimnis: Uint8Array,
  zaehler: bigint,
  algorithmus: TotpAlgorithmus,
  stellen: number,
): string {
  const puffer = Buffer.alloc(8);
  puffer.writeBigUInt64BE(zaehler);
  const mac = createHmac(algorithmus.toLowerCase(), Buffer.from(geheimnis)).update(puffer).digest();
  const versatz = mac[mac.length - 1]! & 0x0f;
  const zahl =
    ((mac[versatz]! & 0x7f) << 24) |
    (mac[versatz + 1]! << 16) |
    (mac[versatz + 2]! << 8) |
    mac[versatz + 3]!;
  return String(zahl % 10 ** stellen).padStart(stellen, '0');
}

/** Der Code, der im Zeitfenster um `beiMs` gilt. */
export function totpCode(geheimnis: Uint8Array, verfahren: TotpVerfahren, beiMs: number): string {
  const zaehler = BigInt(Math.floor(beiMs / 1000 / verfahren.periode));
  return hotp(geheimnis, zaehler, verfahren.algorithmus, verfahren.stellen);
}

/** Wann das Zeitfenster um `beiMs` endet (Millisekunden seit Epoche). */
export function periodeEnde(periode: number, beiMs: number): number {
  return (Math.floor(beiMs / 1000 / periode) + 1) * periode * 1000;
}

export interface OtpauthAngaben {
  /** Der `issuer` — der Dienst, der den QR-Code ausgestellt hat. */
  dienst: string;
  /** Der Kontoteil des Labels, meist eine E-Mail-Adresse. */
  konto: string;
  /** Das Geheimnis, Base32 — wird hier geprüft, aber nicht dekodiert gespeichert. */
  secret: string;
  verfahren: TotpVerfahren;
}

/**
 * Ein `otpauth://totp/…`-Link, wie er in jedem Einrichtungs-QR-Code steckt.
 * Gibt bei jedem Mangel einen deutschen Satz zurück statt zu werfen — die
 * Eingabe kommt direkt aus einem Formular, und der Satz ist die Fehlermeldung.
 */
export function otpauthParsen(uri: string): OtpauthAngaben | string {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return 'Der otpauth-Link konnte nicht gelesen werden.';
  }
  if (url.protocol !== 'otpauth:') return 'Das ist kein otpauth-Link.';
  if (url.host !== 'totp') {
    return 'Nur zeitbasierte Codes (totp) werden unterstützt — dieser Link beschreibt etwas anderes.';
  }

  const secret = url.searchParams.get('secret')?.trim() ?? '';
  if (secret === '' || base32Dekodieren(secret) === null) {
    return 'Der Link enthält kein lesbares Geheimnis (secret).';
  }

  // Das Label ist „Aussteller:Konto" oder nur das Konto; der Parameter
  // `issuer` gewinnt gegen den Labelteil, weil er der jüngere, ausdrückliche
  // Weg ist und Google ihn immer setzt.
  const label = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const [labelDienst, labelKonto] = label.includes(':')
    ? [label.slice(0, label.indexOf(':')), label.slice(label.indexOf(':') + 1)]
    : ['', label];
  const dienst = (url.searchParams.get('issuer') ?? labelDienst).trim();
  const konto = labelKonto.trim();

  const algorithmus = (url.searchParams.get('algorithm') ?? 'SHA1').toUpperCase();
  if (!(TOTP_ALGORITHMEN as readonly string[]).includes(algorithmus)) {
    return `Das Verfahren ${algorithmus} wird nicht unterstützt.`;
  }
  const stellen = Number(url.searchParams.get('digits') ?? '6');
  if (!Number.isInteger(stellen) || stellen < 6 || stellen > 8) {
    return 'Die Codelänge muss zwischen 6 und 8 Stellen liegen.';
  }
  const periode = Number(url.searchParams.get('period') ?? '30');
  if (!Number.isInteger(periode) || periode < 15 || periode > 120) {
    return 'Die Gültigkeitsdauer muss zwischen 15 und 120 Sekunden liegen.';
  }

  return {dienst, konto, secret, verfahren: {algorithmus: algorithmus as TotpAlgorithmus, stellen, periode}};
}
