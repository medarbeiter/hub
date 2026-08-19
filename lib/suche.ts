import type {Sinn} from '@/components/sinnbilder';
import {ART_LABEL, STATUS_LABEL} from './abwesenheit-arten';
import {personAngabe, type AvatarKey, type PersonAngabe} from './avatar';
import {getDb, type AbwesenheitArt, type AbwesenheitStatus, type ReiseStatus, type User} from './db';
import {fmtDate, monthOf, parseDatumEingabe, todayISO} from './format';
import {hatRecht, rolleLabel, type Recht} from './rechte';
import {REISE_STATUS_LABEL} from './spesen';
import {sichtbareZugangskonten, zugangskontoName} from './zugangscodes';

/**
 * Die eine Suche — und ihr Zuschnitt liegt hier, nicht in der Anzeige.
 *
 * Dieselbe Haltung wie `sichtbarFuer` im Protokoll und `sichtbareZugangskonten`:
 * eine Sichtbarkeitsregel, die erst beim Zeichnen greift, ist eine, an der man
 * vorbeikommt — und eine Suche ist der Ort, an dem das am meisten wiegt, weil
 * sie Dinge findet, die man nicht schon kannte. Wer eine Zeile nicht sehen
 * darf, bekommt sie hier nicht in die Hand; die Palette selbst kennt kein
 * einziges Recht.
 *
 * Gefunden wird, was einen Ort hat: Seiten, Handlungen, Personen, Vorgänge,
 * Zugänge, ein Datum. Jeder Treffer ist eine Adresse — die Suche zeigt nichts
 * an, was die Zielseite nicht ohnehin zeigen würde, und ändert nie etwas.
 *
 * Die Reihenfolge ist eine Rechnung, keine Liste (`guete()`): sortiert wird
 * über alle Arten hinweg nach Güte, und die Palette gruppiert danach in der
 * Reihenfolge des ersten Auftretens. Damit steht oben immer das, was die Frage
 * am besten trifft — und die Überschrift darüber sagt, *was* es ist. Die erste
 * Zeile ist das, was die Eingabetaste tut; alles andere wäre eine Falle.
 */
export interface Treffer {
  /** Eindeutig über alle Gruppen — die Palette wählt darüber aus. */
  id: string;
  /** Die Überschrift, unter der die Palette gruppiert. */
  gruppe: string;
  label: string;
  /** Die zweite Zeile: was den Treffer von seinen Geschwistern unterscheidet. */
  zusatz?: string;
  href: string;
  sinn: Sinn;
  /** Ein Mensch wird gezeichnet, nicht bebildert (siehe person-zeichen.tsx). */
  person?: PersonAngabe;
}

/** Intern: derselbe Treffer, solange er noch seinen Rang trägt. */
type Roh = Treffer & {rang: number};

/**
 * Wie viele Zeilen eine Gruppe höchstens beisteuert, und wie viele Zeilen die
 * Palette überhaupt zeigt. Eine Suche, die rollen muss, hat die Frage nicht
 * beantwortet, sondern weitergereicht — lieber die besten zwölf als alle.
 */
const JE_GRUPPE = 4;
const HOECHSTENS = 12;

/** Ab hier lohnt sich eine Datenbankfrage. Ein Buchstabe passt auf alles. */
const AB_ZEICHEN = 2;

/**
 * Wie viele Zeilen die Datenbank vorlegt, bevor gewertet wird. Das Muster ist
 * absichtlich weit; die Feinwertung braucht Auswahl, aber keine Tabelle.
 */
const VORAUSWAHL = 40;

/**
 * Was eine Art wiegt, wenn zwei Treffer gleich gut auf die Frage passen.
 *
 * Kein Rangsystem, sondern ein Stichentscheid: ein Weg ist billiger als ein
 * Datensatz (man kann von dort weitersuchen), ein Mensch billiger als ein
 * Vorgang. Ein Datum sticht alles — wer „4.8." tippt, meint den 4. August und
 * nichts sonst.
 */
