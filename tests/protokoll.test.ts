import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import {Database} from 'bun:sqlite';
import {createDb, setDbForTesting, type User} from '../lib/db';
import {
  GENESIS,
  protokollBeteiligte,
  protokolliere,
  protokollProTag,
  protokollPruefen,
  protokollSeite,
} from '../lib/protokoll';
import {
  AKTIONEN,
  aktionLabel,
  aktionenNachErfassung,
  EINGRIFFE,
  erfassungsart,
  ERFASSUNGSARTEN,
  ERFASSUNG_ERKLAERUNG,
  ERFASSUNG_LABEL,
  istEingriff,
  PROTOKOLL_BEREICHE,
} from '../lib/protokoll-arten';

let db: Database;

const ANNA: Pick<User, 'id' | 'name' | 'role'> = {id: 1, name: 'Anna Berger', role: 'verwaltung'};
const BERT: Pick<User, 'id' | 'name' | 'role'> = {id: 2, name: 'Bert Klein', role: 'mitarbeiter'};

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('a@x.example','h','Anna Berger','verwaltung')").run();
  db.query("INSERT INTO users (email, password_hash, name, role) VALUES ('b@x.example','h','Bert Klein','mitarbeiter')").run();
});

afterEach(() => {
  setDbForTesting(undefined);
  db.close();
});

/** Eine gewöhnliche Korrektur der Verwaltung an Berts Zeiten. */
function korrektur() {
  protokolliere({
    akteur: ANNA,
    aktion: 'eintrag.aendern',
    gegenstand: 'Arbeit am 5.8.2026, 08:00–16:30',
    betroffen: {id: 2, name: 'Bert Klein'},
    datum: '2026-08-05',
    vorher: {Ende: '16:30'},
    nachher: {Ende: '17:15'},
  });
}

describe('Das Vokabular', () => {
  test('jede Aktion hat einen deutschen Namen und einen bekannten Bereich', () => {
    for (const [schluessel, art] of Object.entries(AKTIONEN)) {
      expect(art.label.length).toBeGreaterThan(0);
      // Kein Schlüssel, der versehentlich als Beschriftung durchrutscht.
      expect(art.label).not.toBe(schluessel);
      expect(PROTOKOLL_BEREICHE).toContain(art.bereich);
    }
  });

  test('Stempeln und Anmelden sind Routine, alles Nachträgliche ist ein Eingriff', () => {
    expect(istEingriff('stempeln.ein')).toBe(false);
    expect(istEingriff('anmelden')).toBe(false);
    expect(istEingriff('eintrag.aendern')).toBe(true);
    expect(istEingriff('monat.abschliessen')).toBe(true);
    // Eine gescheiterte Anmeldung ist kein Alltag, sondern ein Vorkommnis.
    expect(istEingriff('anmelden.fehlgeschlagen')).toBe(true);
    expect(EINGRIFFE.length).toBeGreaterThan(20);
  });

  test('ein unbekannter Schlüssel behält sich selbst, statt zu verschwinden', () => {
    expect(aktionLabel('gibt.es.nicht')).toBe('gibt.es.nicht');
  });
});

