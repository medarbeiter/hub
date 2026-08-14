import {afterEach, beforeEach, describe, expect, test} from 'bun:test';
import type {Database} from 'bun:sqlite';
import {createDb, setDbForTesting} from '../lib/db';
import {
  anrede,
  empfaengerMitRecht,
  inhaltAbwesenheitEingereicht,
  inhaltAbwesenheitEntschieden,
  inhaltAbwesenheitGemeldet,
  inhaltMonatAbgeschlossen,
  inhaltPasswortZurueckgesetzt,
  inhaltReiseEingereicht,
  inhaltReiseEntschieden,
  inhaltWillkommen,
  willEmpfangen,
} from '../lib/benachrichtigungen';
import {abbestellteArten, setzeAbbestellteArten} from '../lib/users';
import {
  ABWAEHLBARE_ARTEN,
  ALLE_MAIL_ARTEN,
  MAIL_ARTEN,
  istMailArt,
  mailArtLabel,
} from '../lib/mail-arten';
import {absenderAdresse, mailAktiv, setSetting} from '../lib/settings';
import {alsText} from '../emails/text';

let db: Database;

beforeEach(() => {
  db = createDb(':memory:');
  setDbForTesting(db);
});

afterEach(() => {
  setDbForTesting(undefined);
  db.close();
});

function anlegen(name: string, email: string, role: string, rechte: string[] = [], aktiv = 1): number {
  db.query('INSERT INTO users (email, password_hash, name, role, active) VALUES (?, ?, ?, ?, ?)')
    .run(email, 'x', name, role, aktiv);
  const id = db.query<{id: number}, [string]>('SELECT id FROM users WHERE email = ?').get(email)!.id;
  for (const recht of rechte) {
    db.query('INSERT INTO benutzer_rechte (user_id, recht) VALUES (?, ?)').run(id, recht);
  }
  return id;
}

// ---------------------------------------------------------------------------
// Das Vokabular
// ---------------------------------------------------------------------------

describe('das Nachrichten-Vokabular', () => {
  test('jede Art trägt einen deutschen Namen und eine Beschreibung', () => {
    for (const art of ALLE_MAIL_ARTEN) {
      expect(MAIL_ARTEN[art].label.length).toBeGreaterThan(0);
      expect(MAIL_ARTEN[art].beschreibung.length).toBeGreaterThan(0);
      expect(mailArtLabel(art)).toBe(MAIL_ARTEN[art].label);
    }
  });

  test('ein unbekannter Schlüssel behält sich selbst', () => {
    expect(istMailArt('gibt.es.nicht')).toBe(false);
    expect(istMailArt(undefined)).toBe(false);
    expect(mailArtLabel('gibt.es.nicht')).toBe('gibt.es.nicht');
  });

  test('Zugangspost lässt sich nicht abbestellen', () => {
    // Die einzige Nachricht, die jemanden VOR der ersten Anmeldung erreichen
    // kann. Ein Schalter dagegen spielte den Zugang gegen sich selbst aus.
    expect(ABWAEHLBARE_ARTEN).not.toContain('zugang.willkommen');
    expect(ABWAEHLBARE_ARTEN).not.toContain('zugang.passwort');
    expect(ABWAEHLBARE_ARTEN.length).toBe(ALLE_MAIL_ARTEN.length - 2);
  });
});

// ---------------------------------------------------------------------------
// Empfänger und Abbestellung
// ---------------------------------------------------------------------------

