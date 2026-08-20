/**
 * Das Rechte-Vokabular — eine Handlung, ein Recht.
 *
 * Rein und Client-importierbar, nach demselben Prinzip wie
 * `protokoll-arten.ts`: jede Stelle, die etwas erlaubt oder verbirgt, fragt
 * hier nach einem benannten Recht statt nach einer Rolle. Eine Rolle ist nur
 * noch ein Bündel von Rechten — seit Migration 27 ein in der Anwendung
 * pflegbarer Datensatz (lib/rollen.ts); einzelnen Konten können darüber
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
  | 'profil.kommentieren'
  | 'kalender.sehen'
  | 'kalender.gruende'
  | 'protokoll.alle'
  | 'zugangscodes.sehen'
  | 'zugangscodes.erfassen'
  | 'zugangscodes.verwalten'
  | 'mitarbeiter.verwalten'
  | 'rollen.verwalten'
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
  'profil.kommentieren': {
    label: 'Profile kommentieren',
    beschreibung: 'Auf der Personenkarte einer Kollegin oder eines Kollegen einen Kommentar hinterlassen.',
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
  'rollen.verwalten': {
    label: 'Rollen verwalten',
    beschreibung: 'Rollen anlegen, umbenennen, löschen und ihre Rechtebündel ändern — vergeben lässt sich nur, was man selbst trägt.',
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
// Rollen — Datensätze, kein Vokabular mehr
// ---------------------------------------------------------------------------

/**
 * Eine Rolle ist ein benanntes Rechtebündel und seit Migration 27 ein
 * Datensatz (Tabelle `rollen`, gepflegt in lib/rollen.ts unter dem Recht
 * `rollen.verwalten`). Hier bleibt nur, was rein und Client-importierbar
 * bleiben muss: der Typ, die Etiketten der fünf mitgelieferten Rollen als
 * Rückfall für Protokollzeilen, deren Rolle es nicht mehr gibt, und die
 * Mengenarithmetik. Ein neues Recht erreicht bestehende Rollen nur über eine
 * Migration oder die Rollenverwaltung — die Bündel leben in der Datenbank.
 */
export type Rolle = string;

/** Eine Rolle, wie Server und Formulare sie austauschen. */
export interface RollenEintrag {
  schluessel: string;
  label: string;
  rechte: Recht[];
}

/** Die Etiketten der fünf mitgelieferten Rollen — nur noch Rückfall für alte Schlüssel ohne Datensatz. */
export const STANDARD_ROLLEN_LABEL: Record<string, string> = {
  mitarbeiter: 'Mitarbeiter',
  fulfillment: 'Fulfillment',
  vertrieb: 'Vertrieb',
  verwaltung: 'Verwaltung',
  geschaeftsfuehrung: 'Geschäftsführung',
};

/** Bündel ∪ Zusatzrechte, dedupliziert und in Vokabular-Reihenfolge. */
export function vereinigeRechte(buendel: readonly string[], extra: readonly string[] = []): Recht[] {
  const menge = new Set<string>([...buendel, ...extra]);
  return ALLE_RECHTE.filter((recht) => menge.has(recht));
}

/**
 * Was aus einem Rollenbündel wird, wenn jemand es bearbeitet: verhandelbar
 * sind nur Rechte, die die bearbeitende Person selbst trägt — was sie nicht
 * trägt, kann sie weder vergeben noch entfernen, es bleibt wie es war. So
 * kann ein Konto mit `rollen.verwalten` niemandem geben, was es selbst nie
 * hatte, und nichts stillschweigend abräumen.
 */
export function mischeRechte(
  alt: readonly string[],
  gewuenscht: readonly string[],
  verfuegbar: readonly string[],
): Recht[] {
  const darf = new Set(verfuegbar);
  const neu = new Set<string>(alt.filter((recht) => !darf.has(recht)));
  for (const recht of gewuenscht) if (darf.has(recht)) neu.add(recht);
  return ALLE_RECHTE.filter((recht) => neu.has(recht));
}

/**
 * Die eine Rechteprüfung. Sie zählt ausschließlich die mitgereichten
 * wirksamen Rechte (die Sitzung lädt sie in `getSessionUser()`, andere
 * Träger bauen sie über `wirksameRechte()` in lib/rollen.ts). Ohne geladene
 * Rechte gibt es kein Ja: die Bündel liegen in der Datenbank, und ein fest
 * verdrahteter Rückfall spräche weiter, nachdem jemand die Rolle beschnitten
 * hat.
 */
export function hatRecht(
  traeger: {role: string; rechte?: readonly string[]},
  recht: Recht,
): boolean {
  return traeger.rechte?.includes(recht) ?? false;
}
