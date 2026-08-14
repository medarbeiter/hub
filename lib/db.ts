import {Database} from 'bun:sqlite';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';

declare global {
  // eslint-disable-next-line no-var
  var __medarbeiterDb: Database | undefined;
  // eslint-disable-next-line no-var
  var __medarbeiterDbSchemaVersion: number | undefined;
}

type Migration = (db: Database) => void;

// Append-only: shipped migrations are never edited, only new ones added.
// Exception: the baseline must stay idempotent (IF NOT EXISTS), because
// databases created before versioning existed sit at user_version 0 and
// replay it as a no-op.
const MIGRATIONS: Migration[] = [
  migration1Baseline,
  migration2Settings,
  migration3AutoClose,
  migration4DayTypes,
  migration5Spesen,
  migration6SpesenSaetze,
  migration7Abwesenheiten,
  migration8Protokoll,
  migration9Onboarding,
  migration10Avatar,
  migration11TemporaryPassword,
  migration12GoogleOauthPreview,
  migration13GoogleOauthForOpenSetup,
  migration14AvatarSet,
  migration15GoogleKonten,
  migration16TotpKonten,
  migration17RollenUndRechte,
  migration18ZugangscodeSichtbarkeit,
  migration19ZugangscodeRollenkreis,
  migration20Mailversand,
  migration21OauthAnbieter,
];

/** The `PRAGMA user_version` a fully migrated database carries. */
export const SCHEMA_VERSION = MIGRATIONS.length;

