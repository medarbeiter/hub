// Der Versand — was das Haus per E-Mail verlässt.
//
// Drei Regeln tragen dieses Modul, und alle drei sind aus der bestehenden
// Anwendung übernommen, nicht neu erfunden:
//
//   1. **Der Versand bricht nie eine Buchung.** `sendeMail()` wirft nicht —
//      dieselbe Haltung wie `protokolliere()` und `syncGoogleAbwesenheiten()`.
//      Eine Krankmeldung, die scheitert, weil der Mailserver nicht erreichbar
//      ist, richtet mehr Schaden an als eine ungeschriebene Nachricht. Was
//      schiefging, steht in der Konsole und in `mail_versand`.
//   2. **Ohne Schlüssel läuft alles weiter.** Ist `RESEND_API_KEY` nicht
//      gesetzt, wird nichts verschickt, sondern in die Konsole geschrieben und
//      als „übersprungen" verbucht. Entwicklung und Testbetrieb brauchen kein
//      Konto, und ein Haus, das den Versand (noch) nicht will, schaltet ihn
//      schlicht nicht ein.
//   3. **Jede Nachricht hinterlässt eine Spur.** Das Versandbuch liegt in
//      `lib/mail-buch.ts` — getrennt, weil eine Seite, die es nur *liest*,
//      nicht den ganzen Renderer mitziehen soll (der Kopfkommentar dort sagt,
//      wie das gemessen wurde).
//
// Was hier *nicht* steht: wer wann welche Nachricht bekommt. Das ist die
// Bedeutung und liegt in `lib/benachrichtigungen.ts`, so wie das Vokabular in
// `lib/mail-arten.ts` liegt. Dieses Modul kennt nur Adresse, Betreff, Inhalt.

import {createElement} from 'react';
import {Resend} from 'resend';
import {absenderAdresse, mailAktiv} from './settings';
import {MAIL_ARTEN, type MailArt, type MailInhalt} from './mail-arten';
import {basisUrl, bucheVersand, type VersandErgebnis} from './mail-buch';
import {Nachricht} from '../emails/nachricht';
import {alsText} from '../emails/text';

export type {VersandErgebnis} from './mail-buch';

export interface MailAuftrag {
  art: MailArt;
  /** Empfängeradresse. */
  an: string;
  /** Anrede im Text — der Name des Empfängers, nicht der betroffenen Person. */
  anrede: string;
  /** Wessen Datensatz die Nachricht betrifft; für das Versandbuch. */
  betrifftId?: number | null;
  inhalt: MailInhalt;
}

let client: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

function buche(auftrag: MailAuftrag, ergebnis: VersandErgebnis, meldung: string | null): void {
  bucheVersand(auftrag.art, auftrag.an, auftrag.betrifftId ?? null, auftrag.inhalt.betreff, ergebnis, meldung);
}

/**
 * Verschickt eine Nachricht. Gibt zurück, was geschehen ist, damit ein
 * Aufrufer es anzeigen kann — wirft aber unter keinen Umständen.
 */
export async function sendeMail(auftrag: MailAuftrag): Promise<VersandErgebnis> {
  try {
    if (!mailAktiv()) {
      buche(auftrag, 'uebersprungen', 'Versand ist in den Einstellungen abgeschaltet.');
      return 'uebersprungen';
    }

    const optionen = {
      anrede: auftrag.anrede,
      basisUrl: basisUrl(),
      abwaehlbar: MAIL_ARTEN[auftrag.art].abwaehlbar,
    };
    // `renderToStaticMarkup` statt `render()` aus @react-email/render: warum,
    // steht im Kopfkommentar von emails/text.ts. Die Doctype-Zeile davor ist
    // das einzige, was das Paket sonst noch beisteuerte — ohne sie schalten
    // ältere Outlook-Fassungen in einen Kompatibilitätsmodus.
    //
    // Der Import steht bewusst hier drin und nicht oben: Next verbietet
    // `react-dom/server` im statischen Servergraphen des App Routers (es
    // schützt damit davor, dass jemand die zweite Renderfassung versehentlich
    // in eine Seite zieht). Hier ist es kein Versehen, sondern der Zweck —
    // und zur Laufzeit geladen liegt es auch in keinem Bündel, das
    // `lib/mail.ts` bloß erwähnt.
    const {renderToStaticMarkup} = await import('react-dom/server');
    const html =
      '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" ' +
      '"http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">' +
      renderToStaticMarkup(createElement(Nachricht, {...auftrag.inhalt, ...optionen}));
    const text = alsText(auftrag.inhalt, optionen);

    const dienst = resend();
    if (!dienst) {
      // Ohne Schlüssel: die Nachricht sichtbar machen, statt sie zu verlieren.
      // In der Entwicklung ist genau das der Zweck.
      console.info(
        `[Mail übersprungen – kein RESEND_API_KEY]\nAn: ${auftrag.an}\nBetreff: ${auftrag.inhalt.betreff}\n\n${text}`,
      );
      buche(auftrag, 'uebersprungen', 'Kein RESEND_API_KEY hinterlegt.');
      return 'uebersprungen';
    }

    const {error} = await dienst.emails.send({
      from: absenderAdresse(),
      to: auftrag.an,
      subject: auftrag.inhalt.betreff,
      html,
      text,
    });

    if (error) {
      console.error('Mail nicht versendet:', error.name, error.message);
      buche(auftrag, 'fehler', `${error.name}: ${error.message}`.slice(0, 500));
      return 'fehler';
    }

    buche(auftrag, 'gesendet', null);
    return 'gesendet';
  } catch (fehler) {
    console.error('Mailversand fehlgeschlagen:', fehler);
    buche(auftrag, 'fehler', fehler instanceof Error ? fehler.message.slice(0, 500) : 'Unbekannter Fehler');
    return 'fehler';
  }
}

/**
 * Mehrere Empfänger, eine Nachricht — der Prüfkreis. Nacheinander und je mit
 * eigener Zeile im Versandbuch: ein Sammel-„to" verriete jedem Empfänger die
 * Adressen der anderen, und eine einzelne unzustellbare Adresse nähme sonst
 * allen anderen die Nachricht mit.
 */
export async function sendeAnAlle(auftraege: MailAuftrag[]): Promise<void> {
  for (const auftrag of auftraege) await sendeMail(auftrag);
}
