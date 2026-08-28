// Einmalcodes nach RFC 6238 (TOTP) — der offene Standard hinter Google
// Authenticator und allen Verwandten. Rein im Sinne der Domäne (keine
// Datenbank), aber server-gebunden: `node:crypto` gehört nicht in den Browser,
// und das Geheimnis erst recht nicht. Der Browser bekommt nur den fertigen
// sechsstelligen Code (lib/zugangscodes.ts) — nie das, woraus er entsteht.
//
// Der reine Teil — otpauth-Link, Base32, das Verfahren — lebt in
// lib/otpauth.ts (der Import-Dialog liest gescannte Links selbst) und wird
// hier wieder ausgeführt, bestehende Aufrufer bleiben unverändert.

import {createHmac} from 'node:crypto';
import type {TotpAlgorithmus, TotpVerfahren} from './otpauth';

export * from './otpauth';

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
