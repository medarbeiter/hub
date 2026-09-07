// Die Browser-Erweiterung als Paket, das Chrome selbst aktuell hält.
//
// Ein entpackt geladener Ordner wird nie aktualisiert, und einen fremden CRX
// nimmt Chrome nur über eine Richtlinie (ExtensionInstallForcelist) an — und
// die nur aus einer Quelle, der es traut: **auf einem Rechner ohne MDM oder
// Domäne streicht Chrome jeden Forcelist-Eintrag, dessen Update-URL nicht
// der Web Store ist** (policy_loader_mac.mm: ShouldFilterSensitivePolicies,
// policy_loader_common.cc: FilterSensitiveExtensionsInstallForcelist). Ein
// manuell installiertes Konfigurationsprofil hilft also nicht. Dieses Paket
// ist deshalb für die Wege, die Chrome traut: die Google Admin-Konsole
// (Cloud-Richtlinie) und MDM-verwaltete Geräte. Für alle anderen Rechner ist
// der Web Store (unlistet) der Weg — `ERWEITERUNG_STORE_URL` auf /erweiterung.
//
// Signiert wird mit einem RSA-Schlüssel aus `ERWEITERUNG_KEY` (PKCS#8 als
// Base64, erzeugt mit `bun scripts/erweiterung-schluessel.ts`). Aus dem
// öffentlichen Teil ergibt sich die Kennung der Erweiterung — darum muss der
// Schlüssel über Deployments hinweg derselbe bleiben: ein neuer Schlüssel ist
// eine neue Erweiterung, nicht ein Update. Ohne Schlüssel gibt es kein Paket,
// nur den Hinweis, ihn zu setzen.
//
// CRX3 (components/crx_file/crx3.proto): "Cr24" · Version 3 · Kopflänge ·
// Kopf als Protobuf (öffentlicher Schlüssel + Signatur, signed_header_data
// mit der 16-Byte-Kennung) · das ZIP. Signiert wird
// "CRX3 SignedData\0" · len(signed_header_data) · signed_header_data · ZIP
// mit RSA-PKCS1-v1.5/SHA-256. Das Protobuf ist so klein, dass es hier von
// Hand steht — dieselbe Haltung wie beim ZIP (lib/zip.ts) und beim Varint-
// Leser der Authenticator-Migration.