const GEWICHT: Record<string, number> = {
  Tag: 900,
  Seiten: 60,
  Aktionen: 50,
  Zugänge: 40,
  Personen: 30,
  Abwesenheiten: 10,
  Reisen: 10,
};

/**
 * Kleinschreibung, Umlaute aufgelöst, ß zu ss: „Schröder" wird unter
 * „schroder" gefunden, „Grüße" unter „gruesse". Ohne das findet nur, wer die
 * Schreibweise schon kennt — und dann braucht er keine Suche.
 */
function falte(s: string): string {
  return s
    .toLowerCase()
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss');
}

const TRENNER = /[\s·\-–—/&.,()"„"]/;

/**
 * Die Güte eines Treffers: wie gut passt die Frage auf diesen Text?
 * `null` heißt „gar nicht".
 *
 * Vier Stufen, absteigend: der Text *beginnt* mit der Frage, ein *Wort* darin
 * beginnt damit, sie steht irgendwo darin, oder ihre Buchstaben kommen der
 * Reihe nach vor („mtb" → „Monatsabschluss Team Berichte"). Die unscharfe
 * Stufe zahlt Zuschläge für zusammenhängende Strecken und für Wortanfänge —
 * sonst wäre jedes lange Wort ein Treffer für jede Frage. Kurze Texte gewinnen
 * bei gleicher Passung, weil in ihnen mehr von der Frage steckt.
 */
export function guete(text: string, frage: string): number | null {
  const t = falte(text);
  const f = falte(frage);
  if (f === '') return 0;
  const kuerze = Math.max(0, 40 - Math.min(t.length, 40));

  const stelle = t.indexOf(f);
  if (stelle === 0) return 1000 + kuerze;
  if (stelle > 0) return (TRENNER.test(t[stelle - 1]!) ? 800 : 600) + kuerze;

  let punkte = 0;
  let ab = 0;
  let lauf = 0;
  for (const zeichen of f) {
    const j = t.indexOf(zeichen, ab);
    if (j < 0) return null;
    lauf = j === ab && ab > 0 ? lauf + 1 : 0;
    punkte += 10 + lauf * 8 + (j === 0 || TRENNER.test(t[j - 1]!) ? 14 : 0);
    ab = j + 1;
  }
  return 200 + punkte + kuerze;
}

/**
 * Die beste Güte über mehrere Texte. Der erste ist der Name, der zählt voll;
 * alles Weitere (Notiz, Suchwörter, E-Mail) ist Beiwerk und wird mit Abschlag
 * gewertet — ein Treffer im Namen soll immer über einem im Kleingedruckten
 * stehen.
 */
function besteGuete(haupt: string, frage: string, beiwerk: Array<string | null | undefined> = []): number | null {
  const g = guete(haupt, frage);
  const rest = beiwerk
    .filter((s): s is string => !!s)
    .map((s) => guete(s, frage))
    .filter((n): n is number => n !== null)
    .map((n) => n - 300);
  const alle = [g, ...rest].filter((n): n is number => n !== null);
  return alle.length ? Math.max(...alle) : null;
}

/**
 * Das Muster, mit dem SQL vorsortiert: die Buchstaben der Frage der Reihe nach
 * (`%a%n%n%`). Unscharf genug, dass die Feinwertung danach überhaupt etwas zu
 * werten hat, und scharf genug, dass nicht die halbe Tabelle in den Speicher
 * wandert. `%`, `_` und `\` fallen heraus — in einem Namen stehen sie nicht,
 * und als LIKE-Platzhalter hätten sie hier nichts zu suchen.
 *
 * ponytail: SQLite faltet keine Umlaute, das Muster also auch nicht — „schroder"
 * findet „Schröder" erst, wenn eine gefaltete Spalte danebensteht.
 */
function muster(frage: string): string {
  const zeichen = [...frage].filter((c) => !'%_\\'.includes(c));
  return `%${zeichen.join('%')}%`;
}

