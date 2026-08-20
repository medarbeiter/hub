import {describe, expect, test} from 'bun:test';
import {crc32, zipErstellen} from '../lib/zip';

describe('crc32', () => {
  // Der Standard-Prüfvektor aus der CRC-Literatur (IEEE 802.3).
  test('rechnet den bekannten Prüfvektor', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926);
  });

  test('leere Eingabe ergibt 0', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });
});

describe('zipErstellen', () => {
  const eintraege = [
    {name: 'spesen.csv', daten: new TextEncoder().encode('Mitarbeiter;Summe\r\nMax;42')},
    {name: 'belege/max/beleg-1-2026-08-12.jpg', daten: new Uint8Array([0xff, 0xd8, 0xff, 0xe0])},
  ];

  test('schreibt ein Archiv, das seine eigenen Verweise einhält', () => {
    const zip = zipErstellen(eintraege);
    const sicht = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

    // End of central directory steht am Ende und zählt beide Einträge.
    const eocd = zip.length - 22;
    expect(sicht.getUint32(eocd, true)).toBe(0x06054b50);
    expect(sicht.getUint16(eocd + 10, true)).toBe(2);

    // Der EOCD-Verweis trifft den ersten Central-directory-Eintrag, und dessen
    // Offset trifft den ersten Local file header.
    const zentral = sicht.getUint32(eocd + 16, true);
    expect(sicht.getUint32(zentral, true)).toBe(0x02014b50);
    const lokal = sicht.getUint32(zentral + 42, true);
    expect(sicht.getUint32(lokal, true)).toBe(0x04034b50);

    // Erster Eintrag: Name und Daten stehen unversehrt hinter dem Header.
    const nameLaenge = sicht.getUint16(lokal + 26, true);
    const name = new TextDecoder().decode(zip.subarray(lokal + 30, lokal + 30 + nameLaenge));
    expect(name).toBe('spesen.csv');
    expect(sicht.getUint32(lokal + 14, true)).toBe(crc32(eintraege[0]!.daten));
  });

  // Der eigentliche Beweis: ein fremder Leser nimmt das Archiv an. `unzip`
  // gehört zu macOS und jedem üblichen Linux; wo es fehlt, wird übersprungen.
  test('besteht die Prüfung eines echten Entpackers', () => {
    const pfad = `${import.meta.dir}/.zip-test-${process.pid}.zip`;
    try {
      Bun.spawnSync(['which', 'unzip']);
    } catch {
      return;
    }
    try {
      require('node:fs').writeFileSync(pfad, zipErstellen(eintraege));
      const ergebnis = Bun.spawnSync(['unzip', '-t', pfad]);
      expect(ergebnis.exitCode).toBe(0);
    } finally {
      require('node:fs').rmSync(pfad, {force: true});
    }
  });
});