import {createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, type KeyObject} from 'node:crypto';
import {existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {zipErstellen, type ZipEintrag} from './zip';

export const ERWEITERUNG_ORDNER = 'extension';
export const ERWEITERUNG_DATEI = 'medarbeiter-zugangscodes.crx';
/** Wo der Schlüssel liegt, wenn ihn niemand in die Umgebung gelegt hat: im Datenvolume, neben der Datenbank. */
export const SCHLUESSEL_DATEI = 'data/erweiterung-schluessel.txt';

/** Nie ins Paket: Leseanleitung und Betriebssystem-Krümel. */
const AUSGESCHLOSSEN = new Set(['README.md', '.DS_Store']);

function schluesselLesen(roh: string): KeyObject | null {
  try {
    return createPrivateKey({key: Buffer.from(roh.trim(), 'base64'), format: 'der', type: 'pkcs8'});
  } catch {
    return null;
  }
}

/** Ein neuer Schlüssel als PKCS#8, Base64 — die Form, die ERWEITERUNG_KEY und die Datei tragen. */
export function schluesselErzeugen(): string {
  const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
  return (privateKey.export({format: 'der', type: 'pkcs8'}) as Buffer).toString('base64');
}

/**
 * Der Signierschlüssel: aus `ERWEITERUNG_KEY`, sonst aus der Datei im
 * Datenvolume — und die wird beim ersten Mal angelegt. Nicht im Dockerfile:
 * ein Schlüssel aus dem Build wäre bei jedem Rebuild ein anderer, und ein
 * anderer Schlüssel ist eine andere Kennung, also eine fremde Erweiterung für
 * jeden Rechner, der die alte trägt. Das Volume überlebt den Rebuild
 * (README: Dokploy braucht es ohnehin für die Datenbank); wer die Datei
 * sichert, sichert die Kennung. `null` nur, wenn weder Umgebung noch Datei
 * lesbar sind und die Datei nicht geschrieben werden kann.
 */
export function erweiterungSchluessel(): KeyObject | null {
  const ausUmgebung = process.env.ERWEITERUNG_KEY?.trim();
  if (ausUmgebung) return schluesselLesen(ausUmgebung);
  try {
    if (existsSync(SCHLUESSEL_DATEI)) return schluesselLesen(readFileSync(SCHLUESSEL_DATEI, 'utf8'));
    mkdirSync('data', {recursive: true});
    const neu = schluesselErzeugen();
    writeFileSync(SCHLUESSEL_DATEI, `${neu}\n`, {mode: 0o600, flag: 'wx'});
    return schluesselLesen(neu);
  } catch {
    // Ein zweiter Prozess war schneller (flag wx) — dann seine Datei lesen.
    try {
      return schluesselLesen(readFileSync(SCHLUESSEL_DATEI, 'utf8'));
    } catch {
      return null;
    }
  }
}

/** Der öffentliche Schlüssel als SPKI-DER — das, was im CRX-Kopf und im Manifest (`key`) steht. */
export function oeffentlicherSchluessel(privat: KeyObject): Buffer {
  return createPublicKey(privat).export({format: 'der', type: 'spki'}) as Buffer;
}

/** Die 16 Bytes, aus denen Chrome die Kennung bildet: der Anfang von SHA-256 über den SPKI-DER. */
export function crxKennung(spki: Uint8Array): Buffer {
  return createHash('sha256').update(spki).digest().subarray(0, 16);
}

/** Die Kennung, wie chrome://extensions sie zeigt: die 32 Hex-Zeichen, auf a–p abgebildet. */
export function erweiterungId(spki: Uint8Array): string {
  return [...crxKennung(spki).toString('hex')].map((z) => String.fromCharCode(97 + parseInt(z, 16))).join('');
}

// ── Protobuf, nur was CRX3 braucht: Felder mit Länge (wire type 2) ─────────

function varint(n: number): number[] {
  const bytes: number[] = [];
  while (n >= 0x80) {
    bytes.push((n & 0x7f) | 0x80);
    n >>>= 7;
  }
  bytes.push(n);
  return bytes;
}

function feld(nummer: number, daten: Uint8Array): Uint8Array {
  return Buffer.concat([Buffer.from(varint((nummer << 3) | 2)), Buffer.from(varint(daten.length)), daten]);
}

function uint32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n);
  return b;
}

/** Packt ein ZIP in einen CRX3 — rein, damit es ohne Dateisystem prüfbar ist. */
export function crxPacken(zip: Uint8Array, privat: KeyObject): Buffer {
  const spki = oeffentlicherSchluessel(privat);
  const signedHeaderData = feld(1, crxKennung(spki)); // SignedData { crx_id = 1 }
  const zuSignieren = Buffer.concat([
    Buffer.from('CRX3 SignedData\0', 'latin1'),
    uint32le(signedHeaderData.length),
    signedHeaderData,
    zip,
  ]);
  const signatur = sign('sha256', zuSignieren, privat);
  // CrxFileHeader { sha256_with_rsa = 2 (AsymmetricKeyProof {public_key = 1, signature = 2}), signed_header_data = 10000 }
  const kopf = Buffer.concat([
    feld(2, Buffer.concat([feld(1, spki), feld(2, signatur)])),
    feld(10000, signedHeaderData),
  ]);
  return Buffer.concat([Buffer.from('Cr24', 'latin1'), uint32le(3), uint32le(kopf.length), kopf, zip]);
}

// ── Das Paket aus dem Quellordner ───────────────────────────────────────────

function dateienSammeln(wurzel: string, relativ = ''): ZipEintrag[] {
  const eintraege: ZipEintrag[] = [];
  for (const name of readdirSync(join(wurzel, relativ)).sort()) {
    if (AUSGESCHLOSSEN.has(name)) continue;
    const pfad = relativ ? `${relativ}/${name}` : name;
    if (statSync(join(wurzel, pfad)).isDirectory()) eintraege.push(...dateienSammeln(wurzel, pfad));
    else eintraege.push({name: pfad, daten: new Uint8Array(readFileSync(join(wurzel, pfad)))});
  }
  return eintraege;
}