/**
 * Die Seiten. Die Leiste zeichnet ihre eigene Liste — sie hängt an Zählern,
 * Zweigen und Gruppen und ist keine Datenliste; hier steht, was eine Adresse
 * *ist*: Name, Ziel, Recht. Ein neuer Bereich gehört an beide Stellen.
 *
 * `woerter` sind die Wörter, unter denen jemand sucht, ohne den Seitennamen zu
 * kennen — „urlaub" führt zur Abwesenheit, „csv" zu den Berichten. `start`
 * heißt: gehört auf das leere Blatt (siehe `schnellzugriff()`).
 */
interface Ort {
  label: string;
  href: string;
  sinn: Sinn;
  recht?: Recht;
  zusatz?: string;
  woerter?: string;
  start?: true;
}

const SEITEN: Ort[] = [
  {label: 'Meine Zeit', href: '/', sinn: 'monat', woerter: 'stempeln zeiten tag woche arbeitszeit', start: true},
  {label: 'Zeitkonto', href: '/?ansicht=konto', sinn: 'konto', woerter: 'saldo überstunden guthaben'},
  {label: 'Abwesenheit', href: '/abwesenheit', sinn: 'abwesenheit', woerter: 'urlaub krank fortbildung freizeitausgleich antrag', start: true},
  {label: 'Teamkalender', href: '/kalender', sinn: 'teamkalender', woerter: 'wer ist da abwesend', start: true},
  {label: 'Reisen & Spesen', href: '/spesen', sinn: 'reise', woerter: 'dienstreise pauschale beleg verpflegung', start: true},
  {label: 'Zugangscodes', href: '/zugangscodes', sinn: 'zugangscode', woerter: 'einmalcode totp zwei faktor'},
  {label: 'Protokoll', href: '/protokoll', sinn: 'protokoll', woerter: 'nachweis änderungen wer hat'},
  {label: 'Persönliche Einstellungen', href: '/profil', sinn: 'einstellungen', woerter: 'profil passwort profilbild google benachrichtigungen'},
  {label: 'Team', href: '/team', sinn: 'team', recht: 'zeit.team', woerter: 'anwesend mitarbeitende zeiten'},
  {label: 'Spesen prüfen', href: '/spesen/pruefen', sinn: 'pruefen', recht: 'spesen.pruefen', woerter: 'reisen genehmigen'},
  {label: 'Abwesenheit prüfen', href: '/abwesenheit/pruefen', sinn: 'abwesenheit', recht: 'abwesenheit.pruefen', woerter: 'anträge genehmigen urlaub'},
  {label: 'Monatsabschluss', href: '/abschluss', sinn: 'abschluss', recht: 'abschluss.verwalten', woerter: 'sperren lohn'},
  {label: 'Berichte', href: '/berichte', sinn: 'berichte', recht: 'berichte.sehen', woerter: 'auswertung export csv lohnabrechnung'},
  {label: 'Mitarbeiter', href: '/mitarbeiter', sinn: 'mitarbeiter', recht: 'mitarbeiter.verwalten', woerter: 'konten rechte anlegen'},
  {label: 'Verbundene Apps', href: '/apps', sinn: 'verbundeneApps', recht: 'apps.verwalten', woerter: 'oauth anmeldung'},
  {label: 'Einstellungen', href: '/einstellungen', sinn: 'einstellungen', recht: 'einstellungen.verwalten', woerter: 'unternehmen sätze feiertage'},
];

/**
 * Handlungen, die eine Adresse haben. Stempeln steht bewusst NICHT dabei: die
 * Stempelleiste ist die immer sichtbare Heimat dieser vier Handlungen, der
 * aufgeklappte Navigationseintrag spiegelt sie — ein dritter Ort wäre ein
 * dritter Zustand, der auseinanderlaufen kann.
 */
