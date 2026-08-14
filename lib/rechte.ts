/**
 * Das Rechte-Vokabular — eine Handlung, ein Recht.
 *
 * Rein und Client-importierbar, nach demselben Prinzip wie
 * `protokoll-arten.ts`: jede Stelle, die etwas erlaubt oder verbirgt, fragt
 * hier nach einem benannten Recht statt nach einer Rolle. Eine Rolle ist nur
 * noch ein vordefiniertes Bündel von Rechten; einzelnen Konten können darüber
 * hinaus Zusatzrechte gegeben werden (`benutzer_rechte`).
 *
 * Wer prüft, prüft `hatRecht()` — nie `role === '…'`. Eine neue Server-Aktion
 * bedeutet ein Recht hier (oder die bewusste Zuordnung zu einem bestehenden),
 * dieselbe Disziplin wie bei den Sinnbildern und den Protokoll-Aktionen.
 */

export type Recht =
  | 'zeit.erfassen'
  | 'zeit.team'
  | 'zeit.korrigieren'
  | 'abschluss.verwalten'
  | 'berichte.sehen'
  | 'abwesenheit.beantragen'
  | 'abwesenheit.pruefen'
  | 'spesen.erfassen'
  | 'spesen.pruefen'
  | 'kalender.sehen'
  | 'kalender.gruende'
  | 'protokoll.alle'
  | 'zugangscodes.sehen'
  | 'zugangscodes.erfassen'
  | 'zugangscodes.verwalten'
  | 'mitarbeiter.verwalten'
  | 'einstellungen.verwalten'
  | 'apps.verwalten';

export interface RechtBedeutung {
  label: string;
  /** Was das Recht konkret erlaubt — steht in der Mitarbeiterverwaltung neben dem Haken. */
  beschreibung: string;
}

export const RECHTE: Record<Recht, RechtBedeutung> = {
  'zeit.erfassen': {
    label: 'Zeit erfassen',
    beschreibung: 'Stempeln und eigene Einträge anlegen, ändern und bestätigen.',
  },
  'zeit.team': {
    label: 'Team-Zeiten sehen',
    beschreibung: 'Die Zeiten und Konten aller Mitarbeitenden einsehen und drucken.',
  },
  'zeit.korrigieren': {
    label: 'Fremde Zeiten korrigieren',
    beschreibung: 'Einträge und Tagesarten anderer Mitarbeitender ändern.',
  },
  'abschluss.verwalten': {
    label: 'Monatsabschluss',
    beschreibung: 'Monate abschließen und wieder öffnen.',
  },
  'berichte.sehen': {
    label: 'Berichte',
    beschreibung: 'Auswertungen über alle Mitarbeitenden sehen und als CSV exportieren.',
  },
  'abwesenheit.beantragen': {
    label: 'Abwesenheit beantragen',
    beschreibung: 'Eigene Abwesenheiten beantragen und melden.',
  },
  'abwesenheit.pruefen': {
    label: 'Abwesenheit prüfen',
    beschreibung: 'Anträge genehmigen oder zurückweisen, Bescheinigungen und Urlaubsübertrag pflegen.',
  },
  'spesen.erfassen': {
    label: 'Reisen erfassen',
    beschreibung: 'Eigene Reisen anlegen und zur Prüfung einreichen.',
  },
  'spesen.pruefen': {
    label: 'Spesen prüfen',
    beschreibung: 'Eingereichte Reisen aller Mitarbeitenden prüfen und entscheiden.',
  },
  'kalender.sehen': {
    label: 'Teamkalender sehen',
    beschreibung: 'Sehen, wer im Team abwesend ist — ohne den Grund.',
  },
  'kalender.gruende': {
    label: 'Abwesenheitsgründe sehen',
    beschreibung: 'Im Teamkalender auch die Art fremder Abwesenheiten sehen.',
  },
  'protokoll.alle': {
    label: 'Gesamtes Protokoll',
    beschreibung: 'Den vollständigen Nachweis aller Konten lesen — nicht nur die eigene Spur.',
  },
  'zugangscodes.sehen': {
    label: 'Zugangscodes sehen',
    beschreibung: 'Die Einmalcodes des eigenen Leserkreises ablesen.',
  },
  'zugangscodes.erfassen': {
    label: 'Zugangscodes hinterlegen',
    beschreibung: 'Eigene Zugänge anlegen und pflegen — nur für sich oder mit ausgewählten Personen geteilt.',
  },
  'zugangscodes.verwalten': {
    label: 'Zugangscodes verwalten',
    beschreibung: 'Jeden Zugang sehen, ändern und entfernen; Freigaben für alle oder für Rollen.',
  },
  'mitarbeiter.verwalten': {
    label: 'Mitarbeiter verwalten',
    beschreibung: 'Konten anlegen, ändern, deaktivieren, Passwörter zurücksetzen.',
  },
  'einstellungen.verwalten': {
    label: 'Einstellungen',
    beschreibung: 'Unternehmensweite Einstellungen ändern.',
  },
  'apps.verwalten': {
    label: 'Verbundene Apps',
    beschreibung: 'Andere Anwendungen registrieren, die sich über MedArbeiter anmelden — Zugangsdaten anlegen, ändern, sperren.',
  },
};