describe('Wie die Zeit in den Datensatz kam', () => {
  test('gestempelt heißt: an der Uhr, zum Ereignis', () => {
    for (const a of ['stempeln.ein', 'stempeln.pause', 'stempeln.fort', 'stempeln.aus'] as const) {
      expect(erfassungsart(a)).toBe('gestempelt');
    }
    // Die 30-Sekunden-Rücknahme ist ein Eingriff, aber kein Nachtrag: sie
    // geschieht an derselben Uhr und behauptet nichts über die Vergangenheit.
    expect(istEingriff('stempeln.rueckgaengig')).toBe(true);
    expect(erfassungsart('stempeln.rueckgaengig')).toBe('gestempelt');
  });

  test('nachgetragen heißt: von Hand für einen vergangenen Zeitpunkt', () => {
    for (const a of [
      'eintrag.anlegen',
      'eintrag.aendern',
      'eintrag.ziehen',
      'eintrag.loeschen',
      'eintrag.bestaetigen',
    ] as const) {
      expect(erfassungsart(a)).toBe('nachgetragen');
    }
  });

  test('das vorläufige Schließen ist weder das eine noch das andere', () => {
    expect(erfassungsart('eintrag.automatisch-geschlossen')).toBe('automatisch');
  });

  test('was keine Zeit erfasst, trägt auch keine Erfassungsart', () => {
    // Sonst stünde „Nachgetragen" an einer Genehmigung — ein Wort, das dort
    // nichts unterscheidet und die Spalte entwertet.
    for (const a of ['anmelden', 'tagesart.setzen', 'abwesenheit.genehmigen', 'einstellungen.aendern'] as const) {
      expect(erfassungsart(a)).toBeNull();
    }
  });

  test('jede Erfassungsart hat einen deutschen Namen und einen ganzen Satz', () => {
    for (const art of ERFASSUNGSARTEN) {
      expect(ERFASSUNG_LABEL[art].length).toBeGreaterThan(0);
      expect(ERFASSUNG_ERKLAERUNG[art].length).toBeGreaterThan(0);
      expect(aktionenNachErfassung(art).length).toBeGreaterThan(0);
    }
  });

  test('jede Zeitaktion trägt eine Erfassungsart', () => {
    // Der Sinn der Regel: eine neue Aktion im Bereich „Arbeitszeit" darf nicht
    // stumm ins Protokoll geraten. `tagesart.setzen` ist die eine Ausnahme —
    // eine Tagesart ist keine erfasste Zeit, sondern eine Einordnung des Tages.
    for (const [schluessel, art] of Object.entries(AKTIONEN)) {
      if (art.bereich !== 'zeit' || schluessel === 'tagesart.setzen') continue;
      expect(erfassungsart(schluessel)).not.toBeNull();
    }
  });

  test('der Filter trennt Gestempeltes von Nachgetragenem', () => {
    protokolliere({akteur: BERT, aktion: 'stempeln.ein', gegenstand: 'Einstempeln um 08:02'});
    korrektur(); // Anna trägt an Berts Eintrag nach
    protokolliere({akteur: ANNA, aktion: 'abwesenheit.genehmigen', gegenstand: 'Urlaub'});

    expect(protokollSeite({erfassung: 'gestempelt'}).eintraege.map((e) => e.aktion)).toEqual(['stempeln.ein']);
    expect(protokollSeite({erfassung: 'nachgetragen'}).eintraege.map((e) => e.aktion)).toEqual(['eintrag.aendern']);
    // Die Genehmigung erfasst keine Zeit und fällt aus beiden Auswahlen heraus.
    expect(protokollSeite({erfassung: 'automatisch'}).gesamt).toBe(0);
  });

  test('der Filter greift auch, wo die Vorauswahl auf Eingriffe stünde', () => {
    // Einstempeln ist Routine. Wer nach „Gestempelt" fragt, will es trotzdem
    // sehen — die Frage selbst ist der Zuschnitt.
    protokolliere({akteur: BERT, aktion: 'stempeln.ein', gegenstand: 'Einstempeln um 08:02'});
    expect(protokollSeite({erfassung: 'gestempelt', nurEingriffe: false}).gesamt).toBe(1);
  });
});

describe('Unveränderbarkeit', () => {
  test('die Datenbank weist ein UPDATE ab', () => {
    korrektur();
    expect(() => db.query("UPDATE protokoll SET gegenstand = 'anders' WHERE id = 1").run()).toThrow(
      /unveränderbar/,
    );
  });

  test('die Datenbank weist ein DELETE ab', () => {
    korrektur();
    expect(() => db.query('DELETE FROM protokoll WHERE id = 1').run()).toThrow(/unveränderbar/);
    expect(protokollSeite({}).gesamt).toBe(1);
  });
});