function aktionen(heute: string): Ort[] {
  return [
    {
      label: 'Abwesenheit erfassen',
      href: `/abwesenheit?von=${heute}`,
      sinn: 'hinzufuegen',
      recht: 'abwesenheit.beantragen',
      zusatz: 'Urlaub beantragen, Krankheit melden',
      woerter: 'urlaub krank beantragen melden neu',
      start: true,
    },
    {
      label: 'Reise erfassen',
      href: `/spesen?neu=${heute}`,
      sinn: 'hinzufuegen',
      recht: 'spesen.erfassen',
      zusatz: 'Dienstreise anlegen',
      woerter: 'dienstreise spesen neu anlegen',
      start: true,
    },
    {
      label: 'Monatsnachweis drucken',
      href: `/druck/${monthOf(heute)}`,
      sinn: 'drucken',
      recht: 'zeit.erfassen',
      zusatz: 'Der eigene Nachweis dieses Monats',
      woerter: 'ausdruck pdf stundenzettel',
    },
    {
      label: 'CSV für Lohnabrechnung',
      href: `/api/export?monat=${monthOf(heute)}`,
      sinn: 'csv',
      recht: 'berichte.sehen',
      zusatz: 'Export aller Mitarbeitenden',
      woerter: 'export tabelle lohn',
    },
  ];
}

const darf = (user: User, ort: Ort) => (ort.recht ? hatRecht(user, ort.recht) : true);

const zuTreffer = (ort: Ort, gruppe: string, rang: number): Roh => ({
  id: `${gruppe}:${ort.href}`,
  gruppe,
  label: ort.label,
  zusatz: ort.zusatz,
  href: ort.href,
  sinn: ort.sinn,
  rang,
});

function orte(liste: Ort[], user: User, gruppe: string, frage: string): Roh[] {
  const treffer: Roh[] = [];
  for (const ort of liste) {
    if (!darf(user, ort)) continue;
    const g = besteGuete(ort.label, frage, [ort.zusatz, ort.woerter]);
    if (g !== null) treffer.push(zuTreffer(ort, gruppe, g + GEWICHT[gruppe]!));
  }
  return treffer;
}

/**
 * Das leere Blatt.
 *
 * Eine Palette, die beim Öffnen jede Seite des Hauses auflistet, ist ein
 * Inhaltsverzeichnis — man liest sie nicht, man scrollt an ihr vorbei, und die
 * erste Zeile bedeutet nichts. Sechs Zeilen ohne Rollbalken sind ein
 * Sprungbrett: die vier Bereiche, in denen jemand täglich steht, und die zwei
 * Dinge, die er anlegen kann. Alles andere findet, wer tippt — dafür sagt das
 * Eingabefeld, wonach es fragt.
 */
function schnellzugriff(user: User, heute: string): Roh[] {
  const liste = [...SEITEN, ...aktionen(heute)].filter((o) => o.start && darf(user, o));
  return liste.map((o, i) => zuTreffer(o, 'Schnellzugriff', liste.length - i));
}

/**
 * Die Gruppe, die keine Kategorie ist: das Weiterreichen ans Protokoll. Sie
 * steht in jeder Antwort und wäre darum als Reiter eine Kategorie, die immer
 * genau eine Zeile hat — der Client lässt sie deshalb aus seiner Reiterleiste
 * heraus, und ein Zuschnitt auf sie gibt es nicht.
 */
export const GRUPPE_WEITER = 'Weitersuchen';

/**
 * Der Suchlauf. Eine leere Frage beantwortet das Sprungbrett; alles andere
 * braucht ein Wort, Datensätze zwei Buchstaben.
 *
 * `bereich` schneidet auf eine einzige Gruppe zu — das, was die Reiterleiste
 * der Palette tut. Der Zuschnitt gehört hierher und nicht in den Browser: je
 * Gruppe liefert die Antwort sonst nur die besten vier, und ein Reiter
 * „Personen", der vier von zwanzig zeigt, verspricht mehr, als er hält. Wird
 * zugeschnitten, fällt die Grenze je Gruppe weg — es gibt nur noch eine.
 */
