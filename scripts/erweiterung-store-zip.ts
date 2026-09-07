// Das ZIP für den Chrome Web Store (unlistet): der Ordner extension/ ohne
// README und ohne die localhost-Herkunft, denn die gehört nur dem entpackten
// Entwickeln. Kein `key`, kein `update_url` — beides vergibt der Store.
//
//   bun scripts/erweiterung-store-zip.ts > medarbeiter-zugangscodes.zip
//
// Danach im Developer Dashboard hochladen, Sichtbarkeit „Nicht gelistet",
// und die Adresse der Store-Seite als ERWEITERUNG_STORE_URL, die Kennung als
// ERWEITERUNG_STORE_ID in die Umgebung des Hubs.
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {zipErstellen, type ZipEintrag} from '../lib/zip';

const WURZEL = 'extension';
const AUS = new Set(['README.md', '.DS_Store']);

function sammeln(relativ = ''): ZipEintrag[] {
  const liste: ZipEintrag[] = [];
  for (const name of readdirSync(join(WURZEL, relativ)).sort()) {
    if (AUS.has(name)) continue;
    const pfad = relativ ? `${relativ}/${name}` : name;
    if (statSync(join(WURZEL, pfad)).isDirectory()) liste.push(...sammeln(pfad));
    else liste.push({name: pfad, daten: new Uint8Array(readFileSync(join(WURZEL, pfad)))});
  }
  return liste;
}

const eintraege = sammeln().map((e) => {
  if (e.name !== 'manifest.json') return e;
  const m = JSON.parse(Buffer.from(e.daten).toString('utf8'));
  m.externally_connectable = {matches: m.externally_connectable.matches.filter((h: string) => !h.includes('localhost'))};
  return {name: e.name, daten: new TextEncoder().encode(JSON.stringify(m, null, 2))};
});
process.stdout.write(zipErstellen(eintraege));
