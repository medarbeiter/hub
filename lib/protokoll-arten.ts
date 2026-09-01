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
 *
 * `erfassung` trennt die zweite Achse — siehe `ERFASSUNGSARTEN` unten.
 */
interface AktionsArt {
  bereich: ProtokollBereich;
  label: string;
  eingriff: boolean;
  /** Wie die Zeit in den Datensatz kam. Fehlt bei allem, was keine Zeit ist. */
  erfassung?: Erfassungsart;
}

/**
 * **Wie die Zeit in den Datensatz kam.** Die zweite Achse neben `eingriff` —
 * und die, nach der eine Betriebsprüfung als erstes fragt.
 *
 * `eingriff` trennt „das Signal vom Rauschen“; das hier trennt etwas anderes:
 * den **Beweiswert** einer Zeile. Eine gestempelte Zeit ist zum Ereignis
 * entstanden, eine nachgetragene ist eine spätere Behauptung über die
 * Vergangenheit — beide sind zulässig, aber sie wiegen nicht gleich, und wer
 * den Nachweis liest, darf das nicht erst aus dem Vorgangsnamen erschließen
 * müssen.
 *
 *   **gestempelt**   — zum Zeitpunkt des Ereignisses über die Stempeluhr
 *                      ausgelöst. Das Rücknehmen innerhalb der 30 Sekunden
 *                      gehört dazu: es geschieht an derselben Uhr, im selben
 *                      Augenblick, und korrigiert einen Fehlgriff — keine
 *                      Aussage über einen vergangenen Tag.
 *   **nachgetragen** — von Hand für einen bereits vergangenen Zeitpunkt
 *                      eingetragen, geändert, gezogen, gelöscht oder
 *                      bestätigt. Eine Person behauptet hier etwas über die
 *                      Vergangenheit.
 *   **automatisch**  — die Anwendung selbst hat den Wert gesetzt (der
 *                      vorläufige Feierabend eines vergessenen
 *                      Ausstempelns). Weder gestempelt noch behauptet: eine
 *                      Annahme der Maschine, die ein Mensch noch bestätigen
 *                      muss.
 *
 * Nur Vorgänge, die eine erfasste Zeit *sind*, tragen die Angabe. Eine
 * Tagesart, eine Genehmigung oder eine Einstellung hat kein gestempeltes
 * Gegenstück — dort wäre „nachgetragen“ keine Unterscheidung, sondern nur ein
 * Wort mehr in der Zeile.
 */
export const ERFASSUNGSARTEN = ['gestempelt', 'nachgetragen', 'automatisch'] as const;

export type Erfassungsart = (typeof ERFASSUNGSARTEN)[number];

export const ERFASSUNG_LABEL: Record<Erfassungsart, string> = {
  gestempelt: 'Gestempelt',
  nachgetragen: 'Nachgetragen',
  automatisch: 'Automatisch',
};