describe('Die Kette', () => {
  test('die erste Zeile hängt am Anfang, jede weitere an ihrer Vorgängerin', () => {
    korrektur();
    korrektur();
    const {eintraege} = protokollSeite({sortierung: 'alt'});
    expect(eintraege[0]!.vorher_hash).toBe(GENESIS);
    expect(eintraege[1]!.vorher_hash).toBe(eintraege[0]!.hash);
  });

  test('eine unangetastete Kette ist heil', () => {
    for (let i = 0; i < 5; i++) korrektur();
    const befund = protokollPruefen();
    expect(befund.heil).toBe(true);
    expect(befund.geprueft).toBe(5);
    expect(befund.ersterBruch).toBeNull();
  });

  test('ein geänderter Inhalt bricht das Siegel der eigenen Zeile', () => {
    for (let i = 0; i < 3; i++) korrektur();
    // An den Triggern vorbei — genau der Fall, für den die Kette da ist.
    db.exec('DROP TRIGGER protokoll_unveraenderbar');
    db.query("UPDATE protokoll SET gegenstand = 'gefälscht' WHERE id = 2").run();

    const befund = protokollPruefen();
    expect(befund.heil).toBe(false);
    expect(befund.ersterBruch?.id).toBe(2);
    expect(befund.ersterBruch?.grund).toMatch(/Siegel/);
  });

  test('eine entfernte Zeile reißt die Kette an der Lücke', () => {
    for (let i = 0; i < 3; i++) korrektur();
    db.exec('DROP TRIGGER protokoll_unloeschbar');
    db.query('DELETE FROM protokoll WHERE id = 2').run();

    const befund = protokollPruefen();
    expect(befund.heil).toBe(false);
    // Die dritte Zeile zeigt jetzt auf eine Vorgängerin, die es nicht mehr gibt.
    expect(befund.ersterBruch?.id).toBe(3);
    expect(befund.ersterBruch?.grund).toMatch(/Vorgängerin/);
  });

  test('das Protokoll lässt eine Buchung nie scheitern', () => {
    // Auch wenn die Tabelle fehlt: schreiben schlägt still fehl, statt zu werfen.
    db.exec('DROP TRIGGER protokoll_unveraenderbar');
    db.exec('DROP TRIGGER protokoll_unloeschbar');
    db.exec('DROP TABLE protokoll');
    expect(() => korrektur()).not.toThrow();
  });
});

describe('Was gespeichert wird', () => {
  test('ein abgewiesener Versuch steht mit seiner Meldung im Protokoll', () => {
    protokolliere({
      akteur: BERT,
      aktion: 'eintrag.aendern',
      gegenstand: 'Arbeit am 1.7.2026',
      datum: '2026-07-01',
      fehler: 'Dieser Monat ist abgeschlossen.',
    });
    const [zeile] = protokollSeite({}).eintraege;
    expect(zeile!.ergebnis).toBe('fehler');
    expect(zeile!.meldung).toBe('Dieser Monat ist abgeschlossen.');
  });

  test('Name und Rolle sind eingefroren — eine Umbenennung schreibt die Geschichte nicht um', () => {
    korrektur();
    db.query("UPDATE users SET name = 'Anna Neumann' WHERE id = 1").run();
    expect(protokollSeite({}).eintraege[0]!.akteur_name).toBe('Anna Berger');
  });

  test('ohne Betroffenen gilt die handelnde Person als betroffen', () => {
    protokolliere({akteur: BERT, aktion: 'stempeln.ein', gegenstand: 'Einstempeln um 08:02'});
    const [zeile] = protokollSeite({}).eintraege;
    expect(zeile!.betroffen_id).toBe(2);
    expect(zeile!.betroffen_name).toBe('Bert Klein');
  });

  test('leere Werte landen nicht als Rauschen in der Gegenüberstellung', () => {
    protokolliere({
      akteur: ANNA,
      aktion: 'eintrag.anlegen',
      gegenstand: 'Arbeit',
      nachher: {Beginn: '08:00', Notiz: null, Ende: '', Art: 'Arbeit'},
    });
    const werte = JSON.parse(protokollSeite({}).eintraege[0]!.nachher!);
    expect(Object.keys(werte).sort()).toEqual(['Art', 'Beginn']);
  });

  test('eine gescheiterte Anmeldung hält die versuchte Adresse fest, ohne Akteur', () => {
    protokolliere({
      akteur: null,
      akteurName: 'fremd@example.com',
      aktion: 'anmelden.fehlgeschlagen',
      gegenstand: 'Anmeldung an MedArbeiter',
      fehler: 'E-Mail oder Passwort ist falsch.',
    });
    const [zeile] = protokollSeite({}).eintraege;
    expect(zeile!.akteur_id).toBeNull();
    expect(zeile!.akteur_name).toBe('fremd@example.com');
  });
});

