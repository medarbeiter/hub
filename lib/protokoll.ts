// Das Protokoll — der Nachweis darüber, wer wann was am Datensatz getan hat.
//
// Die Anwendung hatte den Anfang davon schon: `edited_by` sagt, wer eine Zeile
// zuletzt angefasst hat. Was sie nicht hatte, ist die Geschichte — wer sie
// *vorher* angefasst hat, was dabei aus welchem Wert wurde, wer sich an einem
// abgeschlossenen Monat versucht hat und abgewiesen wurde, und wer sich
// überhaupt angemeldet hat. Genau danach fragt eine Betriebsprüfung, und genau
// das verlangt ein Mitarbeiter, der einer Korrektur widerspricht.
//
// Zwei Dinge macht dieses Modul und sonst nichts:
//
//   `protokolliere()` schreibt eine Zeile und hängt sie an die Hashkette.
//   `protokollSeite()` liest sie unter Filtern wieder heraus.
//
// Die Unveränderbarkeit selbst steht nicht hier, sondern im Schema
// (`migration8Protokoll` in lib/db.ts): zwei Trigger, die UPDATE und DELETE
// abweisen. Eine Regel, die nur in der Anwendung steht, gilt nur so lange, wie
// alle durch die Anwendung gehen.
//
// DB-gebunden, aber absichtlich dünn: es kennt `getDb` und die reinen
// Formathelfer, sonst keinen Teil der Domäne. Ein Protokoll, das die halbe
// Anwendung importiert, wird zu einer Stelle, an der die halbe Anwendung
// kaputtgehen kann.
//
// Das Vokabular — welche Aktionen es gibt und wie sie heißen — liegt in
// lib/protokoll-arten.ts. Es muss ohne Datenbank auskommen, weil die
// Filterleiste im Browser dieselben Namen braucht.

import {getDb, type ProtokollRow, type User} from './db';
import {hatRecht} from './rechte';
import {fmtDate, fmtDateRange, fmtEuro, fmtTime, hausZeit} from './format';
import {
  AKTIONEN,
  aktionenNachErfassung,
  EINGRIFFE,
  istAktion,
  type Erfassungsart,
  type ProtokollAktion,
  type ProtokollBereich,
} from './protokoll-arten';

// ---------------------------------------------------------------------------
// Die Kette
// ---------------------------------------------------------------------------

/** Der Anfang der Kette: das, worauf die erste Zeile zeigt. */
export const GENESIS = '0'.repeat(64);

/**
 * Der Inhalt einer Zeile als eine Zeichenkette, aus der der Hash entsteht.
 * Die Reihenfolge der Felder ist Teil des Nachweises und darf sich nie ändern
 * — täte sie es, wäre jede zuvor geschriebene Kette gebrochen, ohne dass etwas
 * manipuliert worden wäre.
 */
function kettenText(row: Omit<ProtokollRow, 'id' | 'hash'>): string {
  return [
    row.vorher_hash,
    row.ts,
    row.akteur_id ?? '',
    row.akteur_name,
    row.akteur_rolle ?? '',
    row.betroffen_id ?? '',
    row.betroffen_name ?? '',
    row.bereich,
    row.aktion,
    row.gegenstand,
    row.datum ?? '',
    row.vorher ?? '',
    row.nachher ?? '',
    row.ergebnis,
    row.meldung ?? '',
  ].join('');
}

function sha256(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text, 'utf8').digest('hex');
}

/**
 * Ortszeit als „JJJJ-MM-TT HH:MM:SS" — dieselbe Zeitrechnung wie im ganzen Haus.
 *
 * „Ortszeit" heißt die Hauszeitzone, nicht die des Prozesses: sonst stünde im
 * Protokoll eine andere Stunde als in der Stempelung, die es beurkundet.
 */
function jetztStempel(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  const {datum, stunde, minute, sekunde} = hausZeit(now);
  return `${datum} ${p(stunde)}:${p(minute)}:${p(sekunde)}`;
}

// ---------------------------------------------------------------------------
// Schreiben
// ---------------------------------------------------------------------------

