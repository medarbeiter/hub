// Welcher Zugangscode gehört zu welcher Seite? Die Rechnung hinter der
// Browser-Erweiterung (extension/) — rein und client-importierbar, damit sie
// mit `bun test` prüfbar ist und die Erweiterung selbst nichts entscheiden
// muss: sie schickt den Hostnamen, der Server sortiert.
//
// Vier Stufen, von sicher nach geraten:
//   3  die Seite steht am Zugang (gelernt oder eingetragen), genau dieser Host
//   2  dieselbe Domäne — `login.example.com` gegen ein gemerktes `example.com`
//   1  der Dienstname klingt nach der Domäne („GitHub Felix" auf github.com)
//   0  kein Zusammenhang
// Die Erweiterung füllt von selbst nur bei einem einzigen Treffer der Stufe 3
// oder 2; alles andere ist ein Vorschlag, den ein Mensch bestätigt.

/** Kleinschreibung, Umlaute aufgelöst — wie `falte()` in lib/suche.ts. */
function falte(s: string): string {
  return s
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
}

/**
 * Eine Eingabe zu einem Hostnamen: „https://Login.Example.com:8443/pfad" →
 * „login.example.com". `null`, wenn kein Host darin steckt.
 */
export function hostNormieren(eingabe: string): string | null {
  const roh = eingabe.trim().toLowerCase();
  if (roh === '') return null;
  let host = roh;
  try {
    host = new URL(roh.includes('://') ? roh : `https://${roh}`).hostname;
  } catch {
    return null;
  }
  host = host.replace(/^www\./, '').replace(/\.$/, '');
  if (host === '' || !/^[a-z0-9.-]+$/.test(host)) return null;
  return host;
}

/**
 * Die registrierbare Domäne, näherungsweise: die letzten zwei Bezeichner,
 * drei bei einer zweistufigen Endung wie `co.uk` oder `com.br`.
 * ponytail: keine Public-Suffix-Liste — die zwei Regeln decken das Haus ab.
 */
export function basisDomain(host: string): string {
  const teile = host.split('.');
  if (teile.length <= 2) return host;
  const [tld, zweite] = [teile.at(-1)!, teile.at(-2)!];
  const zweistufig = tld.length === 2 && zweite.length <= 3;
  return teile.slice(zweistufig ? -3 : -2).join('.');
}

/** Die Seitenliste eines Zugangs: Hostnamen, durch Leerzeichen getrennt, ohne Doppel. */
export function seitenParsen(text: string): string[] {
  const hosts = text
    .split(/[\s,;]+/)
    .map(hostNormieren)
    .filter((h): h is string => h !== null);
  return [...new Set(hosts)];
}

export function seitenText(hosts: string[]): string {
  return hosts.join(' ');
}

/** Der Markenname der Seite: der erste Bezeichner der Basisdomäne („github" aus github.com). */
function marke(host: string): string {
  return basisDomain(host).split('.')[0] ?? '';
}

/** Wörter des Dienstnamens, die etwas bedeuten: mindestens drei Zeichen, keine Adressen. */
function woerter(text: string): string[] {
  return falte(text)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3);
}

export type TrefferStufe = 0 | 1 | 2 | 3;

export function treffer(
  zugang: {dienst: string; konto: string | null; seiten: string},
  host: string | null,
): TrefferStufe {
  if (host === null) return 0;
  const seiten = seitenParsen(zugang.seiten);
  if (seiten.includes(host)) return 3;
  const basis = basisDomain(host);
  if (seiten.some((s) => basisDomain(s) === basis)) return 2;

  const m = marke(host);
  if (m.length < 3) return 0;
  const dienstWoerter = woerter(zugang.dienst);
  // „github" ⊂ „github felix" — oder ein Dienstwort ⊂ „microsoftonline".
  if (dienstWoerter.some((w) => w === m || (w.length >= 4 && m.includes(w)) || (m.length >= 4 && w.includes(m)))) {
    return 1;
  }
  // Abkürzungen mit Punkten: „B.I.S. GmbH" beginnt, zusammengezogen, mit „bis".
  if (falte(zugang.dienst).replace(/[^a-z0-9]/g, '').startsWith(m)) return 1;
  // Ein Konto, das eine Adresse dieser Domäne ist (info@example.com auf example.com).
  const kontoDomain = zugang.konto?.split('@')[1]?.toLowerCase();
  if (kontoDomain && basisDomain(kontoDomain) === basis) return 1;
  return 0;
}