describe('wer eine Nachricht bekommt', () => {
  test('der Prüfkreis kommt aus dem Recht, nicht aus der Rolle', () => {
    anlegen('Anna Berger', 'anna@t.de', 'mitarbeiter');
    const chef = anlegen('Jessica Peneva', 'chef@t.de', 'verwaltung');
    // Ein Mitarbeiterkonto mit dem Zusatzrecht gehört genauso dazu — genau
    // dafür gibt es das Rechtevokabular.
    const stellvertretung = anlegen('Ben Kraus', 'ben@t.de', 'mitarbeiter', ['abwesenheit.pruefen']);

    const kreis = empfaengerMitRecht('abwesenheit.pruefen').map((e) => e.id);
    expect(kreis).toContain(chef);
    expect(kreis).toContain(stellvertretung);
    expect(kreis.length).toBe(2);
  });

  test('niemand bekommt Post über sich selbst', () => {
    const chef = anlegen('Jessica Peneva', 'chef@t.de', 'verwaltung');
    anlegen('Ben Kraus', 'ben@t.de', 'mitarbeiter', ['abwesenheit.pruefen']);
    // Reicht die Verwaltung ihren eigenen Urlaub ein, wartet nichts auf sie.
    expect(empfaengerMitRecht('abwesenheit.pruefen', chef).map((e) => e.id)).not.toContain(chef);
  });

  test('ein gesperrtes Konto bekommt nichts mehr', () => {
    anlegen('Alt Verwalter', 'alt@t.de', 'verwaltung', [], 0);
    expect(empfaengerMitRecht('abwesenheit.pruefen')).toHaveLength(0);
  });

  test('die Abbestellung gilt nur für abwählbare Arten', () => {
    const id = anlegen('Anna Berger', 'anna@t.de', 'mitarbeiter');
    setzeAbbestellteArten(id, ['monat.abgeschlossen', 'zugang.passwort']);
    // Die Zugangspost fällt still heraus, statt einen Fehler zu erzeugen:
    // ein manipulierter Post soll den Zugang nicht abschalten können.
    expect(abbestellteArten(id)).toEqual(['monat.abgeschlossen']);
  });

  test('abbestellt heißt: bekommt sie nicht — außer bei Zugangspost', () => {
    const empfaenger = {id: 1, name: 'Anna', email: 'anna@t.de', abbestellt: ['monat.abgeschlossen' as const]};
    expect(willEmpfangen(empfaenger, 'monat.abgeschlossen')).toBe(false);
    expect(willEmpfangen(empfaenger, 'abwesenheit.entschieden')).toBe(true);
    expect(willEmpfangen({...empfaenger, abbestellt: []}, 'zugang.passwort')).toBe(true);
  });

  test('gespeichert wird die Abwahl — eine neue Art erreicht darum alle', () => {
    const id = anlegen('Anna Berger', 'anna@t.de', 'mitarbeiter');
    // Ein frisches Konto hat nichts abbestellt und bekommt deshalb auch das,
    // was es zum Zeitpunkt seiner Anlage noch gar nicht gab.
    expect(abbestellteArten(id)).toEqual([]);
    for (const art of ALLE_MAIL_ARTEN) {
      expect(willEmpfangen({id, name: 'Anna', email: 'anna@t.de', abbestellt: []}, art)).toBe(true);
    }
  });

  test('die Anrede ist der Vorname', () => {
    expect(anrede('Anna Berger')).toBe('Anna');
    expect(anrede('  Jessica  Peneva ')).toBe('Jessica');
    expect(anrede('Cher')).toBe('Cher');
  });
});

// ---------------------------------------------------------------------------
// Die Nutzlasten
// ---------------------------------------------------------------------------

const SPANNE = {person: 'Anna Berger', art: 'urlaub' as const, von: '2026-08-24', bis: '2026-09-04'};

function wert(inhalt: {angaben: Array<{label: string; wert: string}>}, label: string): string | undefined {
  return inhalt.angaben.find((a) => a.label === label)?.wert;
}

describe('die Nutzlast eines Antrags', () => {
  test('nennt Person, Zeitraum, Dauer und Ziel', () => {
    const inhalt = inhaltAbwesenheitEingereicht({...SPANNE, anspruchstage: 10});
    expect(inhalt.betreff).toContain('Anna Berger');
    expect(inhalt.ton).toBe('hinweis');
    expect(wert(inhalt, 'Mitarbeiter')).toBe('Anna Berger');
    expect(wert(inhalt, 'Art')).toBe('Urlaub');
    expect(wert(inhalt, 'Dauer')).toBe('12 Tage');
    expect(wert(inhalt, 'Anspruchstage')).toBe('10 Tage');
    expect(inhalt.ziel?.pfad).toBe('/abwesenheit/pruefen');
  });

  test('lässt die Anspruchszeile weg, wo nichts zu buchen ist', () => {
    const inhalt = inhaltAbwesenheitEingereicht({...SPANNE, art: 'freizeitausgleich'});
    // Eine Zahl ohne Bedeutung ist schlimmer als keine Zeile.
    expect(wert(inhalt, 'Anspruchstage')).toBeUndefined();
  });
});