export interface ProtokollEingabe {
  /** Wer gehandelt hat. `null` nur, wenn niemand angemeldet war (Fehlanmeldung). */
  akteur: Pick<User, 'id' | 'name' | 'role'> | null;
  aktion: ProtokollAktion;
  /** Der Gegenstand in einem Satz Deutsch. */
  gegenstand: string;
  /**
   * Wessen Datensatz berührt wurde.
   *
   * Weggelassen (`undefined`) heißt „dieselbe Person, die handelt" — der
   * Regelfall beim Stempeln. Ausdrückliches `null` heißt „niemanden im
   * Besonderen": eine Änderung an den Einstellungen betrifft das Haus, nicht
   * die Administratorin, und darf in ihrem eigenen Protokoll nicht als
   * „betrifft Sie" erscheinen.
   */
  betroffen?: {id: number; name: string} | null;
  /** Der Geschäftstag oder -monat, um den es ging (JJJJ-MM-TT oder JJJJ-MM). */
  datum?: string | null;
  /** Zustand vorher/nachher, mit deutschen Feldnamen als Schlüssel. */
  vorher?: Record<string, string | number | null | undefined> | null;
  nachher?: Record<string, string | number | null | undefined> | null;
  /**
   * Die deutsche Meldung, wenn die Handlung abgewiesen wurde. Gescheiterte
   * Versuche stehen mit im Protokoll: „wer hat versucht, den gesperrten Monat
   * zu ändern" ist genau die Frage, wegen der es eines gibt.
   */
  fehler?: string | null;
  /** Name statt Anmeldename, wenn niemand angemeldet war. */
  akteurName?: string;
}

function saeubere(
  werte: Record<string, string | number | null | undefined> | null | undefined,
): string | null {
  if (!werte) return null;
  const gefiltert = Object.entries(werte).filter(([, v]) => v !== undefined && v !== null && v !== '');
  if (gefiltert.length === 0) return null;
  return JSON.stringify(Object.fromEntries(gefiltert));
}

/**
 * Eine Zeile schreiben. Läuft in einer Transaktion, weil der Hash der Vorgängerin
 * gelesen und die neue Zeile geschrieben werden muss, ohne dass dazwischen eine
 * zweite Zeile entsteht — sonst hingen zwei Glieder an derselben Stelle.
 *
 * Wirft nie. Ein Protokoll, das eine Buchung scheitern lässt, weil es selbst
 * nicht schreiben konnte, richtet mehr Schaden an als der fehlende Eintrag —
 * die Zeit wäre dann gar nicht erfasst. Ein Fehlschlag landet auf der Konsole
 * und hinterlässt eine Lücke, die die Kettenprüfung ohnehin findet.
 */