export function suche(user: User, roh: string, bereich?: string): Treffer[] {
  const frage = roh.trim();
  const heute = todayISO();
  if (frage === '') return schnellzugriff(user, heute).map(ohneRang);

  const treffer: Roh[] = [];

  // Ein Datum ist die kuerzeste Suche der Anwendung: „4.8." meint einen Tag.
  const tag = parseDatumEingabe(roh, heute);
  if (tag && tag <= heute) {
    treffer.push({
      id: `tag:${tag}`,
      gruppe: 'Tag',
      label: fmtDate(tag),
      zusatz: 'Meine Zeit an diesem Tag',
      href: `/?ansicht=tag&tag=${tag}`,
      sinn: 'jetzt',
      rang: GEWICHT.Tag!,
    });
  }

  treffer.push(...orte(SEITEN, user, 'Seiten', frage));
  treffer.push(...orte(aktionen(heute), user, 'Aktionen', frage));

  if (frage.length >= AB_ZEICHEN) {
    treffer.push(...personen(user, frage));
    treffer.push(...abwesenheiten(user, frage));
    treffer.push(...reisen(user, frage));
    treffer.push(...zugaenge(user, frage));
  }

  const beste = besten(treffer, bereich);

  // Im Zuschnitt endet die Antwort hier: eine zweite Gruppe wäre genau das,
  // was der Reiter gerade weggelassen hat. Das Weitersuchen steht auf „Alle",
  // und dorthin führt der erste Reiter zurück.
  if (bereich) return beste;

  // Der letzte Ausweg und zugleich das Recht auf Auskunft: was hier nicht
  // steht, steht vielleicht im Nachweis. Wer nicht `protokoll.alle` trägt,
  // findet dort seine eigene Spur — den Zuschnitt macht die Seite selbst.
  // Immer die letzte Zeile, nie die erste: ein Weiterreichen ist keine Antwort.
  beste.push({
    id: 'protokoll:suche',
    gruppe: GRUPPE_WEITER,
    label: `„${frage}" im Protokoll suchen`,
    zusatz: hatRecht(user, 'protokoll.alle') ? 'Alle Konten' : 'Die eigene Spur',
    href: `/protokoll?suche=${encodeURIComponent(frage)}`,
    sinn: 'suchen',
  });

  return beste;
}

const ohneRang = ({rang: _rang, ...t}: Roh): Treffer => t;

/**
 * Aus allen Treffern die zwölf besten — je Gruppe höchstens vier, damit ein
 * ergiebiger Bereich die anderen nicht verdeckt, und sortiert über alle Arten
 * hinweg: die Palette gruppiert anschließend in der Reihenfolge des ersten
 * Auftretens, also steht die Gruppe des besten Treffers oben.
 */
function besten(treffer: Roh[], bereich?: string): Treffer[] {
  const gezaehlt = new Map<string, number>();
  const behalten: Roh[] = [];
  const jeGruppe = bereich ? HOECHSTENS : JE_GRUPPE;
  for (const t of [...treffer].sort((a, b) => b.rang - a.rang)) {
    if (bereich && t.gruppe !== bereich) continue;
    const n = gezaehlt.get(t.gruppe) ?? 0;
    if (n >= jeGruppe) continue;
    gezaehlt.set(t.gruppe, n + 1);
    behalten.push(t);
    if (behalten.length >= HOECHSTENS) break;
  }
  return behalten.map(ohneRang);
}

/**
 * Personen. Jedes angemeldete Konto darf Kolleginnen und Kollegen finden — es
 * sieht sie im Teamkalender, und die Personenkarte gibt ihnen dieselben
 * Angaben (`api/person`). Deaktivierte Konten sind kein Teil des Hauses mehr
 * und tauchen nur für die Mitarbeiterverwaltung auf.
 *
 * Hier wird die ganze (kleine) Belegschaft geholt und im Speicher gewertet:
 * ein Haus hat Dutzende Konten, nicht Tausende — und gerade bei Namen wäre die
 * ungefaltete Suche der Datenbank die schlechteste (siehe `muster()`).
 */