export const ALLE_RECHTE = Object.keys(RECHTE) as Recht[];

export function istRecht(x: string): x is Recht {
  return Object.hasOwn(RECHTE, x);
}

// ---------------------------------------------------------------------------
// Rollen — vordefinierte Bündel
// ---------------------------------------------------------------------------

export type Rolle = 'mitarbeiter' | 'fulfillment' | 'vertrieb' | 'verwaltung' | 'geschaeftsfuehrung';

/**
 * Was jedes Konto können muss, um seinen eigenen Datensatz zu führen. Auch
 * das sind Rechte und keine Selbstverständlichkeiten — sie stehen nur in
 * jeder Rolle, damit „alles braucht ein Recht" ohne Ausnahme gilt.
 */
const GRUNDRECHTE: readonly Recht[] = [
  'zeit.erfassen',
  'abwesenheit.beantragen',
  'spesen.erfassen',
  'kalender.sehen',
  'zugangscodes.sehen',
  'zugangscodes.erfassen',
];

export interface RollenBedeutung {
  label: string;
  rechte: readonly Recht[];
}

export const ROLLEN: Record<Rolle, RollenBedeutung> = {
  mitarbeiter: {label: 'Mitarbeiter', rechte: GRUNDRECHTE},
  fulfillment: {label: 'Fulfillment', rechte: GRUNDRECHTE},
  vertrieb: {label: 'Vertrieb', rechte: GRUNDRECHTE},
  verwaltung: {label: 'Verwaltung', rechte: ALLE_RECHTE},
  geschaeftsfuehrung: {label: 'Geschäftsführung', rechte: ALLE_RECHTE},
};

export const ALLE_ROLLEN = Object.keys(ROLLEN) as Rolle[];

export function istRolle(x: string): x is Rolle {
  return Object.hasOwn(ROLLEN, x);
}

/** Deutsches Etikett einer Rolle; unbekannte Schlüssel (alte Protokollzeilen) bleiben, wie sie sind. */
export function rolleLabel(rolle: string): string {
  return istRolle(rolle) ? ROLLEN[rolle].label : rolle;
}

/** Die Rollen, deren Bündel ein bestimmtes Recht enthält — z. B. für die „letztes Verwalterkonto"-Sperre. */
export function rollenMitRecht(recht: Recht): Rolle[] {
  return ALLE_ROLLEN.filter((rolle) => ROLLEN[rolle].rechte.includes(recht));
}

/** Rollenbündel ∪ Zusatzrechte, dedupliziert und in Vokabular-Reihenfolge. */
export function effektiveRechte(rolle: string, extra: readonly string[] = []): Recht[] {
  const menge = new Set<string>([...(istRolle(rolle) ? ROLLEN[rolle].rechte : []), ...extra]);
  return ALLE_RECHTE.filter((recht) => menge.has(recht));
}

/**
 * Die eine Rechteprüfung. Trägt der Benutzer seine wirksamen Rechte schon bei
 * sich (die Sitzung lädt sie in `getSessionUser()`), zählen die; sonst greift
 * das vordefinierte Bündel seiner Rolle — so bleibt die Prüfung rein und
 * funktioniert auch für Zeilen, die ohne Zusatzrechte aus der Tabelle kommen.
 */
export function hatRecht(
  traeger: {role: string; rechte?: readonly string[]},
  recht: Recht,
): boolean {
  if (traeger.rechte) return traeger.rechte.includes(recht);
  return istRolle(traeger.role) && ROLLEN[traeger.role].rechte.includes(recht);
}