/** Der ganze Satz — für das aufgeklappte Fach, wo Platz für einen Grund ist. */
export const ERFASSUNG_ERKLAERUNG: Record<Erfassungsart, string> = {
  gestempelt: 'Zum Zeitpunkt des Ereignisses an der Stempeluhr ausgelöst.',
  nachgetragen: 'Nachträglich von Hand erfasst: eine Angabe über einen vergangenen Zeitpunkt.',
  automatisch: 'Von der Anwendung gesetzt, nicht von einer Person ausgelöst.',
};

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
  'zugangscode.loeschen-angefordert': {bereich: 'zugang', label: 'Löschung angefordert', eingriff: true},
  'zugangscode.loeschen': {bereich: 'zugang', label: 'Zugangscode entfernt', eingriff: true},
  // Ein Pin ordnet die Anzeige, nicht den Datensatz — darum Routine, kein Eingriff.
  'zugangscode.anpinnen': {bereich: 'zugang', label: 'Zugangscode angepinnt', eingriff: false},
  'zugangscode.abpinnen': {bereich: 'zugang', label: 'Pin gelöst', eingriff: false},
  abmelden: {bereich: 'zugang', label: 'Abgemeldet', eingriff: false},

  // ── Arbeitszeit ──────────────────────────────────────────────────────────
  /* Die vier Uhrhandlungen: zum Ereignis ausgelöst, deshalb `gestempelt`. */
  'stempeln.ein': {bereich: 'zeit', label: 'Eingestempelt', eingriff: false, erfassung: 'gestempelt'},
  'stempeln.pause': {bereich: 'zeit', label: 'Pause begonnen', eingriff: false, erfassung: 'gestempelt'},
  'stempeln.fort': {bereich: 'zeit', label: 'Pause beendet', eingriff: false, erfassung: 'gestempelt'},
  'stempeln.aus': {bereich: 'zeit', label: 'Ausgestempelt', eingriff: false, erfassung: 'gestempelt'},
  /* Ein Eingriff, aber kein Nachtrag: die Rücknahme geschieht binnen 30
     Sekunden an derselben Uhr und behauptet nichts über die Vergangenheit. */
  'stempeln.rueckgaengig': {
    bereich: 'zeit',
    label: 'Stempelung zurückgenommen',
    eingriff: true,
    erfassung: 'gestempelt',
  },
  /* Alles Folgende ist von Hand für einen vergangenen Zeitpunkt erfasst —
     eine Angabe, keine Messung. Genau das muss im Nachweis stehen. */
  'eintrag.anlegen': {bereich: 'zeit', label: 'Eintrag angelegt', eingriff: true, erfassung: 'nachgetragen'},
  'eintrag.aendern': {bereich: 'zeit', label: 'Eintrag geändert', eingriff: true, erfassung: 'nachgetragen'},
  /* Vom getippten Ändern getrennt, weil es eine andere Handlung ist: eine
     gezogene Kante ist eine Schätzung, ein eingegebener Wert eine Angabe. */
  'eintrag.ziehen': {bereich: 'zeit', label: 'Eintrag gezogen', eingriff: true, erfassung: 'nachgetragen'},
  'eintrag.loeschen': {bereich: 'zeit', label: 'Eintrag gelöscht', eingriff: true, erfassung: 'nachgetragen'},
  'eintrag.bestaetigen': {bereich: 'zeit', label: 'Eintrag bestätigt', eingriff: true, erfassung: 'nachgetragen'},
  /* Kein Mensch hat gehandelt: die Anwendung schließt einen vergessenen
     Eintrag am eingestellten Feierabend vorläufig. Weder gestempelt (niemand
     stand an der Uhr) noch nachgetragen (niemand hat etwas behauptet) —
     deshalb die dritte Art. Die Zeile *muss* stehen: sonst erschiene ein von
     der Maschine geratenes Ende später als gemessene Zeit. */
  'eintrag.automatisch-geschlossen': {
    bereich: 'zeit',
    label: 'Vorläufig geschlossen',
    eingriff: true,
    erfassung: 'automatisch',
  },
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
  'rolle.anlegen': {bereich: 'stammdaten', label: 'Rolle angelegt', eingriff: true},
  'rolle.aendern': {bereich: 'stammdaten', label: 'Rolle geändert', eingriff: true},
  'rolle.loeschen': {bereich: 'stammdaten', label: 'Rolle gelöscht', eingriff: true},
  'recht.anlegen': {bereich: 'stammdaten', label: 'Recht angelegt', eingriff: true},
  'recht.aendern': {bereich: 'stammdaten', label: 'Recht geändert', eingriff: true},
  'recht.loeschen': {bereich: 'stammdaten', label: 'Recht gelöscht', eingriff: true},
  /* Nur die Tatsache. Das Kennwort selbst steht nirgends im Protokoll — ein
     Nachweis, in dem Zugangsdaten stehen, ist ein Leck mit Zeitstempel. */
  'mitarbeiter.passwort': {bereich: 'stammdaten', label: 'Passwort zurückgesetzt', eingriff: true},
  'mitarbeiter.deaktivieren': {bereich: 'stammdaten', label: 'Mitarbeiter deaktiviert', eingriff: true},
  'mitarbeiter.einrichtung-neustart': {bereich: 'stammdaten', label: 'Einrichtung neu gestartet', eingriff: true},
  'mitarbeiter.reaktivieren': {bereich: 'stammdaten', label: 'Mitarbeiter reaktiviert', eingriff: true},

  // ── Persönliches Profil ─────────────────────────────────────────────────
  'profil.bestaetigen': {bereich: 'stammdaten', label: 'Stammdaten bestätigt', eingriff: true},
  'profil.einstellungen': {bereich: 'einstellungen', label: 'Persönliche Einstellungen geändert', eingriff: true},
  /* Die Tatsache, nie die Datei: protokolliert wird „gesetzt" oder „entfernt",
     wie beim Passwort der Vorgang und nicht der Wert. */
  'profil.bild': {bereich: 'einstellungen', label: 'Profilbild geändert', eingriff: true},
  /* Hier steht der Wortlaut ausdrücklich mit im Nachweis — anders als beim
     Passwort und beim Zugangscode, wo der Wert das Geheimnis *ist*. Ein
     Kommentar ist das Gegenteil eines Geheimnisses: er ist eine Äußerung über
     einen Menschen, und der sieht seine eigene Spur. Wer etwas schreibt und
     es danach wegwischt, hat es trotzdem geschrieben. */
  'profil.kommentar': {bereich: 'stammdaten', label: 'Profilkommentar geschrieben', eingriff: true},
  'profil.kommentar-loeschen': {bereich: 'stammdaten', label: 'Profilkommentar gelöscht', eingriff: true},

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
  'oauth.app-anmeldung': {bereich: 'zugang', label: 'Über den Hub bei App angemeldet', eingriff: false},
  /* Das Nein auf der Freigabeseite. Routine, kein Eingriff — aber sichtbar:
     wiederholte Ablehnungen erzählen von einer App, der niemand traut. */
  'oauth.app-abgelehnt': {bereich: 'zugang', label: 'Anmeldung bei App abgelehnt', eingriff: false},
  'oauth.app-trennen': {bereich: 'zugang', label: 'App-Zugriff aufs eigene Konto beendet', eingriff: true},
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

