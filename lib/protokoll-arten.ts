// Das Protokoll — das Vokabular. Rein und ohne Datenbank, damit die
// Filterleiste und die Liste im Browser dieselben Namen benutzen können, mit
// denen der Server schreibt. Dieselbe Teilung wie bei
// lib/abwesenheit-arten.ts gegen lib/abwesenheit.ts: der Datensatz liegt in
// lib/protokoll.ts, hier steht nur, wie die Dinge heißen.

export const PROTOKOLL_BEREICHE = [
  'zugang',
  'zeit',
  'abwesenheit',
  'spesen',
  'abschluss',
  'stammdaten',
  'einstellungen',
] as const;

export type ProtokollBereich = (typeof PROTOKOLL_BEREICHE)[number];

export const BEREICH_LABEL: Record<ProtokollBereich, string> = {
  zugang: 'Zugang',
  zeit: 'Arbeitszeit',
  abwesenheit: 'Abwesenheit',
  spesen: 'Reisen & Spesen',
  abschluss: 'Monatsabschluss',
  stammdaten: 'Mitarbeiter',
  einstellungen: 'Einstellungen',
};

/**
 * Jede Handlung, die diese Anwendung am Datensatz vornimmt — geschlossen
 * aufgezählt, damit keine Aktion ohne deutschen Namen ins Protokoll gerät und
 * der Übersetzer vollständig bleibt. Wer eine neue Server-Aktion schreibt,
 * trägt sie hier ein und sieht dabei, ob es die Bedeutung schon gibt: dieselbe
 * Regel wie beim Zeichenvokabular in components/sinnbilder.tsx.
 *
 * `eingriff` trennt die beiden Sorten, aus denen ein Protokoll besteht:
 *
 *   **Routine** — das Stempeln selbst und das An- und Abmelden. Wer acht
 *   Stunden arbeitet, erzeugt vier bis sechs solcher Zeilen am Tag; bei
 *   fünfzig Mitarbeitern sind das über tausend in der Woche. Sie gehören ins
 *   Protokoll (sonst fehlte gerade der Beleg dafür, dass die Zeit erfasst
 *   wurde), aber sie sind nicht das, was jemand sucht.
 *
 *   **Eingriff** — jede nachträgliche Korrektur, jede Entscheidung, jede
 *   Sperre, jede Änderung an Stammdaten oder Einstellungen. Das ist das
 *   Signal. Deshalb zeigt die Seite es zuerst und blendet die Routine auf
 *   einen Klick dazu, statt sie zu verschweigen.
 */
interface AktionsArt {
  bereich: ProtokollBereich;
  label: string;
  eingriff: boolean;
}

