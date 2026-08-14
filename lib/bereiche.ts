// The four ranges of "Meine Zeit". A leaf module on purpose: the navigator is
// a client component, so anything it imports is pulled into the browser bundle
// — putting this next to periodRecord() would drag lib/time and bun:sqlite in
// with it. Nothing here touches the database.

export type Bereich = 'tag' | 'woche' | 'monat' | 'konto';

/** In zoom order: one day, one week, one month, the whole account. */
export const BEREICHE: Bereich[] = ['tag', 'woche', 'monat', 'konto'];

export const BEREICH_LABELS: Record<Bereich, string> = {
  tag: 'Tag',
  woche: 'Woche',
  monat: 'Monat',
  konto: 'Konto',
};

export function istBereich(value: string | undefined): value is Bereich {
  return value !== undefined && (BEREICHE as string[]).includes(value);
}

/**
 * Welchen Zeitraum und welchen Tag meint diese URL?
 *
 * Zwei Stellen müssen das beantworten und dürfen sich nicht widersprechen: die
 * Seite, die den Zeitraum zeichnet, und die Stempelleiste, die daraus schließt,
 * ob der Kopf der Seite heute schon selbst ausspricht (siehe
 * `components/kopf-deckung.tsx`). Läge die Regel zweimal im Code, hinge die
 * Leiste irgendwann eine Ansicht hinterher.
 *
 * Die alten Formen bleiben lesbar: `?ansicht=heute` heißt `tag`, `?monat=` wird
 * als Datum gelesen. Nach vorn gibt es nichts zu sehen — was hinter heute
 * liegt, ist nicht erfasst, also öffnet kein Zeitraum dort.
 */
export function zeitAusUrl(
  params: {ansicht?: string; monat?: string; tag?: string},
  today: string,
): {ansicht: Bereich; tag: string} {
  const gewuenscht = params.ansicht === 'heute' ? 'tag' : params.ansicht;
  const ansicht: Bereich = istBereich(gewuenscht) ? gewuenscht : 'tag';

  const ausUrl = /^\d{4}-\d{2}-\d{2}$/.test(params.tag ?? '')
    ? params.tag!
    : /^\d{4}-\d{2}$/.test(params.monat ?? '')
      ? `${params.monat}-01`
      : null;

  return {ansicht, tag: ausUrl && ausUrl <= today ? ausUrl : today};
}

// Reisen & Spesen und Abwesenheit sind eigene Bereiche, aber sie teilen ihr
// Zeitraum-Paar: was in Spannen über Tage denkt, wird im Monat gelesen und im
// Jahr summiert. Die Tabs leben hier, damit derselbe Navigator sie zeichnet —
// zwei Navigatoren wären zwei Grammatiken für dieselbe Bewegung.

export type MonatJahrBereich = 'monat' | 'jahr';

export const MONAT_JAHR_BEREICHE: MonatJahrBereich[] = ['monat', 'jahr'];

export const MONAT_JAHR_LABELS: Record<MonatJahrBereich, string> = {
  monat: 'Monat',
  jahr: 'Jahr',
};

export function istMonatJahrBereich(value: string | undefined): value is MonatJahrBereich {
  return value !== undefined && (MONAT_JAHR_BEREICHE as string[]).includes(value);
}
