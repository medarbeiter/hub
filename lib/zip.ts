// Ein ZIP-Archiv, von Hand geschrieben — rein, ohne Abhängigkeit. Der
// Spesen-Export legt die Belegdateien neben die CSV, und weder Bun noch Node
// bringen einen ZIP-Container mit; eine Bibliothek dafür einzubauen hieße,
// eine Abhängigkeit für ~80 Zeilen wohldefiniertes Binärformat zu pflegen.
//
// Es wird nicht komprimiert (Methode „Store"): Belege sind JPEGs, WEBPs und
// PDFs, die ein Deflate kaum kleiner macht, und die CSV daneben ist winzig.
// ponytail: kein Zip64 — bei 4 GB ist Schluss, was ein Monat aus höchstens
// 10-MB-Belegen nicht erreicht; wächst das je, Zip64-Records ergänzen.

const CRC_TABELLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

export function crc32(daten: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of daten) crc = CRC_TABELLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEintrag {
  /** Pfad im Archiv, mit `/` als Trenner — wird als UTF-8 geschrieben. */
  name: string;
  daten: Uint8Array;
}

/** Baut das Archiv vollständig im Speicher — angemessen für einen Monatsexport. */
export function zipErstellen(eintraege: ZipEintrag[]): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder();
  const jetzt = new Date();
  const dosZeit = (jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | (jetzt.getSeconds() >> 1);
  const dosDatum = ((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate();

  const teile: Uint8Array[] = [];
  const zentral: Uint8Array[] = [];
  let offset = 0;

  for (const {name, daten} of eintraege) {
    const nameBytes = encoder.encode(name);
    const crc = crc32(daten);

    const lokal = new DataView(new ArrayBuffer(30));
    lokal.setUint32(0, 0x04034b50, true); // Local file header
    lokal.setUint16(4, 20, true); // benötigte Version 2.0
    lokal.setUint16(6, 0x0800, true); // Flag: Name ist UTF-8
    lokal.setUint16(8, 0, true); // Methode: Store
    lokal.setUint16(10, dosZeit, true);
    lokal.setUint16(12, dosDatum, true);
    lokal.setUint32(14, crc, true);
    lokal.setUint32(18, daten.length, true); // komprimiert = unkomprimiert
    lokal.setUint32(22, daten.length, true);
    lokal.setUint16(26, nameBytes.length, true);
    lokal.setUint16(28, 0, true); // kein Extra-Feld

    const kopf = new DataView(new ArrayBuffer(46));
    kopf.setUint32(0, 0x02014b50, true); // Central directory header
    kopf.setUint16(4, 20, true); // erzeugt von Version 2.0
    kopf.setUint16(6, 20, true); // benötigte Version 2.0
    kopf.setUint16(8, 0x0800, true);
    kopf.setUint16(10, 0, true);
    kopf.setUint16(12, dosZeit, true);
    kopf.setUint16(14, dosDatum, true);
    kopf.setUint32(16, crc, true);
    kopf.setUint32(20, daten.length, true);
    kopf.setUint32(24, daten.length, true);
    kopf.setUint16(28, nameBytes.length, true);
    // Extra, Kommentar, Start-Disk, interne und externe Attribute: alles 0.
    kopf.setUint32(42, offset, true); // Offset des Local file headers

    teile.push(new Uint8Array(lokal.buffer), nameBytes, daten);
    zentral.push(new Uint8Array(kopf.buffer), nameBytes);
    offset += 30 + nameBytes.length + daten.length;
  }

  const zentralGroesse = zentral.reduce((s, t) => s + t.length, 0);
  const ende = new DataView(new ArrayBuffer(22));
  ende.setUint32(0, 0x06054b50, true); // End of central directory
  ende.setUint16(8, eintraege.length, true); // Einträge auf dieser Disk
  ende.setUint16(10, eintraege.length, true); // Einträge gesamt
  ende.setUint32(12, zentralGroesse, true);
  ende.setUint32(16, offset, true); // Beginn des Central directory

  const alle = [...teile, ...zentral, new Uint8Array(ende.buffer)];
  const archiv = new Uint8Array(alle.reduce((s, t) => s + t.length, 0));
  let pos = 0;
  for (const teil of alle) {
    archiv.set(teil, pos);
    pos += teil.length;
  }
  return archiv;
}