function personen(user: User, frage: string): Roh[] {
  const auchInaktive = hatRecht(user, 'mitarbeiter.verwalten');
  const rows = getDb()
    .query<
      {id: number; name: string; email: string; role: string; active: number; avatar_key: AvatarKey; avatar_datei: string | null},
      [number]
    >(
      `SELECT id, name, email, role, active, avatar_key, avatar_datei FROM users
       WHERE active = 1 OR ? ORDER BY active DESC, name`,
    )
    .all(auchInaktive ? 1 : 0);

  // Wohin der Treffer führt, hängt daran, was der Suchende mit der Person tun
  // darf: an ihr Blatt, wer fremde Zeiten sehen darf — sonst dorthin, wo sie
  // für alle sichtbar ist.
  const zumBlatt = hatRecht(user, 'zeit.team');
  const treffer: Roh[] = [];
  for (const r of rows) {
    const g = besteGuete(r.name, frage, [r.email]);
    if (g === null) continue;
    treffer.push({
      id: `person:${r.id}`,
      gruppe: 'Personen',
      label: r.name,
      zusatz: [rolleLabel(r.role), r.active === 0 ? 'deaktiviert' : null].filter(Boolean).join(' · '),
      href: r.id === user.id ? '/profil' : zumBlatt ? `/team/${r.id}` : '/kalender',
      sinn: 'team',
      person: personAngabe(r),
      rang: g + GEWICHT.Personen! + (r.active === 0 ? -100 : 0),
    });
  }
  return treffer;
}

/**
 * Abwesenheiten. Die eigenen immer; fremde nur, wer sie zu prüfen hat — und
 * nur dann steht auch ihre Art da. Für alle anderen gibt es diese Zeilen
 * nicht, auch nicht als Zeitraum ohne Grund: der Teamkalender sagt, wer weg
 * ist, und was er absichtlich verschweigt, darf die Suche nicht nachreichen.
 *
 * Ein fremder Entwurf bleibt auch dann fort: er ist noch nicht gestellt, die
 * Prüfliste kennt ihn nicht (dort gibt es kein Register „Entwurf"), und ein
 * Treffer darauf wäre beides — eine Auskunft über etwas Ungestelltes und ein
 * Verweis ins Leere.
 */
function abwesenheiten(user: User, frage: string): Roh[] {
  const darfPruefen = hatRecht(user, 'abwesenheit.pruefen');
  const wie = muster(frage);
  const rows = getDb()
    .query<
      {id: number; user_id: number; name: string; von: string; bis: string; art: AbwesenheitArt; status: AbwesenheitStatus; notiz: string | null},
      [number, number, string, string, string, string, string]
    >(
      `SELECT a.id, a.user_id, u.name, a.von, a.bis, a.art, a.status, a.notiz
       FROM abwesenheiten a JOIN users u ON u.id = a.user_id
       WHERE (a.user_id = ? OR (? AND a.status <> 'entwurf'))
         AND (u.name LIKE ? OR a.art LIKE ? OR a.notiz LIKE ? OR a.von LIKE ? OR a.bis LIKE ?)
       ORDER BY a.von DESC LIMIT ${VORAUSWAHL}`,
    )
    .all(user.id, darfPruefen ? 1 : 0, wie, wie, wie, wie, wie);

  const treffer: Roh[] = [];
  for (const r of rows) {
    const eigen = r.user_id === user.id;
    const g = besteGuete(ART_LABEL[r.art], frage, [eigen ? null : r.name, r.notiz, spanne(r.von, r.bis), r.von]);
    if (g === null) continue;
    treffer.push({
      id: `abwesenheit:${r.id}`,
      gruppe: 'Abwesenheiten',
      label: `${ART_LABEL[r.art]} · ${spanne(r.von, r.bis)}`,
      zusatz: [eigen ? null : r.name, STATUS_LABEL[r.status]].filter(Boolean).join(' · '),
      href: eigen
        ? `/abwesenheit?ansicht=monat&monat=${monthOf(r.von)}`
        : `/abwesenheit/pruefen?status=${r.status}&offen=${r.id}`,
      sinn: r.art,
      rang: g + GEWICHT.Abwesenheiten! + frisch(r.von),
    });
  }
  return treffer;
}

