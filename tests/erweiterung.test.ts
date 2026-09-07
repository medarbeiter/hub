import {describe, expect, test} from 'bun:test';
import {createHash, generateKeyPairSync, verify} from 'node:crypto';
import {crxKennung, crxPacken, erweiterungId, erweiterungZip, oeffentlicherSchluessel, updateXml} from '../lib/erweiterung';

const {privateKey} = generateKeyPairSync('rsa', {modulusLength: 2048});
const spki = oeffentlicherSchluessel(privateKey);

/** Liest ein Protobuf-Feld mit Länge: [feldnummer, daten, rest]. */
function feldLesen(b: Buffer): [number, Buffer, Buffer] {
  let i = 0;
  const varint = () => {
    let n = 0, s = 0;
    for (;;) {
      const byte = b[i++]!;
      n |= (byte & 0x7f) << s;
      if (byte < 0x80) return n;
      s += 7;
    }
  };
  const tag = varint();
  const len = varint();
  return [tag >>> 3, b.subarray(i, i + len), b.subarray(i + len)];
}

describe('CRX3', () => {
  test('Kennung: sha256 über SPKI, Hex auf a–p', () => {
    const id = erweiterungId(spki);
    expect(id).toMatch(/^[a-p]{32}$/);
    const hex = createHash('sha256').update(spki).digest('hex').slice(0, 32);
    expect([...id].map((z) => (z.charCodeAt(0) - 97).toString(16)).join('')).toBe(hex);
  });

  test('Paket: Magie, Kopf, Signatur prüfbar mit dem öffentlichen Schlüssel', () => {
    const zip = erweiterungZip(spki, 'https://hub.test/api/erweiterung/update.xml', 'extension');
    const crx = crxPacken(zip, privateKey);
    expect(crx.subarray(0, 4).toString('latin1')).toBe('Cr24');
    expect(crx.readUInt32LE(4)).toBe(3);
    const kopfLen = crx.readUInt32LE(8);
    const kopf = crx.subarray(12, 12 + kopfLen);
    const zipTeil = crx.subarray(12 + kopfLen);
    expect(Buffer.compare(zipTeil, Buffer.from(zip))).toBe(0);

    const [f2, beweis, rest] = feldLesen(kopf);
    expect(f2).toBe(2);
    const [f1, pub, rest2] = feldLesen(beweis);
    const [, sig] = feldLesen(rest2);
    expect(f1).toBe(1);
    expect(Buffer.compare(pub, spki)).toBe(0);
    const [f10000, signed] = feldLesen(rest);
    expect(f10000).toBe(10000);
    const [, crxId] = feldLesen(signed);
    expect(Buffer.compare(crxId, crxKennung(spki))).toBe(0);

    const len = Buffer.alloc(4);
    len.writeUInt32LE(signed.length);
    const daten = Buffer.concat([Buffer.from('CRX3 SignedData\0', 'latin1'), len, signed, zipTeil]);
    expect(verify('sha256', daten, {key: pub, format: 'der', type: 'spki'}, sig)).toBe(true);
  });

  test('ZIP enthält das Manifest mit key und update_url, nie die README', () => {
    const zip = Buffer.from(erweiterungZip(spki, 'https://hub.test/u.xml', 'extension')).toString('latin1');
    expect(zip).toContain('manifest.json');
    expect(zip).toContain('content.js');
    expect(zip).not.toContain('README.md');
    expect(zip).toContain('"update_url": "https://hub.test/u.xml"');
    expect(zip).toContain(`"key": "${spki.toString('base64')}"`);
    expect(zip).toContain('"https://hub.test/*"');
  });

  test('updateXml nennt Kennung, Version und Paketadresse', () => {
    const xml = updateXml({id: 'a'.repeat(32), version: '1.2.3', crx: Buffer.alloc(0)}, 'https://hub.test');
    expect(xml).toContain(`appid='${'a'.repeat(32)}'`);
    expect(xml).toContain("version='1.2.3'");
    expect(xml).toContain("codebase='https://hub.test/api/erweiterung/medarbeiter-zugangscodes.crx'");
  });
});