function migration1Baseline(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('mitarbeiter', 'verwaltung')),
      weekly_minutes INTEGER NOT NULL DEFAULT 2400,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS segments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('arbeit', 'pause')),
      start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
      end_min INTEGER CHECK (end_min > start_min AND end_min <= 1440),
      note TEXT,
      edited_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_segments_user_date ON segments(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_segments_date ON segments(date);

    CREATE TABLE IF NOT EXISTS month_locks (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      month TEXT NOT NULL,
      locked_at TEXT NOT NULL DEFAULT (datetime('now')),
      locked_by INTEGER NOT NULL REFERENCES users(id),
      PRIMARY KEY (user_id, month)
    );
  `);
}

function migration2Settings(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migration3AutoClose(db: Database) {
  // A provisionally closed entry: the cutoff sweep ended it because the
  // clock-out was forgotten. It stays flagged until a human confirms or
  // corrects it — never silently accepted as fact.
  db.exec('ALTER TABLE segments ADD COLUMN auto_closed INTEGER NOT NULL DEFAULT 0');
}

function migration4DayTypes(db: Database) {
  // One day type per employee and day. Public holidays are computed from the
  // Bundesland rather than stored — a row here is only ever a human decision
  // (or a correction of the computed holiday).
  db.exec(`
    CREATE TABLE IF NOT EXISTS day_types (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('urlaub', 'krank', 'feiertag', 'freizeitausgleich', 'fortbildung')),
      note TEXT,
      edited_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, date)
    );
  `);
  // Employees can sit in different states; empty falls back to the company setting.
  db.exec('ALTER TABLE users ADD COLUMN bundesland TEXT');
}

function migration5Spesen(db: Database) {
  // Eine Dienstreise und ihre Belege. Die Verpflegungspauschale selbst wird
  // nirgends gespeichert — sie wird aus der Spanne gerechnet, wie Feiertage aus
  // dem Bundesland. Gespeichert wird nur die Satztabelle, die beim Einreichen
  // galt: sonst änderte eine genehmigte Abrechnung ihren Betrag, sobald die
  // Verwaltung die Sätze fürs nächste Jahr anpasst.
  db.exec(`
    CREATE TABLE IF NOT EXISTS reisen (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      start_date TEXT NOT NULL,
      start_min INTEGER NOT NULL CHECK (start_min >= 0 AND start_min < 1440),
      end_date TEXT NOT NULL,
      end_min INTEGER NOT NULL CHECK (end_min > 0 AND end_min <= 1440),
      zweck TEXT NOT NULL,
      ziel TEXT,
      status TEXT NOT NULL DEFAULT 'entwurf'
        CHECK (status IN ('entwurf', 'eingereicht', 'genehmigt', 'abgelehnt')),
      satz_an_ab_cent INTEGER,
      satz_teiltag_cent INTEGER,
      satz_volltag_cent INTEGER,
      eingereicht_at TEXT,
      entschieden_at TEXT,
      entschieden_von INTEGER REFERENCES users(id),
      entscheidung_notiz TEXT,
      edited_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (end_date >= start_date)
    );
    CREATE INDEX IF NOT EXISTS idx_reisen_user_start ON reisen(user_id, start_date);
    CREATE INDEX IF NOT EXISTS idx_reisen_status ON reisen(status);

    CREATE TABLE IF NOT EXISTS reise_belege (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      reise_id INTEGER NOT NULL REFERENCES reisen(id) ON DELETE CASCADE,
      art TEXT NOT NULL CHECK (art IN ('uebernachtung', 'fahrt', 'parken', 'ticket', 'sonstiges')),
      datum TEXT NOT NULL,
      betrag_cent INTEGER NOT NULL CHECK (betrag_cent > 0),
      beschreibung TEXT,
      datei TEXT,
      datei_name TEXT,
      datei_typ TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reise_belege_reise ON reise_belege(reise_id);
  `);
}

function migration6SpesenSaetze(db: Database) {
  // Die Satztabelle hat nur noch zwei Werte je Stufe: halber Satz (An- und
  // Abreisetag sowie eintägig ab 8 Std.) und voller Satz. Der dritte Wert war
  // immer eine Kopie des halben — er verschwindet, bevor er auseinanderläuft.
  db.exec('ALTER TABLE reisen DROP COLUMN satz_an_ab_cent');
}

function migration7Abwesenheiten(db: Database) {
  // Eine Abwesenheit ist eine Spanne, kein Tag. Niemand nimmt einen einzelnen
  // Urlaubstag — genommen werden zwei Wochen, und vierzehn unabhängige
  // day_types-Zeilen wussten nichts voneinander. Der Datensatz ist damit ein
  // Geschwister der Reise: dieselben vier Zustände, dieselbe Trennung von
  // Eigentümer und Prüfung. Nur die zeitliche Bedingung dreht sich um — eine
  // Reise wird nach der Rückkehr eingereicht, ein Urlaub vorher beantragt.
  //
  // `feiertag` fehlt in der Artenliste mit Absicht: Feiertage kommen aus dem
  // Kalender des Bundeslandes. Sie selbst setzen zu können, war ein Klickweg zu
  // einem erfundenen bezahlten freien Tag.
  //
  // `gemeldet` ist der fünfte Zustand für das, was keine Bitte ist: eine
  // Krankmeldung wird nicht genehmigt, sie wird zur Kenntnis genommen.
  db.exec(`
    CREATE TABLE IF NOT EXISTS abwesenheiten (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      von TEXT NOT NULL,
      bis TEXT NOT NULL,
      art TEXT NOT NULL CHECK (art IN ('urlaub', 'krank', 'freizeitausgleich', 'fortbildung')),
      status TEXT NOT NULL DEFAULT 'entwurf'
        CHECK (status IN ('entwurf', 'eingereicht', 'gemeldet', 'genehmigt', 'abgelehnt')),
      notiz TEXT,
      au_datei TEXT,
      au_datei_name TEXT,
      au_datei_typ TEXT,
      eingereicht_at TEXT,
      entschieden_at TEXT,
      entschieden_von INTEGER REFERENCES users(id),
      entscheidung_notiz TEXT,
      /* Verwaltung genehmigt die eigene Abwesenheit selbst — es gibt keine
         zweite Instanz. Das wird nicht versteckt, sondern protokolliert. */
      selbst_genehmigt INTEGER NOT NULL DEFAULT 0,
      edited_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      CHECK (bis >= von)
    );
    CREATE INDEX IF NOT EXISTS idx_abwesenheiten_user_von ON abwesenheiten(user_id, von);
    CREATE INDEX IF NOT EXISTS idx_abwesenheiten_status ON abwesenheiten(status);

    /* Der Übertrag wird nicht gerechnet, sondern von der Verwaltung je Jahr
       eingetragen: Resturlaub und Verfall folgen Regeln, die kein Zeiterfasser
       kennen kann (Krankheit, Elternzeit, Betriebsvereinbarung). */
    CREATE TABLE IF NOT EXISTS urlaub_uebertrag (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      jahr TEXT NOT NULL,
      tage INTEGER NOT NULL DEFAULT 0,
      edited_by INTEGER REFERENCES users(id),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, jahr)
    );
  `);
  db.exec('ALTER TABLE users ADD COLUMN urlaubstage_jahr INTEGER NOT NULL DEFAULT 30');

  // day_types bleibt bestehen und wird zur Projektion: lib/time.ts,
  // lib/attention.ts und das Zeitkonto lesen weiter Tage und ändern sich nicht.
  // Wer die Zeile geschrieben hat, steht ab jetzt daneben.
  db.exec('ALTER TABLE day_types ADD COLUMN abwesenheit_id INTEGER REFERENCES abwesenheiten(id) ON DELETE CASCADE');

  uebernehmeTagesartenInSpannen(db);
}

function migration9Onboarding(db: Database) {
  // Stammdaten kommen von der Verwaltung, die betroffene Person bestätigt
  // sie aber selbst. Zwei Versionsnummern halten diese Zusage ehrlich: ändert
  // die Verwaltung später Name, Sollzeit oder Urlaub, weichen die Versionen
  // wieder voneinander ab und die Bestätigung erscheint beim nächsten Start.
  db.exec('ALTER TABLE users ADD COLUMN profile_version INTEGER NOT NULL DEFAULT 1');
  db.exec('ALTER TABLE users ADD COLUMN profile_accepted_version INTEGER NOT NULL DEFAULT 0');
  db.exec('ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT');

  // Persönliche Vorlieben sind bewusst am Benutzer gespeichert, nicht als
  // Browserzustand: dieselbe Person bekommt sie an jedem Arbeitsplatz.
  db.exec(
    "ALTER TABLE users ADD COLUMN preferred_view TEXT NOT NULL DEFAULT 'tag' CHECK (preferred_view IN ('tag', 'woche', 'monat', 'konto'))",
  );
  db.exec('ALTER TABLE users ADD COLUMN attention_reminders INTEGER NOT NULL DEFAULT 1');
}

function migration10Avatar(db: Database) {
  // Kein Bild-Upload und keine fremde URL: ein kleiner, lokaler Satz hält die
  // persönliche Wahl auf jedem Arbeitsplatz gleich, ohne neue Personendaten
  // oder einen externen Abruf einzuführen.
  db.exec(
    "ALTER TABLE users ADD COLUMN avatar_key TEXT NOT NULL DEFAULT 'fuchs' CHECK (avatar_key IN ('fuchs', 'capybara', 'eule', 'axolotl', 'waschbaer', 'quokka'))",
  );
}

function migration11TemporaryPassword(db: Database) {
  // Bestehende Konten behalten ihren Zugang. Nur neu ausgestellte Kennwörter
  // sind vorläufig und müssen nach der ersten erfolgreichen Anmeldung ersetzt
  // werden. So wird das einmalig sichtbare Startkennwort nicht zum Dauerpasswort.
  db.exec('ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0');
}

function migration12GoogleOauthPreview(db: Database) {
  // Bestehende Konten werden nicht rückwirkend aufgehalten. Neue Konten
  // durchlaufen die Anbieter-Verknüpfung als expliziten Einrichtungsschritt.
  db.exec('ALTER TABLE users ADD COLUMN google_oauth_mock_completed INTEGER NOT NULL DEFAULT 1');
}

function migration13GoogleOauthForOpenSetup(db: Database) {
  // Wer die Einrichtung noch nicht abgeschlossen hat, soll den neu
  // hinzugekommenen Verknüpfungsschritt tatsächlich sehen. Nur bereits fertig
  // eingerichtete Konten bleiben von der nachträglichen Pflicht verschont.
  db.exec(`
    UPDATE users
    SET google_oauth_mock_completed = 0
    WHERE onboarding_completed_at IS NULL
  `);
}

function migration14AvatarSet(db: Database) {
  // Der alte 3×2-Bogen wird durch zehn einzeln kuratierte, weiterhin lokale
  // Profilfiguren ersetzt. Die Übergangsspalte bewahrt die bisherige Wahl,
  // bevor ihre CHECK-Beschränkung gegen den neuen Satz getauscht wird.
  db.exec(`
    ALTER TABLE users ADD COLUMN avatar_key_neu TEXT NOT NULL DEFAULT 'vertrieb-akquise'
      CHECK (avatar_key_neu IN (
        'vertrieb-akquise', 'marketing', 'geschaeftsfuehrer', 'mercedes-amg-c-eo',
        'key-account-management', 'pflegedienst', 'krankenhaus', 'headset-calling',
        'adler', 'buchhaltung-controlling'
      ));

    UPDATE users
    SET avatar_key_neu = CASE avatar_key
      WHEN 'fuchs' THEN 'vertrieb-akquise'
      WHEN 'capybara' THEN 'pflegedienst'
      WHEN 'eule' THEN 'buchhaltung-controlling'
      WHEN 'axolotl' THEN 'marketing'
      WHEN 'waschbaer' THEN 'key-account-management'
      WHEN 'quokka' THEN 'headset-calling'
      ELSE 'vertrieb-akquise'
    END;

    ALTER TABLE users DROP COLUMN avatar_key;
    ALTER TABLE users RENAME COLUMN avatar_key_neu TO avatar_key;
  `);
}

function migration15GoogleKonten(db: Database) {
  // Aus der Vorschau wird die echte Verknüpfung. Die Spalte am Benutzer sagt
  // nur noch, dass der Einrichtungsschritt durchlaufen wurde — ob das Konto
  // gerade verbunden ist, steht in google_konten, und beides darf
  // auseinanderlaufen (wer später trennt, muss nicht neu durchs Onboarding).
  db.exec('ALTER TABLE users RENAME COLUMN google_oauth_mock_completed TO google_einrichtung_abgeschlossen');

  db.exec(`
    CREATE TABLE IF NOT EXISTS google_konten (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      google_sub TEXT NOT NULL,
      google_email TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      /* Ablauf des Access-Tokens in Millisekunden seit Epoche. */
      token_expiry INTEGER NOT NULL,
      scope TEXT,
      verbunden_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    /* Welche Abwesenheit als welches Ereignis im Google-Kalender steht.
       Bewusst OHNE Fremdschlüssel auf abwesenheiten: §9 BUrlG löscht und
       ersetzt Urlaubszeilen, und genau dann muss der Abgleich die verwaiste
       Ereignis-ID noch finden, um das Ereignis drüben zu entfernen. */
    CREATE TABLE IF NOT EXISTS google_kalender_eintraege (
      abwesenheit_id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id TEXT NOT NULL,
      /* Fingerabdruck des zuletzt Geschriebenen (Titel|von|bis) — nur bei
         Abweichung wird die Google-API überhaupt angefragt. */
      stand TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_google_kalender_user ON google_kalender_eintraege(user_id);
  `);
}

function migration16TotpKonten(db: Database) {
  // Die geteilten Einmalcodes (TOTP, RFC 6238) der gemeinsamen Firmenkonten —
  // der Ersatz für das Büro-Handy, auf dem der Authenticator lag und das dafür
  // durchs Haus gereicht wurde. Hier liegen ausdrücklich nur Geheimnisse von
  // GEMEINSAMEN Konten: für ein privates Konto wäre diese Tabelle der falsche
  // Ort, weil jeder Angemeldete die Codes sieht.
  //
  // Das Geheimnis steht im Klartext — dieselbe Haltung wie bei den
  // Google-Tokens in `google_konten`: die Vertrauensgrenze ist die
  // Datenbankdatei selbst, und ein Schlüssel, der daneben auf derselben Platte
  // läge, wäre eine Tür mit dem Schlüssel im Schloss. Was das Geheimnis nie
  // verlässt, ist der Server: der Browser bekommt nur den fertigen Code
  // (lib/zugangscodes.ts), das Protokoll nur die Tatsache (wie beim Passwort).
  db.exec(`
    CREATE TABLE IF NOT EXISTS totp_konten (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dienst TEXT NOT NULL,
      konto TEXT,
      secret TEXT NOT NULL,
      algorithmus TEXT NOT NULL DEFAULT 'SHA1' CHECK (algorithmus IN ('SHA1', 'SHA256', 'SHA512')),
      stellen INTEGER NOT NULL DEFAULT 6 CHECK (stellen BETWEEN 6 AND 8),
      periode INTEGER NOT NULL DEFAULT 30 CHECK (periode BETWEEN 15 AND 120),
      erstellt_von INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function migration17RollenUndRechte(db: Database) {
  // Aus zwei fest verdrahteten Rollen wird ein Rechtesystem: die Rolle ist nur
  // noch ein vordefiniertes Bündel (lib/rechte.ts), Zusatzrechte je Konto
  // liegen in benutzer_rechte. SQLite kann eine CHECK-Klausel nicht ändern,
  // also wird die users-Tabelle nach dem dokumentierten Zwölf-Schritte-Weg neu
  // aufgebaut (createDb schaltet die Fremdschlüssel erst NACH den Migrationen
  // scharf, sonst scheiterte das DROP an den Kindtabellen). Die Spaltenliste
  // ist der Stand nach Migration 16 — beim INSERT namentlich, damit die
  // historisch gewachsene Reihenfolge egal ist.
  db.exec(`
    CREATE TABLE users_neu (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('mitarbeiter', 'fulfillment', 'vertrieb', 'verwaltung', 'geschaeftsfuehrung')),
      weekly_minutes INTEGER NOT NULL DEFAULT 2400,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      bundesland TEXT,
      urlaubstage_jahr INTEGER NOT NULL DEFAULT 30,
      profile_version INTEGER NOT NULL DEFAULT 1,
      profile_accepted_version INTEGER NOT NULL DEFAULT 0,
      onboarding_completed_at TEXT,
      preferred_view TEXT NOT NULL DEFAULT 'tag' CHECK (preferred_view IN ('tag', 'woche', 'monat', 'konto')),
      attention_reminders INTEGER NOT NULL DEFAULT 1,
      must_change_password INTEGER NOT NULL DEFAULT 0,
      google_einrichtung_abgeschlossen INTEGER NOT NULL DEFAULT 1,
      avatar_key TEXT NOT NULL DEFAULT 'vertrieb-akquise'
        CHECK (avatar_key IN (
          'vertrieb-akquise', 'marketing', 'geschaeftsfuehrer', 'mercedes-amg-c-eo',
          'key-account-management', 'pflegedienst', 'krankenhaus', 'headset-calling',
          'adler', 'buchhaltung-controlling'
        ))
    );

    INSERT INTO users_neu (
      id, email, password_hash, name, role, weekly_minutes, active, created_at,
      bundesland, urlaubstage_jahr, profile_version, profile_accepted_version,
      onboarding_completed_at, preferred_view, attention_reminders,
      must_change_password, google_einrichtung_abgeschlossen, avatar_key
    )
    SELECT
      id, email, password_hash, name, role, weekly_minutes, active, created_at,
      bundesland, urlaubstage_jahr, profile_version, profile_accepted_version,
      onboarding_completed_at, preferred_view, attention_reminders,
      must_change_password, google_einrichtung_abgeschlossen, avatar_key
    FROM users;

    DROP TABLE users;
    ALTER TABLE users_neu RENAME TO users;

    CREATE TABLE IF NOT EXISTS benutzer_rechte (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recht TEXT NOT NULL,
      PRIMARY KEY (user_id, recht)
    );
  `);
}

function migration18ZugangscodeSichtbarkeit(db: Database) {
  // Ein Zugang kann seinen Leserkreis einschränken: alle Angemeldeten
  // (bisheriges Verhalten, Vorgabe), eine Rolle, oder einzelne Personen —
  // „nur für mich" ist der Personenkreis mit genau einem Eintrag. Der Kreis
  // steht am Datensatz, nicht in der Anzeige: die Seite bekommt nur, was der
  // Zuschnitt in lib/zugangscodes.ts hergibt. Wer `zugangscodes.verwalten`
  // trägt, sieht weiterhin jede Zeile — sonst ließe sich ein falsch
  // zugeschnittener Zugang nicht mehr entfernen — und der Kreis steht
  // sichtbar daneben, damit nichts heimlich privat ist.
  db.exec(`
    ALTER TABLE totp_konten ADD COLUMN sichtbarkeit TEXT NOT NULL DEFAULT 'alle'
      CHECK (sichtbarkeit IN ('alle', 'rolle', 'personen'));
    ALTER TABLE totp_konten ADD COLUMN sichtbar_rolle TEXT;

    CREATE TABLE IF NOT EXISTS totp_konto_personen (
      totp_id INTEGER NOT NULL REFERENCES totp_konten(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (totp_id, user_id)
    );
  `);
}

function migration19ZugangscodeRollenkreis(db: Database) {
  // Aus „eine Rolle" wird „Rollen auswählen": der Rollenkreis eines Zugangs
  // wandert aus der einwertigen Spalte in eine Kreis-Tabelle wie bei den
  // Personen. Der Wert 'rolle' in `sichtbarkeit` bleibt derselbe — er heißt
  // jetzt nur: mindestens eine Zeile hier.
  db.exec(`
    CREATE TABLE IF NOT EXISTS totp_konto_rollen (
      totp_id INTEGER NOT NULL REFERENCES totp_konten(id) ON DELETE CASCADE,
      rolle TEXT NOT NULL,
      PRIMARY KEY (totp_id, rolle)
    );

    INSERT INTO totp_konto_rollen (totp_id, rolle)
      SELECT id, sichtbar_rolle FROM totp_konten
      WHERE sichtbarkeit = 'rolle' AND sichtbar_rolle IS NOT NULL;

    ALTER TABLE totp_konten DROP COLUMN sichtbar_rolle;
  `);
}

function migration20Mailversand(db: Database) {
  // Der E-Mail-Versand — das Postausgangsbuch und der Schalter je Konto.
  //
  // Das Buch steht bewusst *nicht* im Protokoll: dessen Kette ist ein Nachweis
  // darüber, was am Datensatz geschah, und eine verschickte Nachricht ändert
  // nichts daran. Es ist auch keine Nachbildung des Protokolls — es ist
  // veränderbar, löschbar und darf beim Aufräumen verschwinden. Was es
  // beantwortet, ist eine Betriebsfrage: „Ist die Genehmigung rausgegangen?"
  //
  // Der Inhalt steht nicht darin, nur Empfänger, Art und Betreff. Ein
  // Startpasswort gehört so wenig ins Versandbuch wie ins Protokoll.
  //
  // `mail_benachrichtigungen` ist die Abbestellung je Konto: eine
  // kommagetrennte Liste der *abgewählten* Arten, nicht der gewählten. So
  // bekommt jede neue Nachrichtenart automatisch alle bisherigen Empfänger,
  // statt still bei niemandem anzukommen, weil sie in keiner Liste stand.
  db.exec(`
    CREATE TABLE IF NOT EXISTS mail_versand (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      /* Ortszeit wie überall im Haus. */
      ts TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
      art TEXT NOT NULL,
      empfaenger TEXT NOT NULL,
      /* Wessen Datensatz die Nachricht betraf; kein Fremdschlüssel, damit ein
         gelöschtes Konto das Buch nicht umschreibt. */
      betrifft_id INTEGER,
      betreff TEXT NOT NULL,
      ergebnis TEXT NOT NULL CHECK (ergebnis IN ('gesendet', 'uebersprungen', 'fehler')),
      meldung TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_mail_versand_ts ON mail_versand(ts);

    ALTER TABLE users ADD COLUMN mail_abbestellt TEXT NOT NULL DEFAULT '';
  `);
}

function migration21OauthAnbieter(db: Database) {
  // MedArbeiter als Anmeldestelle für die anderen Hausanwendungen: statt daß
  // jede App eigene Konten und Passwörter züchtet, holt sie sich hier per
  // OAuth 2.0 (Authorization-Code) die Identität des angemeldeten Nutzers.
  //
  // Drei Tabellen, drei Lebensdauern: die Anbindung (Jahre), der Code
  // (Sekunden, genau eine Einlösung), das Token (eine Stunde). Codes und
  // Tokens stehen nur als SHA-256 ihres Werts hier — nachschlagbar, aber wer
  // die Datenbank liest, kann sich damit nirgends anmelden. Das App-Geheimnis
  // ist ein Passwort und wird wie eines behandelt: Bun.password-Hash, der
  // Klartext wird beim Anlegen genau einmal gezeigt.
  //
  // `eingeloest_at` bleibt nach der Einlösung stehen, statt die Zeile zu
  // löschen: nur so ist eine *zweite* Einlösung als solche erkennbar, und
  // RFC 6749 verlangt dann, die bereits ausgegebenen Tokens zu widerrufen.
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      /* Öffentliche Kennung (crypto.randomUUID()) — steht in fremden Configs. */
      client_id TEXT NOT NULL UNIQUE,
      /* Deutscher Anzeigename der App, taucht im Protokoll auf. */
      name TEXT NOT NULL,
      secret_hash TEXT NOT NULL,
      /* Zeilengetrennte Liste; getroffen wird nur exakt, nie per Präfix. */
      redirect_uris TEXT NOT NULL,
      aktiv INTEGER NOT NULL DEFAULT 1,
      erstellt_von INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );

    CREATE TABLE IF NOT EXISTS oauth_codes (
      code_hash TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      /* Beim Einlösen muß dieselbe URI vorgelegt werden wie beim Ausstellen. */
      redirect_uri TEXT NOT NULL,
      /* Millisekunden seit Epoche, ~60 s nach Ausstellung. */
      expires_at INTEGER NOT NULL,
      eingeloest_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS oauth_tokens (
      token_hash TEXT PRIMARY KEY,
      client_id INTEGER NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
    );
    /* Deaktivierung eines Kontos räumt dessen Tokens ab — der Index trägt das. */
    CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
  `);
}

/**
 * Bestehende Tagesarten in Spannen überführen. Aufeinanderfolgende Tage
 * derselben Art werden zu einer Abwesenheit zusammengezogen; ein Wochenende
 * dazwischen trennt nicht, sonst zerfiele jeder Zweiwochenurlaub in zwei.
 * Gespeicherte `feiertag`-Zeilen bleiben, was sie waren — eine Korrektur des
 * Kalenders, keine Abwesenheit.
 *
 * Exportiert, weil die Laufberechnung der einzige riskante Teil der Migration
 * ist und ein Test sie erreichen können muss — nicht zum Aufruf im Betrieb.
 */
export function uebernehmeTagesartenInSpannen(db: Database) {
  const rows = db
    .query<{user_id: number; date: string; type: string; note: string | null; edited_by: number | null; created_at: string}, []>(
      `SELECT user_id, date, type, note, edited_by, created_at FROM day_types
       WHERE type <> 'feiertag' ORDER BY user_id, type, date`,
    )
    .all();
  if (rows.length === 0) return;

  const tagDanach = (iso: string, tage: number): string => {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + tage);
    return d.toISOString().slice(0, 10);
  };
  /** Der nächste Tag, der die Spanne fortsetzen darf: morgen, Wochenende übersprungen. */
  const setztFort = (vorher: string, jetzt: string): boolean => {
    let kandidat = tagDanach(vorher, 1);
    for (let i = 0; i < 3; i++) {
      if (kandidat === jetzt) return true;
      const wochentag = new Date(`${kandidat}T00:00:00Z`).getUTCDay();
      if (wochentag !== 0 && wochentag !== 6) return false;
      kandidat = tagDanach(kandidat, 1);
    }
    return false;
  };

  const einfuegen = db.query<
    {id: number},
    [number, string, string, string, string, string | null, number | null, number | null, string | null]
  >(
    `INSERT INTO abwesenheiten (user_id, von, bis, art, status, notiz, edited_by, entschieden_von, entschieden_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  );
  const verknuepfen = db.query(
    'UPDATE day_types SET abwesenheit_id = ? WHERE user_id = ? AND date >= ? AND date <= ? AND type = ?',
  );

  let lauf: typeof rows = [];
  const schreibeLauf = () => {
    if (lauf.length === 0) return;
    const erste = lauf[0]!;
    const letzte = lauf[lauf.length - 1]!;
    // Was gemeldet wird, war nie eine Bitte; was beantragt wird, galt als bewilligt.
    const status = erste.type === 'krank' || erste.type === 'fortbildung' ? 'gemeldet' : 'genehmigt';
    const notiz = lauf.find((r) => r.note)?.note ?? null;
    const angelegt = erste.created_at;
    const id = einfuegen.get(
      erste.user_id,
      erste.date,
      letzte.date,
      erste.type,
      status,
      notiz,
      erste.edited_by,
      status === 'genehmigt' ? erste.edited_by : null,
      status === 'genehmigt' ? angelegt : null,
    )?.id;
    if (id) verknuepfen.run(id, erste.user_id, erste.date, letzte.date, erste.type);
    lauf = [];
  };

  for (const row of rows) {
    const vorher = lauf[lauf.length - 1];
    if (vorher && vorher.user_id === row.user_id && vorher.type === row.type && setztFort(vorher.date, row.date)) {
      lauf.push(row);
      continue;
    }
    schreibeLauf();
    lauf = [row];
  }
  schreibeLauf();
}

function migration8Protokoll(db: Database) {
  // Das Protokoll — was in diesem Datensatz geschehen ist, und durch wen.
  //
  // Drei Eigenschaften machen aus einer Liste von Zeilen einen Nachweis, und
  // alle drei stehen hier im Schema statt in der Anwendung:
  //
  // 1. **Unveränderbar.** Zwei Trigger verbieten UPDATE und DELETE. Ein
  //    Protokoll, das sich ändern lässt, beweist nichts — die GoBD nennt das
  //    die Unveränderbarkeit, und sie gehört an die einzige Stelle, die auch
  //    dann noch gilt, wenn jemand nicht durch die Anwendung geht.
  // 2. **Verkettet.** Jede Zeile trägt den SHA-256 ihres eigenen Inhalts samt
  //    des Hashes ihrer Vorgängerin. Wer die Trigger umgeht (sqlite3 auf der
  //    Kommandozeile kann das), kann eine Zeile zwar entfernen — aber nicht,
  //    ohne die Kette zu zerreißen, und der Bruch ist auffindbar.
  // 3. **Aus sich heraus lesbar.** Name und Rolle der handelnden Person stehen
  //    als Text in der Zeile, nicht als Verweis. Ein umbenannter oder
  //    deaktivierter Mitarbeiter darf die Vergangenheit nicht umschreiben.
  //
  // Aus demselben Grund gibt es hier keine Fremdschlüssel: das Protokoll hängt
  // bewusst an keiner anderen Tabelle. Es überlebt sie.
  db.exec(`
    CREATE TABLE IF NOT EXISTS protokoll (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      /* Ortszeit (Europe/Berlin), wie jede andere Zeitangabe dieser Anwendung.
         Bei einem Nachweis ist der Zeitpunkt der Inhalt: eine um zwei Stunden
         verschobene UTC-Angabe wäre hier nicht bloß unschön, sondern falsch. */
      ts TEXT NOT NULL,
      akteur_id INTEGER,
      akteur_name TEXT NOT NULL,
      akteur_rolle TEXT,
      /* Wessen Datensatz berührt wurde — oft dieselbe Person, bei einer
         Korrektur durch die Verwaltung eine andere. */
      betroffen_id INTEGER,
      betroffen_name TEXT,
      bereich TEXT NOT NULL,
      aktion TEXT NOT NULL,
      /* Der Gegenstand in einem Satz Deutsch: „Eintrag Mi., 12.8., 08:00–16:30". */
      gegenstand TEXT NOT NULL,
      /* Der Geschäftstag oder -monat, um den es ging — damit sich „alles, was
         den August berührt hat" finden lässt, unabhängig davon, wann es
         geschah. */
      datum TEXT,
      vorher TEXT,
      nachher TEXT,
      ergebnis TEXT NOT NULL CHECK (ergebnis IN ('ok', 'fehler')),
      meldung TEXT,
      vorher_hash TEXT NOT NULL,
      hash TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_protokoll_ts ON protokoll(ts);
    CREATE INDEX IF NOT EXISTS idx_protokoll_betroffen ON protokoll(betroffen_id, ts);
    CREATE INDEX IF NOT EXISTS idx_protokoll_akteur ON protokoll(akteur_id, ts);
    CREATE INDEX IF NOT EXISTS idx_protokoll_bereich ON protokoll(bereich, ts);

    CREATE TRIGGER IF NOT EXISTS protokoll_unveraenderbar
      BEFORE UPDATE ON protokoll
      BEGIN SELECT RAISE(ABORT, 'Das Protokoll ist unveränderbar.'); END;
    CREATE TRIGGER IF NOT EXISTS protokoll_unloeschbar
      BEFORE DELETE ON protokoll
      BEGIN SELECT RAISE(ABORT, 'Das Protokoll ist unveränderbar.'); END;
  `);
}

function migrate(db: Database) {
  const row = db.query<{user_version: number}, []>('PRAGMA user_version').get();
  for (let version = row?.user_version ?? 0; version < MIGRATIONS.length; version++) {
    db.transaction(() => {
      MIGRATIONS[version]!(db);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    })();
  }
}

export function createDb(path: string): Database {
  const db = new Database(path, {create: true, strict: true});
  db.exec('PRAGMA journal_mode = WAL;');
  // Fremdschlüssel erst NACH den Migrationen: der Neuaufbau einer Elterntabelle
  // (users in Migration 17) braucht das DROP, während Kindtabellen noch auf sie
  // zeigen — der dokumentierte Zwölf-Schritte-Weg. Im Betrieb sind sie scharf.
  migrate(db);
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

export function getDb(): Database {
  // Next hält das globale Handle bei einem Dev-Hot-Reload am Leben. Kommt in
  // demselben Lauf eine Migration hinzu, muss die Verbindung einmal neu auf —
  // sonst läuft der neue Code gegen das vor dem Reload vorbereitete Schema.
  if (
    globalThis.__medarbeiterDb &&
    globalThis.__medarbeiterDbSchemaVersion !== SCHEMA_VERSION
  ) {
    globalThis.__medarbeiterDb.close();
    globalThis.__medarbeiterDb = undefined;
  }
  if (!globalThis.__medarbeiterDb) {
    const dir = join(process.cwd(), 'data');
    mkdirSync(dir, {recursive: true});
    globalThis.__medarbeiterDb = createDb(join(dir, 'medarbeiter.db'));
    globalThis.__medarbeiterDbSchemaVersion = SCHEMA_VERSION;
  }
  return globalThis.__medarbeiterDb;
}

/** Test-only: point the process-wide handle at another database (e.g. ':memory:'). */
export function setDbForTesting(db: Database | undefined): void {
  globalThis.__medarbeiterDb = db;
  globalThis.__medarbeiterDbSchemaVersion = db ? SCHEMA_VERSION : undefined;
}

/** Die Rolle ist nur noch ein vordefiniertes Rechtebündel — Vokabular in lib/rechte.ts. */
export type Role = import('./rechte').Rolle;

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  weekly_minutes: number;
  active: number;
  created_at: string;
  /** Two-letter code; null falls back to the company-wide setting. */
  bundesland?: string | null;
  /** Jahresanspruch an Urlaubstagen; der Übertrag steht in `urlaub_uebertrag`. */
  urlaubstage_jahr: number;
  /** Lokale, nicht-biometrische Profilfigur. */
  avatar_key?: import('./avatar').AvatarKey;
  /** Ein von der Verwaltung ausgestelltes Kennwort muss einmal ersetzt werden. */
  must_change_password?: number;
  /**
   * Wirksame Rechte (Rollenbündel ∪ Zusatzrechte). Die Sitzung lädt sie in
   * `getSessionUser()`; wo sie fehlen, fällt `hatRecht()` auf das Bündel der
   * Rolle zurück.
   */
  rechte?: import('./rechte').Recht[];
}

export type DayTypeKind = 'urlaub' | 'krank' | 'feiertag' | 'freizeitausgleich' | 'fortbildung';

export interface DayTypeRow {
  user_id: number;
  date: string;
  type: DayTypeKind;
  note: string | null;
  edited_by: number | null;
  created_at: string;
  updated_at: string;
  /** Gesetzt, wenn die Zeile die Projektion einer Abwesenheit ist. */
  abwesenheit_id: number | null;
}

/**
 * Die Arten, die eine Abwesenheit annehmen kann. `feiertag` fehlt: er kommt aus
 * dem Kalender des Bundeslandes und ist nichts, was jemand beantragt.
 */
export type AbwesenheitArt = 'urlaub' | 'krank' | 'freizeitausgleich' | 'fortbildung';

/**
 * `gemeldet` ist der Endzustand einer Meldung (Krank, Fortbildung): sie wird
 * nicht genehmigt, sondern zur Kenntnis genommen. Anträge (Urlaub,
 * Freizeitausgleich) laufen entwurf → eingereicht → genehmigt | abgelehnt.
 */
export type AbwesenheitStatus = 'entwurf' | 'eingereicht' | 'gemeldet' | 'genehmigt' | 'abgelehnt';

export interface Abwesenheit {
  id: number;
  user_id: number;
  von: string;
  bis: string;
  art: AbwesenheitArt;
  status: AbwesenheitStatus;
  notiz: string | null;
  /** Pfad unterhalb von data/au; nur bei Krank, nie öffentlich erreichbar. */
  au_datei: string | null;
  au_datei_name: string | null;
  au_datei_typ: string | null;
  eingereicht_at: string | null;
  entschieden_at: string | null;
  entschieden_von: number | null;
  entscheidung_notiz: string | null;
  /** 1 = die Verwaltung hat die eigene Abwesenheit genehmigt. */
  selbst_genehmigt: number;
  edited_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface UrlaubUebertrag {
  user_id: number;
  jahr: string;
  tage: number;
  edited_by: number | null;
  updated_at: string;
}

/**
 * Eine Zeile des Protokolls, so wie sie in der Datenbank steht. Das Vokabular
 * — welche Aktionen es gibt, wie sie auf Deutsch heißen und zu welchem Bereich
 * sie gehören — liegt in `lib/protokoll.ts`; hier steht nur die Form.
 */
export interface ProtokollRow {
  id: number;
  ts: string;
  akteur_id: number | null;
  akteur_name: string;
  akteur_rolle: string | null;
  betroffen_id: number | null;
  betroffen_name: string | null;
  bereich: string;
  aktion: string;
  gegenstand: string;
  datum: string | null;
  /** JSON mit deutschen Feldnamen, damit die Gegenüberstellung ohne Tabelle lesbar ist. */
  vorher: string | null;
  nachher: string | null;
  ergebnis: 'ok' | 'fehler';
  meldung: string | null;
  vorher_hash: string;
  hash: string;
}

export interface Segment {
  id: number;
  user_id: number;
  date: string;
  kind: 'arbeit' | 'pause';
  start_min: number;
  end_min: number | null;
  note: string | null;
  edited_by: number | null;
  /** 1 = provisionally closed by the cutoff sweep, awaiting confirmation. */
  auto_closed: number;
  created_at: string;
  updated_at: string;
}

/**
 * Ein gemeinsames Firmenkonto, dessen Einmalcodes die Anwendung erzeugt.
 * `secret` bleibt auf dem Server — was den Browser erreicht, beschreibt
 * `lib/zugangscodes.ts`.
 */
export interface TotpKonto {
  id: number;
  dienst: string;
  konto: string | null;
  /** Das geteilte Geheimnis, Base32 — nie an den Browser, nie ins Protokoll. */
  secret: string;
  algorithmus: 'SHA1' | 'SHA256' | 'SHA512';
  stellen: number;
  periode: number;
  erstellt_von: number | null;
  created_at: string;
  /** Leserkreis: alle Angemeldeten, die Rollen in `totp_konto_rollen` oder die Personen in `totp_konto_personen`. */
  sichtbarkeit: 'alle' | 'rolle' | 'personen';
}

export interface MonthLock {
  user_id: number;
  month: string;
  locked_at: string;
  locked_by: number;
}

export type ReiseStatus = 'entwurf' | 'eingereicht' | 'genehmigt' | 'abgelehnt';

export interface Reise {
  id: number;
  user_id: number;
  start_date: string;
  start_min: number;
  end_date: string;
  /** 1440 = Rückkehr um Mitternacht. */
  end_min: number;
  zweck: string;
  ziel: string | null;
  status: ReiseStatus;
  /** Beim Einreichen eingefrorene Stufe; null solange Entwurf. */
  satz_teiltag_cent: number | null;
  satz_volltag_cent: number | null;
  eingereicht_at: string | null;
  entschieden_at: string | null;
  entschieden_von: number | null;
  entscheidung_notiz: string | null;
  edited_by: number | null;
  created_at: string;
  updated_at: string;
}

export type BelegArt = 'uebernachtung' | 'fahrt' | 'parken' | 'ticket' | 'sonstiges';

export interface ReiseBeleg {
  id: number;
  reise_id: number;
  art: BelegArt;
  datum: string;
  betrag_cent: number;
  beschreibung: string | null;
  /** Pfad unterhalb von data/belege; null = Auslage ohne Datei. */
  datei: string | null;
  datei_name: string | null;
  datei_typ: string | null;
  created_at: string;
}