export const AKTIONEN = {
  // ── Zugang ───────────────────────────────────────────────────────────────
  anmelden: {bereich: 'zugang', label: 'Angemeldet', eingriff: false},
  'anmelden.google': {bereich: 'zugang', label: 'Über Google angemeldet', eingriff: false},
  'anmelden.fehlgeschlagen': {bereich: 'zugang', label: 'Anmeldung fehlgeschlagen', eingriff: true},
  'passwort.aendern': {bereich: 'zugang', label: 'Passwort geändert', eingriff: true},
  /* Der historische Schlüssel der OAuth-Vorschau bleibt: geschriebene Zeilen
     tragen ihn für immer, und ein Vokabular vergisst keine Bedeutung. */
  'oauth.google-demo-verbinden': {bereich: 'zugang', label: 'Google-Vorschau verbunden', eingriff: true},
  'oauth.google-verbinden': {bereich: 'zugang', label: 'Google-Konto verbunden', eingriff: true},
  'oauth.google-trennen': {bereich: 'zugang', label: 'Google-Konto getrennt', eingriff: true},
  /* Die geteilten Einmalcodes der gemeinsamen Firmenkonten. Wie beim Passwort
     steht nur die Tatsache im Protokoll — das Geheimnis selbst nie. */
  'zugangscode.anlegen': {bereich: 'zugang', label: 'Zugangscode hinterlegt', eingriff: true},
  'zugangscode.aendern': {bereich: 'zugang', label: 'Zugangscode geändert', eingriff: true},
  'zugangscode.loeschen': {bereich: 'zugang', label: 'Zugangscode entfernt', eingriff: true},
  abmelden: {bereich: 'zugang', label: 'Abgemeldet', eingriff: false},

  // ── Arbeitszeit ──────────────────────────────────────────────────────────
  'stempeln.ein': {bereich: 'zeit', label: 'Eingestempelt', eingriff: false},
  'stempeln.pause': {bereich: 'zeit', label: 'Pause begonnen', eingriff: false},
  'stempeln.fort': {bereich: 'zeit', label: 'Pause beendet', eingriff: false},
  'stempeln.aus': {bereich: 'zeit', label: 'Ausgestempelt', eingriff: false},
  'stempeln.rueckgaengig': {bereich: 'zeit', label: 'Stempelung zurückgenommen', eingriff: true},
  'eintrag.anlegen': {bereich: 'zeit', label: 'Eintrag angelegt', eingriff: true},
  'eintrag.aendern': {bereich: 'zeit', label: 'Eintrag geändert', eingriff: true},
  /* Vom getippten Ändern getrennt, weil es eine andere Handlung ist: eine
     gezogene Kante ist eine Schätzung, ein eingegebener Wert eine Angabe. */
  'eintrag.ziehen': {bereich: 'zeit', label: 'Eintrag gezogen', eingriff: true},
  'eintrag.loeschen': {bereich: 'zeit', label: 'Eintrag gelöscht', eingriff: true},
  'eintrag.bestaetigen': {bereich: 'zeit', label: 'Eintrag bestätigt', eingriff: true},
  'tagesart.setzen': {bereich: 'zeit', label: 'Tagesart gesetzt', eingriff: true},

  // ── Abwesenheit ──────────────────────────────────────────────────────────
  'abwesenheit.anlegen': {bereich: 'abwesenheit', label: 'Abwesenheit erfasst', eingriff: true},
  'abwesenheit.aendern': {bereich: 'abwesenheit', label: 'Abwesenheit geändert', eingriff: true},
  'abwesenheit.loeschen': {bereich: 'abwesenheit', label: 'Abwesenheit gelöscht', eingriff: true},
  'abwesenheit.einreichen': {bereich: 'abwesenheit', label: 'Antrag eingereicht', eingriff: true},
  'abwesenheit.zurueckziehen': {bereich: 'abwesenheit', label: 'Antrag zurückgezogen', eingriff: true},
  'abwesenheit.genehmigen': {bereich: 'abwesenheit', label: 'Antrag genehmigt', eingriff: true},
  'abwesenheit.zurueckweisen': {bereich: 'abwesenheit', label: 'Antrag zurückgewiesen', eingriff: true},
  'abwesenheit.bescheinigung': {bereich: 'abwesenheit', label: 'Bescheinigung hinterlegt', eingriff: true},
  'uebertrag.setzen': {bereich: 'abwesenheit', label: 'Urlaubsübertrag gesetzt', eingriff: true},

  // ── Reisen & Spesen ──────────────────────────────────────────────────────
  'reise.anlegen': {bereich: 'spesen', label: 'Reise erfasst', eingriff: true},
  'reise.aendern': {bereich: 'spesen', label: 'Reise geändert', eingriff: true},
  'reise.loeschen': {bereich: 'spesen', label: 'Reise gelöscht', eingriff: true},
  'reise.einreichen': {bereich: 'spesen', label: 'Reise eingereicht', eingriff: true},
  'reise.zurueckziehen': {bereich: 'spesen', label: 'Reise zurückgezogen', eingriff: true},
  'reise.genehmigen': {bereich: 'spesen', label: 'Reise genehmigt', eingriff: true},
  'reise.zurueckweisen': {bereich: 'spesen', label: 'Reise zurückgewiesen', eingriff: true},
  'beleg.anlegen': {bereich: 'spesen', label: 'Beleg hinzugefügt', eingriff: true},
  'beleg.loeschen': {bereich: 'spesen', label: 'Beleg gelöscht', eingriff: true},

  // ── Monatsabschluss ──────────────────────────────────────────────────────
  'monat.abschliessen': {bereich: 'abschluss', label: 'Monat abgeschlossen', eingriff: true},
  'monat.oeffnen': {bereich: 'abschluss', label: 'Monat wieder geöffnet', eingriff: true},

  // ── Stammdaten ───────────────────────────────────────────────────────────
  'mitarbeiter.anlegen': {bereich: 'stammdaten', label: 'Mitarbeiter angelegt', eingriff: true},
  'mitarbeiter.aendern': {bereich: 'stammdaten', label: 'Mitarbeiter geändert', eingriff: true},
  /* Nur die Tatsache. Das Kennwort selbst steht nirgends im Protokoll — ein
     Nachweis, in dem Zugangsdaten stehen, ist ein Leck mit Zeitstempel. */
  'mitarbeiter.passwort': {bereich: 'stammdaten', label: 'Passwort zurückgesetzt', eingriff: true},
  'mitarbeiter.deaktivieren': {bereich: 'stammdaten', label: 'Mitarbeiter deaktiviert', eingriff: true},
  'mitarbeiter.einrichtung-neustart': {bereich: 'stammdaten', label: 'Einrichtung neu gestartet', eingriff: true},
  'mitarbeiter.reaktivieren': {bereich: 'stammdaten', label: 'Mitarbeiter reaktiviert', eingriff: true},

  // ── Persönliches Profil ─────────────────────────────────────────────────
  'profil.bestaetigen': {bereich: 'stammdaten', label: 'Stammdaten bestätigt', eingriff: true},
  'profil.einstellungen': {bereich: 'einstellungen', label: 'Persönliche Einstellungen geändert', eingriff: true},

  // ── Einstellungen ────────────────────────────────────────────────────────
  'einstellungen.aendern': {bereich: 'einstellungen', label: 'Einstellungen geändert', eingriff: true},

  // ── Verbundene Apps (MedArbeiter als Anmeldestelle) ─────────────────────
  /* Wie beim Passwort und beim Zugangscode: die Tatsache steht im Protokoll,
     das App-Geheimnis selbst nie. */
  'oauth.app-anlegen': {bereich: 'einstellungen', label: 'App-Anbindung angelegt', eingriff: true},
  'oauth.app-aendern': {bereich: 'einstellungen', label: 'App-Anbindung geändert', eingriff: true},
  'oauth.app-aktiv': {bereich: 'einstellungen', label: 'App-Anbindung gesperrt/freigegeben', eingriff: true},
  'oauth.app-schluessel': {bereich: 'einstellungen', label: 'App-Geheimnis erneuert', eingriff: true},
  /* Routine wie das Anmelden selbst: einmal je Anmelde-Rundlauf, beim
     Ausstellen des Codes — nie je Token- oder Userinfo-Abruf. */
  'oauth.app-anmeldung': {bereich: 'zugang', label: 'Über MedArbeiter bei App angemeldet', eingriff: false},
  /* Das Nein auf der Freigabeseite. Routine, kein Eingriff — aber sichtbar:
     wiederholte Ablehnungen erzählen von einer App, der niemand traut. */
  'oauth.app-abgelehnt': {bereich: 'zugang', label: 'Anmeldung bei App abgelehnt', eingriff: false},
} as const satisfies Record<string, AktionsArt>;

export type ProtokollAktion = keyof typeof AKTIONEN;

export function istAktion(value: string | undefined): value is ProtokollAktion {
  return value !== undefined && value in AKTIONEN;
}

export function istBereich(value: string | undefined): value is ProtokollBereich {
  return value !== undefined && (PROTOKOLL_BEREICHE as readonly string[]).includes(value);
}

/** Die Aktionen, die als Eingriff gelten — die Vorauswahl der Protokollseite. */
export const EINGRIFFE: ProtokollAktion[] = (Object.keys(AKTIONEN) as ProtokollAktion[]).filter(
  (a) => AKTIONEN[a].eingriff,
);

/** Der deutsche Name einer Aktion; unbekannte Schlüssel behalten ihren Schlüssel. */
export function aktionLabel(aktion: string): string {
  return istAktion(aktion) ? AKTIONEN[aktion].label : aktion;
}

export function istEingriff(aktion: string): boolean {
  return istAktion(aktion) && AKTIONEN[aktion].eingriff;
}