describe('Sichtbarkeit', () => {
  beforeEach(() => {
    korrektur(); // Anna ändert Berts Eintrag
    protokolliere({akteur: BERT, aktion: 'stempeln.ein', gegenstand: 'Einstempeln um 08:02'});
    protokolliere({akteur: ANNA, aktion: 'einstellungen.aendern', gegenstand: 'Einstellungen', betroffen: null});
  });

  test('die Verwaltung sieht alles', () => {
    expect(protokollSeite({sichtbarFuer: ANNA}).gesamt).toBe(3);
  });

  test('ein Mitarbeiter sieht den eigenen Datensatz', () => {
    const {eintraege, gesamt} = protokollSeite({sichtbarFuer: BERT});
    expect(gesamt).toBe(2);
    // Die Einstellungsänderung der Verwaltung ist nicht dabei.
    expect(eintraege.map((e) => e.aktion).sort()).toEqual(['eintrag.aendern', 'stempeln.ein']);
  });

  test('ein abgewiesener Griff nach fremden Daten landet NICHT im eigenen Protokoll', () => {
    // Der Kern der Sache: das Protokoll beschreibt den Gegenstand, *bevor* die
    // Domäne die Berechtigung prüft — es muss, denn hinterher gibt es den
    // Datensatz womöglich nicht mehr. Wäre die eigene Sicht „betrifft mich
    // ODER ich habe es getan", könnte man mit fortlaufenden Kennungen die
    // Krankmeldungen der ganzen Belegschaft abfragen, eine abgewiesene
    // Löschung nach der anderen.
    protokolliere({
      akteur: BERT,
      aktion: 'abwesenheit.loeschen',
      gegenstand: 'Krank 10. – 14. August',
      betroffen: {id: 3, name: 'Clara Ohnedies'},
      vorher: {Art: 'Krank', Von: '10.8.2026', Bis: '14.8.2026'},
      fehler: 'Keine Berechtigung.',
    });

    const bertSicht = protokollSeite({sichtbarFuer: BERT}).eintraege;
    expect(bertSicht.some((e) => e.gegenstand.includes('Krank'))).toBe(false);
    expect(bertSicht.some((e) => e.betroffen_name === 'Clara Ohnedies')).toBe(false);

    // Die Verwaltung sieht den Versuch sehr wohl — genau dafür steht er da.
    const verwaltung = protokollSeite({sichtbarFuer: ANNA}).eintraege;
    expect(verwaltung.some((e) => e.gegenstand.includes('Krank') && e.akteur_name === 'Bert Klein')).toBe(true);
  });

  test('ein ausdrückliches `null` heißt „betrifft niemanden", nicht „betrifft mich"', () => {
    protokolliere({
      akteur: ANNA,
      aktion: 'einstellungen.aendern',
      gegenstand: 'Einstellungen der Zeiterfassung',
      betroffen: null,
    });
    const zeile = protokollSeite({}).eintraege[0]!;
    expect(zeile.betroffen_id).toBeNull();
    // Ohne Angabe gilt weiterhin die handelnde Person.
    protokolliere({akteur: ANNA, aktion: 'anmelden', gegenstand: 'Anmeldung'});
    expect(protokollSeite({}).eintraege[0]!.betroffen_id).toBe(1);
  });

  test('die Beteiligtenliste folgt derselben Sicht', () => {
    expect(protokollBeteiligte({sichtbarFuer: BERT}).akteure.map((a) => a.name).sort()).toEqual([
      'Anna Berger',
      'Bert Klein',
    ]);
  });
});