export function erweiterungVersion(wurzel: string = ERWEITERUNG_ORDNER): string {
  return String(JSON.parse(readFileSync(join(wurzel, 'manifest.json'), 'utf8')).version);
}

/**
 * Die Kennung, die ein entpackt geladener Ordner trägt: aus dem `key` im
 * eingecheckten Manifest (der öffentliche Teil des Prod-Schlüssels — kein
 * Geheimnis, und so sind Entwicklungskopie, Hub-Paket und Store-Upload
 * dieselbe Erweiterung). `null`, wenn das Manifest keinen trägt.
 */
export function erweiterungIdAusManifest(wurzel: string = ERWEITERUNG_ORDNER): string | null {
  const key = JSON.parse(readFileSync(join(wurzel, 'manifest.json'), 'utf8')).key;
  return typeof key === 'string' && key !== '' ? erweiterungId(Buffer.from(key, 'base64')) : null;
}

/**
 * Die Quelldateien als ZIP, das Manifest um `key` (damit die Kennung auch
 * beim entpackten Laden dieselbe ist) und `update_url` ergänzt.
 */
export function erweiterungZip(spki: Uint8Array, updateUrl: string, wurzel: string = ERWEITERUNG_ORDNER): Uint8Array {
  const eintraege = dateienSammeln(wurzel).map((e) => {
    if (e.name !== 'manifest.json') return e;
    const manifest = JSON.parse(Buffer.from(e.daten).toString('utf8'));
    manifest.key = Buffer.from(spki).toString('base64');
    manifest.update_url = updateUrl;
    // Die Seite /erweiterung fragt die Erweiterung, ob sie da ist — das geht
    // nur von einer Herkunft, die das Manifest nennt. Die Vorgaben bleiben
    // (Prod und localhost fürs entpackte Laden), die Hausadresse kommt dazu.
    const herkunft = `${new URL(updateUrl).origin}/*`;
    const matches: string[] = manifest.externally_connectable?.matches ?? [];
    if (!matches.includes(herkunft)) matches.push(herkunft);
    manifest.externally_connectable = {matches};
    return {name: e.name, daten: new TextEncoder().encode(JSON.stringify(manifest, null, 2))};
  });
  return zipErstellen(eintraege);
}

export interface ErweiterungPaket {
  id: string;
  version: string;
  crx: Buffer;
}

let zwischenspeicher: (ErweiterungPaket & {schluessel: string; updateUrl: string}) | null = null;

/**
 * Das fertige Paket — einmal je Version und Schlüssel gebaut, dann aus dem
 * Speicher: Chrome fragt alle paar Stunden von jedem Rechner im Haus, und das
 * Signieren soll nicht jedes Mal den Ordner lesen. `null` ohne Schlüssel.
 */
export function erweiterungPaket(basis: string): ErweiterungPaket | null {
  const privat = erweiterungSchluessel();
  if (!privat) return null;
  const spki = oeffentlicherSchluessel(privat);
  const schluessel = crxKennung(spki).toString('hex');
  const updateUrl = `${basis}/api/erweiterung/update.xml`;
  const version = erweiterungVersion();
  if (zwischenspeicher && zwischenspeicher.schluessel === schluessel && zwischenspeicher.version === version && zwischenspeicher.updateUrl === updateUrl) {
    return zwischenspeicher;
  }
  const crx = crxPacken(erweiterungZip(spki, updateUrl), privat);
  zwischenspeicher = {id: erweiterungId(spki), version, crx, schluessel, updateUrl};
  return zwischenspeicher;
}

/** Das Omaha-Manifest, das Chrome unter `update_url` erwartet. */
export function updateXml(paket: ErweiterungPaket, basis: string): string {
  return `<?xml version='1.0' encoding='UTF-8'?>
<gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'>
  <app appid='${paket.id}'>
    <updatecheck codebase='${basis}/api/erweiterung/${ERWEITERUNG_DATEI}' version='${paket.version}' />
  </app>
</gupdate>
`;
}

/** Der Wert der Richtlinie ExtensionInstallForcelist: „<Kennung>;<Update-URL>". */
export function richtlinienWert(paket: ErweiterungPaket, basis: string): string {
  return `${paket.id};${basis}/api/erweiterung/update.xml`;
}