/** Reisen — derselbe Schnitt: die eigenen, fremde nur für die Prüfung, fremde Entwürfe nie. */
function reisen(user: User, frage: string): Roh[] {
  const darfPruefen = hatRecht(user, 'spesen.pruefen');
  const wie = muster(frage);
  const rows = getDb()
    .query<
      {id: number; user_id: number; name: string; start_date: string; end_date: string; zweck: string; ziel: string | null; status: ReiseStatus},
      [number, number, string, string, string, string, string]
    >(
      `SELECT r.id, r.user_id, u.name, r.start_date, r.end_date, r.zweck, r.ziel, r.status
       FROM reisen r JOIN users u ON u.id = r.user_id
       WHERE (r.user_id = ? OR (? AND r.status <> 'entwurf'))
         AND (u.name LIKE ? OR r.zweck LIKE ? OR r.ziel LIKE ? OR r.start_date LIKE ? OR r.end_date LIKE ?)
       ORDER BY r.start_date DESC LIMIT ${VORAUSWAHL}`,
    )
    .all(user.id, darfPruefen ? 1 : 0, wie, wie, wie, wie, wie);

  const treffer: Roh[] = [];
  for (const r of rows) {
    const eigen = r.user_id === user.id;
    const g = besteGuete(r.zweck, frage, [r.ziel, eigen ? null : r.name, spanne(r.start_date, r.end_date), r.start_date]);
    if (g === null) continue;
    treffer.push({
      id: `reise:${r.id}`,
      gruppe: 'Reisen',
      label: [r.zweck, r.ziel].filter(Boolean).join(' · '),
      zusatz: [eigen ? null : r.name, spanne(r.start_date, r.end_date), REISE_STATUS_LABEL[r.status]]
        .filter(Boolean)
        .join(' · '),
      href: eigen
        ? `/spesen?ansicht=monat&monat=${monthOf(r.start_date)}`
        : `/spesen/pruefen?status=${r.status}`,
      sinn: 'reise',
      rang: g + GEWICHT.Reisen! + frisch(r.start_date),
    });
  }
  return treffer;
}

/**
 * Zugänge. Der Leserkreis ist schon geschnitten (`sichtbareZugangskonten`);
 * gefiltert wird danach nur noch im Speicher — es sind Dutzende Zeilen, keine
 * Tausende. Der laufende Code steht hier nirgends: die Suche nennt den Ort,
 * die Seite nennt die Ziffern.
 */
function zugaenge(user: User, frage: string): Roh[] {
  const treffer: Roh[] = [];
  for (const k of sichtbareZugangskonten(user)) {
    const name = zugangskontoName(k);
    const g = besteGuete(name, frage, [k.dienst]);
    if (g === null) continue;
    treffer.push({
      id: `zugang:${k.id}`,
      gruppe: 'Zugänge',
      label: name,
      zusatz: 'Einmalcode ansehen',
      href: `/zugangscodes?suche=${encodeURIComponent(k.dienst)}`,
      sinn: 'zugangscode',
      rang: g + GEWICHT.Zugänge!,
    });
  }
  return treffer;
}

/**
 * Ein kleiner Zuschlag für das Jüngere. Wer „urlaub" sucht, meint fast immer
 * den nächsten, nicht den von vorletztem Jahr — aber ein Datum darf eine
 * schlechtere Passung nie überholen, deshalb bleibt der Zuschlag klein.
 */
function frisch(datum: string): number {
  const tage = (Date.parse(`${todayISO()}T00:00:00Z`) - Date.parse(`${datum}T00:00:00Z`)) / 86_400_000;
  return Math.max(-30, 30 - Math.abs(tage) / 30);
}

const spanne = (von: string, bis: string) => (von === bis ? fmtDate(von) : `${fmtDate(von)} – ${fmtDate(bis)}`);