describe('Filter, Sortierung, Blättern', () => {
  beforeEach(() => {
    korrektur();
    protokolliere({akteur: BERT, aktion: 'stempeln.ein', gegenstand: 'Einstempeln um 08:02'});
    protokolliere({akteur: BERT, aktion: 'stempeln.aus', gegenstand: 'Ausstempeln um 17:04'});
    protokolliere({
      akteur: ANNA,
      aktion: 'monat.abschliessen',
      gegenstand: 'Monatsabschluss Juli 2026',
      betroffen: {id: 2, name: 'Bert Klein'},
      datum: '2026-07',
    });
  });

  test('die Vorauswahl zeigt Eingriffe und verschweigt das Stempeln nicht', () => {
    expect(protokollSeite({nurEingriffe: true}).gesamt).toBe(2);
    expect(protokollSeite({nurEingriffe: false}).gesamt).toBe(4);
  });

  test('nach Bereich', () => {
    expect(protokollSeite({bereich: 'abschluss'}).gesamt).toBe(1);
    expect(protokollSeite({bereich: 'zeit', nurEingriffe: false}).gesamt).toBe(3);
  });

  test('nach handelnder und nach betroffener Person', () => {
    expect(protokollSeite({akteurId: 1, nurEingriffe: false}).gesamt).toBe(2);
    expect(protokollSeite({betroffenId: 2, nurEingriffe: false}).gesamt).toBe(4);
  });

  test('Freitext über Gegenstand und Namen', () => {
    expect(protokollSeite({suche: 'Monatsabschluss'}).gesamt).toBe(1);
    expect(protokollSeite({suche: 'Anna', nurEingriffe: false}).gesamt).toBe(2);
    expect(protokollSeite({suche: 'gibtesnicht', nurEingriffe: false}).gesamt).toBe(0);
  });

  test('ein getipptes Prozentzeichen ist ein Zeichen, kein Platzhalter', () => {
    expect(protokollSeite({suche: '%', nurEingriffe: false}).gesamt).toBe(0);
  });

  test('nur abgewiesene Versuche', () => {
    protokolliere({akteur: BERT, aktion: 'eintrag.loeschen', gegenstand: 'Eintrag', fehler: 'Keine Berechtigung.'});
    expect(protokollSeite({nurFehler: true}).gesamt).toBe(1);
  });

  test('die Reihenfolge kehrt sich um, und Blättern überschneidet sich nicht', () => {
    const neu = protokollSeite({nurEingriffe: false, sortierung: 'neu'}).eintraege.map((e) => e.id);
    const alt = protokollSeite({nurEingriffe: false, sortierung: 'alt'}).eintraege.map((e) => e.id);
    expect(neu).toEqual([...alt].reverse());

    const seite1 = protokollSeite({nurEingriffe: false, limit: 2, offset: 0}).eintraege.map((e) => e.id);
    const seite2 = protokollSeite({nurEingriffe: false, limit: 2, offset: 2}).eintraege.map((e) => e.id);
    expect(seite1).toHaveLength(2);
    expect(new Set([...seite1, ...seite2]).size).toBe(4);
  });

  test('die Tageszahlen trennen Routine, Eingriff und Abweisung', () => {
    protokolliere({akteur: BERT, aktion: 'eintrag.loeschen', gegenstand: 'Eintrag', fehler: 'Keine Berechtigung.'});
    const [heute] = protokollProTag({});
    expect(heute!.routine).toBe(2);
    expect(heute!.eingriffe).toBe(2);
    expect(heute!.fehler).toBe(1);
  });

  test('das Band zählt nach dem Tag der Handlung, nicht nach dem Geschäftstag', () => {
    // `datum` ist auch eine echte Spalte (der Geschäftstag). Gruppierte man
    // über den Aliasnamen, bände SQLite ihn an die Spalte: der Monatsabschluss
    // für Juli, heute vorgenommen, landete auf dem 1. Juli — und alle Zeilen
    // ganz ohne Geschäftstag (Anmelden, Stammdaten) in einem einzigen Topf.
    const tage = protokollProTag({});
    expect(tage).toHaveLength(1);
    expect(tage[0]!.datum).toBe(new Date().toISOString().slice(0, 10));
    // Vier Vorgänge dieses Blocks, davon einer mit Geschäftstag „2026-07".
    expect(tage[0]!.routine + tage[0]!.eingriffe + tage[0]!.fehler).toBe(4);
  });
});