export function protokolliere(eingabe: ProtokollEingabe): void {
  try {
    const db = getDb();
    const art = AKTIONEN[eingabe.aktion];
    db.transaction(() => {
      const letzte = db
        .query<{hash: string}, []>('SELECT hash FROM protokoll ORDER BY id DESC LIMIT 1')
        .get();
      const inhalt: Omit<ProtokollRow, 'id' | 'hash'> = {
        ts: jetztStempel(),
        akteur_id: eingabe.akteur?.id ?? null,
        akteur_name: eingabe.akteur?.name ?? eingabe.akteurName ?? 'Unbekannt',
        akteur_rolle: eingabe.akteur?.role ?? null,
        // `undefined` fällt auf die handelnde Person zurück, `null` nicht —
        // siehe die Erläuterung an `ProtokollEingabe.betroffen`.
        betroffen_id: eingabe.betroffen === undefined ? eingabe.akteur?.id ?? null : eingabe.betroffen?.id ?? null,
        betroffen_name:
          eingabe.betroffen === undefined ? eingabe.akteur?.name ?? null : eingabe.betroffen?.name ?? null,
        bereich: art.bereich,
        aktion: eingabe.aktion,
        gegenstand: eingabe.gegenstand,
        datum: eingabe.datum ?? null,
        vorher: saeubere(eingabe.vorher),
        nachher: saeubere(eingabe.nachher),
        ergebnis: eingabe.fehler ? 'fehler' : 'ok',
        meldung: eingabe.fehler ?? null,
        vorher_hash: letzte?.hash ?? GENESIS,
      };
      db.query(
        `INSERT INTO protokoll (ts, akteur_id, akteur_name, akteur_rolle, betroffen_id, betroffen_name,
           bereich, aktion, gegenstand, datum, vorher, nachher, ergebnis, meldung, vorher_hash, hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        inhalt.ts,
        inhalt.akteur_id,
        inhalt.akteur_name,
        inhalt.akteur_rolle,
        inhalt.betroffen_id,
        inhalt.betroffen_name,
        inhalt.bereich,
        inhalt.aktion,
        inhalt.gegenstand,
        inhalt.datum,
        inhalt.vorher,
        inhalt.nachher,
        inhalt.ergebnis,
        inhalt.meldung,
        inhalt.vorher_hash,
        sha256(kettenText(inhalt)),
      );
    })();
  } catch (fehler) {
    console.error('Protokoll konnte nicht geschrieben werden:', fehler);
  }
}

// ---------------------------------------------------------------------------
// Lesen
// ---------------------------------------------------------------------------

export interface ProtokollFilter {
  /** Zeitraum über den Zeitpunkt der Handlung, nicht über den Geschäftstag. */
  vonISO?: string;
  bisISO?: string;
  akteurId?: number | null;
  betroffenId?: number | null;
  bereich?: ProtokollBereich | null;
  /** Nur Eingriffe — die Vorauswahl. `false` zeigt auch die Routine. */
  nurEingriffe?: boolean;
  /** Nur, was abgewiesen wurde. */
  nurFehler?: boolean;
  /**
   * Nur Zeilen, deren Zeit auf diesem Weg in den Datensatz kam. `'nachgetragen'`
   * ist die Frage, die eine Betriebsprüfung stellt: **welche Stunden hat
   * niemand gestempelt, sondern jemand eingetragen?**
   *
   * Zeilen ohne Erfassungsart (eine Genehmigung, eine Einstellung) fallen
   * dabei heraus — und das ist richtig: gefragt ist nach erfasster Zeit, nicht
   * nach allem, was am selben Tag geschah.
   */
  erfassung?: Erfassungsart | null;
  /** Freitext über Gegenstand, Handelnde und Betroffene. */
  suche?: string | null;
  sortierung?: 'neu' | 'alt';
  limit?: number;
  offset?: number;
  /**
   * Beschränkt die Sicht auf das, was diese Person sehen darf. Die Verwaltung
   * sieht alles; ein Mitarbeiter sieht **den eigenen Datensatz** — die Auskunft
   * nach Art. 15 DSGVO und die Grundlage dafür, einer Korrektur zu
   * widersprechen.
   *
   * Der Zuschnitt geht ausdrücklich über `betroffen_id` und **nicht** über
   * „betrifft mich ODER ich habe es getan". Der zweite Zweig war ein Leck: das
   * Protokoll schreibt auch den *abgewiesenen* Versuch, und die Beschreibung
   * des Gegenstands wird gelesen, bevor die Domäne die Berechtigung prüft (sie
   * muss es — hinterher gibt es den Datensatz womöglich nicht mehr). Wer also
   * das Löschen einer fremden Krankmeldung versuchte, bekam „Keine
   * Berechtigung." zurück und fand die Spanne samt Art anschließend im eigenen
   * Protokoll wieder. Bei fortlaufenden Kennungen war damit die ganze
   * Belegschaft abfragbar.
   *
   * Der eigene Fußabdruck geht dadurch nicht verloren: was jemand am eigenen
   * Datensatz tut, trägt ohnehin die eigene Kennung in `betroffen_id`. Was er
   * an einem fremden versucht hat, sieht die Verwaltung — und die soll es auch
   * sehen.
   */
  sichtbarFuer?: Pick<User, 'id' | 'role' | 'rechte'>;
}

interface Bedingungen {
  wo: string;
  werte: (string | number)[];
}

function bedingungen(f: ProtokollFilter): Bedingungen {
  const teile: string[] = [];
  const werte: (string | number)[] = [];

  if (f.sichtbarFuer && !hatRecht(f.sichtbarFuer, 'protokoll.alle')) {
    teile.push('betroffen_id = ?');
    werte.push(f.sichtbarFuer.id);
  }
  if (f.vonISO) {
    teile.push('ts >= ?');
    werte.push(`${f.vonISO} 00:00:00`);
  }
  if (f.bisISO) {
    teile.push('ts <= ?');
    werte.push(`${f.bisISO} 23:59:59`);
  }
  if (f.akteurId != null) {
    teile.push('akteur_id = ?');
    werte.push(f.akteurId);
  }
  if (f.betroffenId != null) {
    teile.push('betroffen_id = ?');
    werte.push(f.betroffenId);
  }
  if (f.bereich) {
    teile.push('bereich = ?');
    werte.push(f.bereich);
  }
  if (f.nurEingriffe) {
    teile.push(`aktion IN (${EINGRIFFE.map(() => '?').join(', ')})`);
    werte.push(...EINGRIFFE);
  }
  if (f.erfassung) {
    const aktionen = aktionenNachErfassung(f.erfassung);
    // Eine leere Menge müsste `aktion IN ()` erzeugen — in SQLite ein
    // Syntaxfehler, und ein Filter, der die Seite zerlegt, statt nichts zu
    // finden, wäre der schlechteste beider Ausgänge.
    if (aktionen.length === 0) teile.push('0');
    else {
      teile.push(`aktion IN (${aktionen.map(() => '?').join(', ')})`);
      werte.push(...aktionen);
    }
  }
  if (f.nurFehler) {
    teile.push(`ergebnis = 'fehler'`);
  }
  if (f.suche && f.suche.trim() !== '') {
    // LIKE mit ESCAPE, damit ein getipptes % nicht zum Platzhalter wird.
    const muster = `%${f.suche.trim().replace(/[\\%_]/g, (z) => `\\${z}`)}%`;
    teile.push(
      `(gegenstand LIKE ? ESCAPE '\\' OR akteur_name LIKE ? ESCAPE '\\' OR betroffen_name LIKE ? ESCAPE '\\')`,
    );
    werte.push(muster, muster, muster);
  }

  return {wo: teile.length > 0 ? `WHERE ${teile.join(' AND ')}` : '', werte};
}

export interface ProtokollSeite {
  eintraege: ProtokollRow[];
  /** Wie viele es unter diesen Filtern insgesamt gibt — für das Blättern. */
  gesamt: number;
}

export function protokollSeite(f: ProtokollFilter): ProtokollSeite {
  const db = getDb();
  const {wo, werte} = bedingungen(f);
  const richtung = f.sortierung === 'alt' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(f.limit ?? 50, 1), 500);
  const offset = Math.max(f.offset ?? 0, 0);

  const gesamt =
    db.query<{n: number}, (string | number)[]>(`SELECT count(*) AS n FROM protokoll ${wo}`).get(...werte)?.n ?? 0;
  const eintraege = db
    .query<ProtokollRow, (string | number)[]>(
      // Zweiter Schlüssel `id`: zwei Handlungen in derselben Sekunde sind bei
      // fünfzig Leuten keine Seltenheit, und eine Reihenfolge, die zwischen
      // zwei Aufrufen wechselt, macht das Blättern unbrauchbar.
      `SELECT * FROM protokoll ${wo} ORDER BY ts ${richtung}, id ${richtung} LIMIT ? OFFSET ?`,
    )
    .all(...werte, limit, offset);
  return {eintraege, gesamt};
}

export interface TagesZahl {
  datum: string;
  routine: number;
  eingriffe: number;
  fehler: number;
}

/**
 * Wie viel an welchem Tag geschah — die Zahlenreihe hinter dem Band über der
 * Liste. Ein Ausschlag ist dort selbst die Auskunft: vierzig Korrekturen an
 * einem 31. sind eine Geschichte, die keine Zeile für sich erzählt.
 */
export function protokollProTag(f: ProtokollFilter): TagesZahl[] {
  const {wo, werte} = bedingungen({...f, nurEingriffe: false});
  const rows = getDb()
    .query<{datum: string; aktion: string; ergebnis: string; n: number}, (string | number)[]>(
      // Gruppiert wird über den Ausdruck, nicht über den Aliasnamen: `datum`
      // ist auch eine echte Spalte dieser Tabelle (der Geschäftstag), und
      // SQLite bindet den Bezeichner in GROUP BY an die Spalte, nicht an das
      // AS. Das Band zählte damit nach Geschäftstag statt nach dem Zeitpunkt
      // der Handlung — und alle Zeilen ohne Geschäftstag (An-/Abmelden,
      // Stammdaten, Einstellungen) fielen in einen einzigen Topf.
      `SELECT substr(ts, 1, 10) AS datum, aktion, ergebnis, count(*) AS n
       FROM protokoll ${wo} GROUP BY substr(ts, 1, 10), aktion, ergebnis`,
    )
    .all(...werte);

  const proTag = new Map<string, TagesZahl>();
  for (const r of rows) {
    const eintrag = proTag.get(r.datum) ?? {datum: r.datum, routine: 0, eingriffe: 0, fehler: 0};
    if (r.ergebnis === 'fehler') eintrag.fehler += r.n;
    else if (istAktion(r.aktion) && AKTIONEN[r.aktion].eingriff) eintrag.eingriffe += r.n;
    else eintrag.routine += r.n;
    proTag.set(r.datum, eintrag);
  }
  return [...proTag.values()].sort((a, b) => a.datum.localeCompare(b.datum));
}

/** Wer im Protokoll überhaupt vorkommt — die Auswahl der beiden Filterlisten. */
export function protokollBeteiligte(f: Pick<ProtokollFilter, 'sichtbarFuer'>): {
  akteure: Array<{id: number; name: string}>;
  betroffene: Array<{id: number; name: string}>;
} {
  const db = getDb();
  const {wo, werte} = bedingungen(f);
  // Nach der Kennung gruppiert und nicht `DISTINCT` über beide Spalten: der
  // Name ist je Zeile eingefroren, eine umbenannte Person stünde sonst zweimal
  // in der Auswahlliste. `max(p.id)` neben den nackten Spalten ist SQLites
  // zugesicherte Redewendung dafür, den Namen aus der *jüngsten* Zeile der
  // Gruppe zu nehmen — der zuletzt geführte Name gewinnt.
  const lies = (idSpalte: string, nameSpalte: string) =>
    db
      .query<{id: number; name: string; letzte: number}, (string | number)[]>(
        `SELECT ${idSpalte} AS id, ${nameSpalte} AS name, max(p.id) AS letzte
         FROM protokoll p ${wo} ${wo ? 'AND' : 'WHERE'} ${idSpalte} IS NOT NULL
         GROUP BY ${idSpalte} ORDER BY name`,
      )
      .all(...werte)
      .map(({id, name}) => ({id, name}));
  return {akteure: lies('akteur_id', 'akteur_name'), betroffene: lies('betroffen_id', 'betroffen_name')};
}

// ---------------------------------------------------------------------------
// Die Prüfung
// ---------------------------------------------------------------------------

export interface Kettenbefund {
  geprueft: number;
  /** `true`, wenn jede Zeile ihren eigenen Inhalt und ihre Vorgängerin bestätigt. */
  heil: boolean;
  /** Die Zeile, an der es zuerst nicht mehr stimmt. */
  ersterBruch: {id: number; ts: string; grund: string} | null;
}

/**
 * Die Kette nachrechnen. Das ist der Teil, der aus der Behauptung
 * „unveränderbar" einen überprüfbaren Satz macht: die Trigger halten die
 * Anwendung ab, die Kette überführt jeden, der an ihnen vorbei geht.
 *
 * Zwei Arten von Bruch werden unterschieden, weil sie Verschiedenes bedeuten:
 * ein falscher Eigen-Hash heißt, der Inhalt der Zeile wurde geändert; ein
 * falscher Vorgänger-Hash heißt, davor wurde eine Zeile entfernt oder
 * eingeschoben.
 */
export function protokollPruefen(): Kettenbefund {
  const rows = getDb().query<ProtokollRow, []>('SELECT * FROM protokoll ORDER BY id').all();
  let vorher = GENESIS;
  for (const row of rows) {
    if (row.vorher_hash !== vorher) {
      return {
        geprueft: rows.length,
        heil: false,
        ersterBruch: {id: row.id, ts: row.ts, grund: 'Die Zeile schließt nicht an ihre Vorgängerin an.'},
      };
    }
    const {id: _id, hash, ...inhalt} = row;
    if (sha256(kettenText(inhalt)) !== hash) {
      return {
        geprueft: rows.length,
        heil: false,
        ersterBruch: {id: row.id, ts: row.ts, grund: 'Der Inhalt der Zeile stimmt nicht mehr mit ihrem Siegel überein.'},
      };
    }
    vorher = hash;
  }
  return {geprueft: rows.length, heil: true, ersterBruch: null};
}

// ---------------------------------------------------------------------------
// Gegenstände beschreiben
// ---------------------------------------------------------------------------
//
// Was im Protokoll steht, muss ohne die Anwendung lesbar sein: „Eintrag Mi.,
// 12.8., 08:00–16:30" statt „segment 4711". Die Beschreibung wird deshalb vor
// der Änderung gelesen und als Text eingefroren — ein Verweis auf eine Zeile,
// die es hinterher nicht mehr gibt, beschreibt nichts.
//
// Alle Abfragen hier sind absichtlich klein und direkt: dieses Modul soll
// nicht von lib/time.ts oder lib/spesen.ts abhängen.

export interface Gegenstand {
  text: string;
  betroffen: {id: number; name: string} | null;
  datum: string | null;
  werte: Record<string, string | number | null> | null;
}

function person(userId: number | null | undefined): {id: number; name: string} | null {
  if (userId == null) return null;
  const row = getDb().query<{id: number; name: string}, [number]>('SELECT id, name FROM users WHERE id = ?').get(userId);
  return row ?? null;
}

export function beschreibePerson(userId: number): {id: number; name: string} | null {
  return person(userId);
}

const SEGMENT_ART: Record<string, string> = {arbeit: 'Arbeit', pause: 'Pause'};

export function beschreibeSegment(segmentId: number): Gegenstand | null {
  const row = getDb()
    .query<
      {user_id: number; date: string; kind: string; start_min: number; end_min: number | null; note: string | null},
      [number]
    >('SELECT user_id, date, kind, start_min, end_min, note FROM segments WHERE id = ?')
    .get(segmentId);
  if (!row) return null;
  const spanne = `${fmtTime(row.start_min)}–${row.end_min === null ? 'offen' : fmtTime(row.end_min)}`;
  return {
    text: `${SEGMENT_ART[row.kind] ?? row.kind} am ${fmtDate(row.date)}, ${spanne}`,
    betroffen: person(row.user_id),
    datum: row.date,
    werte: {
      Art: SEGMENT_ART[row.kind] ?? row.kind,
      Beginn: fmtTime(row.start_min),
      Ende: row.end_min === null ? 'offen' : fmtTime(row.end_min),
      Notiz: row.note,
    },
  };
}

export function beschreibeAbwesenheit(id: number): Gegenstand | null {
  const row = getDb()
    .query<
      {
        user_id: number;
        von: string;
        bis: string;
        art: string;
        status: string;
        notiz: string | null;
        minuten: number | null;
        ruecksprache_vorgesetzte: number;
      },
      [number]
    >(
      `SELECT user_id, von, bis, art, status, notiz, minuten, ruecksprache_vorgesetzte
       FROM abwesenheiten WHERE id = ?`,
    )
    .get(id);
  if (!row) return null;
  const art = row.art.charAt(0).toUpperCase() + row.art.slice(1);
  return {
    text: `${art} ${fmtDateRange(row.von, row.bis)}`,
    betroffen: person(row.user_id),
    datum: row.von,
    werte: {
      Art: art,
      Von: fmtDate(row.von),
      Bis: fmtDate(row.bis),
      Status: row.status,
      Notiz: row.notiz,
      Umfang: row.minuten !== null ? `${row.minuten} Min.` : null,
      Rücksprache: row.ruecksprache_vorgesetzte === 1 ? 'bestätigt' : 'nein',
    },
  };
}

export function beschreibeReise(id: number): Gegenstand | null {
  const row = getDb()
    .query<
      {user_id: number; start_date: string; end_date: string; zweck: string; ziel: string | null; status: string},
      [number]
    >('SELECT user_id, start_date, end_date, zweck, ziel, status FROM reisen WHERE id = ?')
    .get(id);
  if (!row) return null;
  return {
    text: `Reise ${fmtDateRange(row.start_date, row.end_date)}${row.ziel ? ` nach ${row.ziel}` : ''}`,
    betroffen: person(row.user_id),
    datum: row.start_date,
    werte: {
      Zweck: row.zweck,
      Ziel: row.ziel,
      Von: fmtDate(row.start_date),
      Bis: fmtDate(row.end_date),
      Status: row.status,
    },
  };
}

export function beschreibeBeleg(belegId: number): Gegenstand | null {
  const row = getDb()
    .query<
      {
        art: string;
        datum: string;
        betrag_cent: number;
        beschreibung: string | null;
        datei_name: string | null;
        user_id: number;
        start_date: string;
      },
      [number]
    >(
      `SELECT b.art, b.datum, b.betrag_cent, b.beschreibung, b.datei_name, r.user_id, r.start_date
       FROM reise_belege b JOIN reisen r ON r.id = b.reise_id WHERE b.id = ?`,
    )
    .get(belegId);
  if (!row) return null;
  return {
    text: `Beleg ${fmtEuro(row.betrag_cent)} vom ${fmtDate(row.datum)}`,
    betroffen: person(row.user_id),
    datum: row.datum,
    werte: {
      Art: row.art,
      Datum: fmtDate(row.datum),
      Betrag: fmtEuro(row.betrag_cent),
      Beschreibung: row.beschreibung,
      Datei: row.datei_name,
    },
  };
}
