/**
 * Das Nachrichten-Vokabular — eine Nachricht, eine Bedeutung.
 *
 * Rein und Client-importierbar, nach demselben Prinzip wie
 * `lib/protokoll-arten.ts` und `lib/rechte.ts`: die persönlichen
 * Einstellungen zeigen im Browser dieselben Namen, mit denen der Server
 * verschickt. Der Versand selbst liegt in `lib/mail.ts`, wer wann was bekommt
 * in `lib/benachrichtigungen.ts`; hier steht nur, wie die Dinge heißen.
 *
 * `abwaehlbar` trennt die beiden Sorten, aus denen der Posteingang besteht:
 *
 *   **Abwählbar** — was jemand auch in der Anwendung sieht: dass ein Antrag
 *   entschieden wurde, dass ein Monat abgeschlossen ist, dass eine Reise
 *   wartet. Wer täglich in der Anwendung ist, braucht die Post nicht, und ein
 *   ungefragter Verteiler ist der schnellste Weg, ihn ignorieren zu lassen.
 *
 *   **Nicht abwählbar** — was den Zugang selbst betrifft: das Startpasswort
 *   und ein zurückgesetztes Kennwort. Diese Nachricht ist die einzige, die
 *   jemand *vor* dem ersten Anmelden erreichen kann; ein Schalter dagegen
 *   spielte den Zugang gegen sich selbst aus.
 *
 * Und eine Regel, die sich beim Betrieb ergeben hat: **der Prüfkreis bekommt
 * keine Eingangspost.** Dass ein Antrag oder eine Abrechnung eingereicht wurde,
 * steht in der Warteschlange der Anwendung, mit Zähler an der Seitenleiste —
 * eine Nachricht darüber erzählt niemandem etwas Neues und macht aus dem
 * Posteingang einen Verteiler, den man wegklickt. Was *nicht* in der Anwendung
 * steht, ist die verstrichene Zeit: darum gibt es statt der Eingangsmeldung die
 * Erinnerung (`abwesenheit.erinnerung`, `reise.erinnerung`), die erst greift,
 * wenn ein Vorgang liegen geblieben ist (`lib/erinnerungen.ts`). Die Meldung
 * einer Krankheit bleibt davon unberührt: sie ist keine Warteschlange, sondern
 * eine Tatsache über heute, und heute ist niemand da.
 */

export type MailArt =
  | 'abwesenheit.erinnerung'
  | 'abwesenheit.entschieden'
  | 'abwesenheit.gemeldet'
  | 'reise.erinnerung'
  | 'reise.entschieden'
  | 'monat.abgeschlossen'
  | 'zugang.willkommen'
  | 'zugang.passwort'
  | 'zugang.zugangscode-loeschen';

export interface MailBedeutung {
  label: string;
  /** Was diese Nachricht auslöst — steht in den persönlichen Einstellungen unter dem Schalter. */
  beschreibung: string;
  /** An wen sie geht: die betroffene Person oder der Kreis, der entscheidet. */
  empfaenger: 'person' | 'pruefende';
  /** Ob ein Konto sie abbestellen darf. Zugangspost darf das nie — siehe Kopfkommentar. */
  abwaehlbar: boolean;
}

