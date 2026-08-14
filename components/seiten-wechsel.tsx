import {ViewTransition, type ReactNode} from 'react';

/**
 * Die Bewegungsarten eines Seitenwechsels. Die Schlüssel sind die Arten, die
 * ein Verweis über `transitionTypes` anmeldet; die Werte sind die Klassen, die
 * in globals.css unter `::view-transition-old(.…)` gezeichnet sind. Eine
 * Tabelle statt zweier, damit keine Art existieren kann, die niemand zeichnet.
 *
 * `default: 'none'` ist der wichtigste Eintrag: **es bewegt sich nur, was
 * ausdrücklich eine Art angemeldet hat.** Ohne ihn animierte jede Änderung im
 * Inhaltsbereich die ganze Seite — auch das `router.refresh()` nach jeder
 * Stempelung, das gar keinen Ortswechsel ist.
 */
export const WECHSEL_ARTEN = {
  /** Auf der Zeitachse vorwärts — das Neue kommt von rechts, wie die Zeit läuft. */
  'schritt-vor': 'schritt-vor',
  /** Auf der Zeitachse zurück. */
  'schritt-zurueck': 'schritt-zurueck',
  /** Ein Zoom in einen engeren Zeitraum: Konto → Monat → Woche → Tag. */
  'zoom-nah': 'zoom-nah',
  /** Ein Zoom in einen weiteren Zeitraum: Tag → Woche → Monat → Konto. */
  'zoom-weit': 'zoom-weit',
  /** Ein Wechsel in einen anderen Bereich der Anwendung, aus der Seitenleiste. */
  bereichswechsel: 'wechsel',
  default: 'none',
} as const;

/**
 * Der eine Seitenwechsel.
 *
 * Er sitzt in der Schale um `{children}` und nicht in den einzelnen Seiten,
 * weil genau dort der Inhalt getauscht wird: die Schale bleibt stehen, ihr
 * Inhalt wechselt. React nennt das eine Aktualisierung (`update`) und vergibt
 * dafür einen `view-transition-name` — der Browser hält das alte Bild fest,
 * lässt das neue entstehen und blendet nach den Regeln in globals.css
 * dazwischen.
 *
 * Welche der Bewegungen läuft, entscheidet der Verweis, der angeklickt wurde:
 * `BereichsLink` (components/bereichs-leiste.tsx) meldet Schritt oder Zoom an,
 * die Seitenleiste meldet den Bereichswechsel an. Alles andere — die
 * Zurück-Taste des Browsers, ein `router.refresh()` nach einer Korrektur —
 * bleibt still, und das ist Absicht: eine Seite, die nach jeder Stempelung
 * durchblendet, wäre nicht ruhig, sondern nervös.
 *
 * Ohne Unterstützung im Browser passiert schlicht nichts Sichtbares. Nichts
 * hier trägt Inhalt, alles hier trägt nur Bewegung.
 */
export function SeitenWechsel({children}: {children: ReactNode}) {
  return (
    <ViewTransition name="seiten-inhalt" update={WECHSEL_ARTEN} default="none">
      {children}
    </ViewTransition>
  );
}