/**
 * Wie die Zeit dieser Zeile in den Datensatz kam — `null`, wenn der Vorgang
 * gar keine Zeit erfasst (eine Genehmigung, eine Einstellung, eine Anmeldung).
 *
 * Damit lässt sich die Frage, wegen der ein Protokoll aufgeschlagen wird —
 * „steht diese Stunde da, weil jemand gestempelt hat, oder weil jemand sie
 * eingetippt hat?“ — an einer Stelle beantworten und nicht an fünf.
 *
 * Gelesen wird über `ARTEN` statt über `AKTIONEN` selbst: `as const` friert
 * jeden Eintrag auf seine eigenen Felder ein, und wo `erfassung` fehlt, kennt
 * der Typ die Eigenschaft gar nicht. Die eine geweitete Sicht ist billiger als
 * ein `erfassung: undefined` an sechzig Stellen.
 */
const ARTEN: Record<ProtokollAktion, AktionsArt> = AKTIONEN;

export function erfassungsart(aktion: string): Erfassungsart | null {
  return istAktion(aktion) ? ARTEN[aktion].erfassung ?? null : null;
}

/** Die Aktionen einer Erfassungsart — der Filter „nur Nachträge“. */
export function aktionenNachErfassung(art: Erfassungsart): ProtokollAktion[] {
  return (Object.keys(ARTEN) as ProtokollAktion[]).filter((a) => ARTEN[a].erfassung === art);
}

export function istErfassungsart(value: string | undefined): value is Erfassungsart {
  return value !== undefined && (ERFASSUNGSARTEN as readonly string[]).includes(value);
}