describe('Krank verlässt das Haus nur als „Abwesend"', () => {
  test('weder Betreff noch Angaben nennen die Art', () => {
    const inhalt = inhaltAbwesenheitGemeldet({...SPANNE, art: 'krank'});
    // Art. 9 DSGVO: dieselbe Regel wie im Google-Kalender. Ein Mailversender
    // ist ein fremder Server.
    const alles = JSON.stringify(inhalt);
    expect(alles).not.toContain('Krank');
    expect(alles).not.toContain('krank');
    expect(wert(inhalt, 'Art')).toBe('Abwesend');
    expect(inhalt.nachsatz).toContain('nur im Hub');
  });

  test('eine Notiz zu einer Krankmeldung landet nie in der Nachricht', () => {
    // Das Feld gibt es im Datensatz nicht; die Nutzlast verlässt sich nicht
    // darauf, sondern filtert selbst.
    const inhalt = inhaltAbwesenheitGemeldet({...SPANNE, art: 'krank', notiz: 'Grippe'});
    expect(JSON.stringify(inhalt)).not.toContain('Grippe');
  });

  test('die anderen Arten behalten ihren Namen', () => {
    expect(wert(inhaltAbwesenheitGemeldet({...SPANNE, art: 'fortbildung'}), 'Art')).toBe('Fortbildung');
    expect(wert(inhaltAbwesenheitEingereicht(SPANNE), 'Art')).toBe('Urlaub');
  });
});

describe('die Nutzlast einer Entscheidung', () => {
  test('genehmigt: grüner Ton, Resturlaub, keine Begründungsfläche', () => {
    const inhalt = inhaltAbwesenheitEntschieden({
      ...SPANNE,
      person: undefined,
      genehmigt: true,
      entschiedenVon: 'Jessica Peneva',
      restanspruch: 18,
    });
    expect(inhalt.ton).toBe('erfolg');
    expect(inhalt.betreff).toStartWith('Genehmigt:');
    expect(wert(inhalt, 'Resturlaub')).toBe('18 Tage');
    expect(inhalt.hinweis).toBeNull();
    // In der Post an die betroffene Person wäre „Mitarbeiter: du" Lärm.
    expect(wert(inhalt, 'Mitarbeiter')).toBeUndefined();
  });

  test('zurückgewiesen: warnender Ton und die Begründung in eigener Fläche', () => {
    const inhalt = inhaltAbwesenheitEntschieden({
      ...SPANNE,
      person: undefined,
      genehmigt: false,
      grund: '  In der Woche ist das halbe Team weg.  ',
      entschiedenVon: 'Jessica Peneva',
    });
    expect(inhalt.ton).toBe('warnung');
    expect(inhalt.hinweis?.titel).toBe('Begründung');
    expect(inhalt.hinweis?.text).toBe('In der Woche ist das halbe Team weg.');
  });

  test('eine Selbstgenehmigung wird benannt, nicht verschwiegen', () => {
    const inhalt = inhaltAbwesenheitEntschieden({
      ...SPANNE,
      person: undefined,
      genehmigt: true,
      entschiedenVon: 'Jessica Peneva',
      selbstGenehmigt: true,
    });
    expect(inhalt.nachsatz).toContain('selbst genehmigt');
  });
});

describe('die Nutzlast einer Reise', () => {
  const REISE = {
    zweck: 'Messe Altenpflege',
    ziel: 'Essen',
    von: '2026-07-14',
    bis: '2026-07-16',
    rechnung: {pauschaleCent: 4000, belegeCent: 18950, summeCent: 22950},
    belege: 3,
  };

  test('eingereicht: Betrag und Belegzahl stehen drin, Ziel ist die Prüfliste', () => {
    const inhalt = inhaltReiseEingereicht({...REISE, person: 'Anna Berger'});
    expect(wert(inhalt, 'Summe')).toBe('229,50 €');
    expect(wert(inhalt, 'Belege (3)')).toBe('189,50 €');
    expect(inhalt.ziel?.pfad).toBe('/spesen/pruefen');
  });

  test('die Summe ist die betonte Zeile', () => {
    const inhalt = inhaltReiseEingereicht({...REISE, person: 'Anna Berger'});
    expect(inhalt.angaben.filter((a) => a.betont).map((a) => a.label)).toEqual(['Summe']);
  });

  test('genehmigt: der Betrag steht schon im Betreff', () => {
    const inhalt = inhaltReiseEntschieden({...REISE, genehmigt: true, entschiedenVon: 'Jessica Peneva'});
    expect(inhalt.betreff).toContain('229,50 €');
    expect(inhalt.ton).toBe('erfolg');
  });

  test('ohne Ziel fehlt die Zeile, statt leer dazustehen', () => {
    const inhalt = inhaltReiseEingereicht({...REISE, ziel: null, person: 'Anna Berger'});
    expect(wert(inhalt, 'Ziel')).toBeUndefined();
  });
});