export const MAIL_ARTEN = {
  'abwesenheit.erinnerung': {
    label: 'Antrag liegt noch',
    beschreibung: 'Ein Antrag wartet seit mehreren Tagen auf eine Entscheidung.',
    empfaenger: 'pruefende',
    abwaehlbar: true,
  },
  'abwesenheit.gemeldet': {
    label: 'Abwesenheit gemeldet',
    beschreibung: 'Eine Krankmeldung oder Fortbildung wurde erfasst und gilt sofort.',
    empfaenger: 'pruefende',
    abwaehlbar: true,
  },
  'abwesenheit.entschieden': {
    label: 'Antrag entschieden',
    beschreibung: 'Dein Antrag wurde genehmigt oder zurückgewiesen.',
    empfaenger: 'person',
    abwaehlbar: true,
  },
  'reise.erinnerung': {
    label: 'Abrechnung liegt noch',
    beschreibung: 'Eine Reisekostenabrechnung wartet seit mehreren Tagen auf die Prüfung.',
    empfaenger: 'pruefende',
    abwaehlbar: true,
  },
  'reise.entschieden': {
    label: 'Reise entschieden',
    beschreibung: 'Deine Reisekostenabrechnung wurde genehmigt oder zurückgewiesen.',
    empfaenger: 'person',
    abwaehlbar: true,
  },
  'monat.abgeschlossen': {
    label: 'Monat abgeschlossen',
    beschreibung: 'Ein Monat wurde abgeschlossen und ist damit schreibgeschützt.',
    empfaenger: 'person',
    abwaehlbar: true,
  },
  'zugang.willkommen': {
    label: 'Zugang eingerichtet',
    beschreibung: 'Dein Konto wurde angelegt – mit dem Startpasswort für die erste Anmeldung.',
    empfaenger: 'person',
    abwaehlbar: false,
  },
  'zugang.passwort': {
    label: 'Passwort zurückgesetzt',
    beschreibung: 'Dein Passwort wurde von der Verwaltung zurückgesetzt.',
    empfaenger: 'person',
    abwaehlbar: false,
  },
  'zugang.zugangscode-loeschen': {
    label: 'Zugangscode löschen',
    beschreibung: 'Bestätigung, wenn du das Entfernen eines Zugangscodes angestoßen hast.',
    empfaenger: 'person',
    abwaehlbar: false,
  },
} as const satisfies Record<MailArt, MailBedeutung>;

export const ALLE_MAIL_ARTEN = Object.keys(MAIL_ARTEN) as MailArt[];

/** Die Arten, die ein Konto abbestellen darf — die Liste der persönlichen Einstellungen. */
export const ABWAEHLBARE_ARTEN: MailArt[] = ALLE_MAIL_ARTEN.filter((art) => MAIL_ARTEN[art].abwaehlbar);

export function istMailArt(value: string | undefined): value is MailArt {
  return value !== undefined && value in MAIL_ARTEN;
}

/** Der deutsche Name einer Art; unbekannte Schlüssel (alte Versandzeilen) behalten ihren Schlüssel. */
export function mailArtLabel(art: string): string {
  return istMailArt(art) ? MAIL_ARTEN[art].label : art;
}

// ---------------------------------------------------------------------------
// Der Nachrichtenkörper
// ---------------------------------------------------------------------------

/**
 * Der Ton einer Nachricht — dieselben vier wie beim `MeldeTon` der Anwendung
 * (components/melde.tsx), damit eine Genehmigung im Posteingang dieselbe Farbe
 * trägt wie auf dem Bildschirm.
 */
export type MailTon = 'hinweis' | 'erfolg' | 'warnung' | 'fehler';

export interface MailAngabe {
  label: string;
  wert: string;
  /**
   * Die Zeile, auf die es hinausläuft — die Summe einer Abrechnung. Wie in
   * jeder Tabelle des Hauses trägt genau eine Zeile das Ergebnis, und sie
   * steht auch typografisch dafür ein.
   */
  betont?: boolean;
}

/**
 * Was eine Nachricht sagt — eine Nutzlast, kein Text.
 *
 * Dieselbe Beziehung, die `Monatsgitter` zu seinen Zellinhalten hat: es gibt
 * **eine** Vorlage (emails/nachricht.tsx), und eine neue Nachricht ist eine
 * neue Nutzlast, nie eine zweite Vorlage. Deshalb ist dieser Typ rein und
 * ohne React — die Bauer in `lib/benachrichtigungen.ts` lassen sich prüfen,
 * ohne etwas zu rendern.
 */
export interface MailInhalt {
  /** Die Betreffzeile. Trägt schon die Antwort, nicht nur das Thema. */
  betreff: string;
  /** Die Überschrift im Nachrichtenkörper. */
  titel: string;
  /** Ein bis zwei Sätze darunter. */
  vorspann: string;
  ton: MailTon;
  /** Die Tatsachen als Tabelle — Zeitraum, Betrag, Person. */
  angaben: MailAngabe[];
  /** Ein Zusatz in eigener Fläche: die Begründung einer Zurückweisung, das Startpasswort. */
  hinweis?: {titel: string; text: string} | null;
  /** Der Weg zurück in die Anwendung — der Pfad, nicht die volle Adresse. */
  ziel?: {label: string; pfad: string} | null;
  /** Der letzte Satz über der Fußzeile. */
  nachsatz?: string | null;
}
