// Das Versandbuch — was hinausging, an wen, und ob es ankam.
//
// Eigenes Modul, und zwar aus einem gemessenen Grund: `lib/mail.ts` zieht über
// `@react-email/render` den halben Renderer samt Prettier in jedes Bündel, in
// dem es vorkommt. Die Einstellungsseite will davon nichts — sie *liest* nur
// die letzten Zeilen. Dieselbe Teilung wie zwischen `lib/format.ts` (rein, für
// den Browser) und `lib/time.ts` (datenbankgebunden): wer nur lesen will, soll
// nicht das ganze Schreibwerk mitschleppen.
//
// Warum das Buch nicht im Protokoll steht, erklärt Migration 20 in lib/db.ts.

import {getDb} from './db';

export type VersandErgebnis = 'gesendet' | 'uebersprungen' | 'fehler';

export interface VersandZeile {
  id: number;
  ts: string;
  art: string;
  empfaenger: string;
  betreff: string;
  ergebnis: VersandErgebnis;
  meldung: string | null;
}

/** Ob überhaupt ein Schlüssel hinterlegt ist — die Einstellungsseite sagt es der Verwaltung. */
export function mailKonfiguriert(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

/**
 * Die Basisadresse für die Links in den Nachrichten. Anders als beim
 * OAuth-Rücksprung gibt es hier keinen Request, aus dem sich der Origin
 * ableiten ließe — eine Nachricht entsteht in einer Server-Aktion und wird
 * vielleicht erst Stunden später gelesen. Ohne `APP_URL` trägt die Nachricht
 * deshalb keinen Knopf: ein Link auf `localhost` wäre schlimmer als keiner.
 */
export function basisUrl(): string | null {
  const roh = process.env.APP_URL?.trim();
  return roh ? roh.replace(/\/$/, '') : null;
}

/**
 * Eine Zeile ins Buch. Wirft nie — auch das Versandbuch darf keine Buchung
 * aufhalten, dieselbe Haltung wie im Protokoll: melden und weitergehen.
 *
 * Der Inhalt steht bewusst nicht darin, nur Empfänger, Art und Betreff. Ein
 * Startpasswort gehört so wenig ins Versandbuch wie ins Protokoll.
 */
export function bucheVersand(
  art: string,
  empfaenger: string,
  betrifftId: number | null,
  betreff: string,
  ergebnis: VersandErgebnis,
  meldung: string | null,
): void {
  try {
    getDb()
      .query(
        `INSERT INTO mail_versand (art, empfaenger, betrifft_id, betreff, ergebnis, meldung)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(art, empfaenger, betrifftId, betreff, ergebnis, meldung);
  } catch (fehler) {
    console.error('Versandbuch nicht geschrieben:', fehler);
  }
}

/** Die letzten Zeilen — die Einstellungsseite zeigt sie der Verwaltung. */
export function letzterVersand(anzahl = 10): VersandZeile[] {
  return getDb()
    .query<VersandZeile, [number]>(
      `SELECT id, ts, art, empfaenger, betreff, ergebnis, meldung
       FROM mail_versand ORDER BY id DESC LIMIT ?`,
    )
    .all(anzahl);
}