describe('die übrigen Nutzlasten', () => {
  test('der Monatsabschluss nennt Ist, Soll und Saldo mit Vorzeichen', () => {
    const inhalt = inhaltMonatAbgeschlossen({
      monat: '2026-07',
      istMin: 9600,
      sollMin: 9840,
      saldoMin: -240,
      abgeschlossenVon: 'Jessica Peneva',
    });
    expect(inhalt.betreff).toBe('Juli 2026 ist abgeschlossen');
    expect(wert(inhalt, 'Saldo')).toStartWith('−');
    expect(inhalt.ziel?.pfad).toBe('/?ansicht=monat&tag=2026-07-01');
  });

  test('die Willkommensnachricht trägt das Startpasswort in der Hinweisfläche', () => {
    const inhalt = inhaltWillkommen({
      name: 'Anna Berger',
      email: 'anna.berger@firma.de',
      passwort: 'kepa-3nrt-9vqx',
      rolle: 'Mitarbeiter',
      wochenstunden: 40,
    });
    expect(inhalt.hinweis?.text).toBe('kepa-3nrt-9vqx');
    expect(wert(inhalt, 'Anmeldename')).toBe('anna.berger@firma.de');
    expect(inhalt.ziel?.pfad).toBe('/login');
    // Kein Passwort in der Betreffzeile: die steht in jeder Vorschau und in
    // jedem Benachrichtigungsfenster.
    expect(inhalt.betreff).not.toContain('kepa');
  });

  test('das zurückgesetzte Passwort warnt und nennt, wer es tat', () => {
    const inhalt = inhaltPasswortZurueckgesetzt({passwort: 'abcd-efgh-ijkl', zurueckgesetztVon: 'Jessica Peneva'});
    expect(inhalt.ton).toBe('warnung');
    expect(wert(inhalt, 'Zurückgesetzt von')).toBe('Jessica Peneva');
    expect(inhalt.betreff).not.toContain('abcd');
  });
});

// ---------------------------------------------------------------------------
// Die Einstellungen
// ---------------------------------------------------------------------------

describe('die Versandeinstellungen', () => {
  test('der Versand ist ohne Eintrag an', () => {
    expect(mailAktiv()).toBe(true);
    setSetting('mail_aktiv', 'nein');
    expect(mailAktiv()).toBe(false);
  });

  test('ein unbrauchbarer Absender fällt auf die Vorgabe zurück', () => {
    // Eine leere oder kaputte Einstellung darf keine Post verschlucken.
    const vorgabe = absenderAdresse();
    expect(vorgabe).toContain('@');
    setSetting('mail_absender', '   ');
    expect(absenderAdresse()).toBe(vorgabe);
    setSetting('mail_absender', 'ohne At-Zeichen');
    expect(absenderAdresse()).toBe(vorgabe);
    setSetting('mail_absender', 'MedArbeiter Hub <zeit@firma.de>');
    expect(absenderAdresse()).toBe('MedArbeiter Hub <zeit@firma.de>');
  });
});

// ---------------------------------------------------------------------------
// Die Nur-Text-Fassung
// ---------------------------------------------------------------------------

describe('dieselbe Nachricht als reiner Text', () => {
  const inhalt = inhaltReiseEntschieden({
    zweck: 'Messe Altenpflege',
    ziel: 'Essen',
    von: '2026-07-14',
    bis: '2026-07-16',
    rechnung: {pauschaleCent: 4000, belegeCent: 18950, summeCent: 22950},
    belege: 3,
    genehmigt: true,
    entschiedenVon: 'Sabine Vogel',
  });

  test('Beschriftung und Wert bleiben getrennt', () => {
    // Genau das konnte `toPlainText()` nicht: aus zwei Tabellenzellen wurde
    // „SummeBetrag". Deshalb wird der Text aus der Nutzlast gebaut.
    const text = alsText(inhalt, {anrede: 'Anna', basisUrl: 'https://zeit.firma.de', abwaehlbar: true});
    expect(text).toContain('Summe                   229,50 €');
    expect(text).not.toContain('Summe229,50');
  });

  test('ohne APP_URL steht kein Link in der Nachricht', () => {
    // Ein Link auf localhost wäre schlimmer als keiner.
    const text = alsText(inhalt, {anrede: 'Anna', basisUrl: null, abwaehlbar: true});
    expect(text).not.toContain('http');
    expect(text).toContain('Profil → Persönliche Einstellungen');
  });

  test('nicht abwählbare Post nennt keine Abbestellung', () => {
    const willkommen = inhaltWillkommen({
      name: 'Anna Berger',
      email: 'anna.berger@firma.de',
      passwort: 'kepa-3nrt-9vqx',
      rolle: 'Mitarbeiter',
      wochenstunden: 40,
    });
    const text = alsText(willkommen, {anrede: 'Anna', basisUrl: null, abwaehlbar: false});
    expect(text).not.toContain('abbestellen');
    // Das Startpasswort steht im Text, aber getrennt vom Fließtext.
    expect(text).toContain('Startpasswort:\n  kepa-3nrt-9vqx');
  });
});
