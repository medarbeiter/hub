// Die Datumsachse, auf der Spannen liegen — der Monat als Kalenderband.
//
// Rein und clientfähig, und bewusst ein eigenes Modul: Reisen und
// Abwesenheiten zeichnen beide Bänder über denselben Ausschnitt, und wenn die
// Prozentrechnung zweimal im Code stünde, liefe irgendwann das eine Band auf
// einem anderen Maßstab als das andere. Ausgerechnet die Ausrichtung ist das
// Einzige, was diese Bänder überhaupt lesbar macht.
//
// Das hier ist keine Zeitachse: durch eine Tagesbahn läuft eine Stundenachse
// durch einen Tag, hier eine Datumsachse durch einen Monat.

function tagPlus(iso: string, tage: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

export interface Datumsachse {
  /** Jeder Kalendertag des Ausschnitts. */
  tage: string[];
  /** Linke Kante eines Tages in Prozent der Achse. */
  links: (datum: string) => string;
  /** Breite einer Spanne in Prozent der Achse, beide Enden eingeschlossen. */
  breite: (von: string, bis: string) => string;
  /** Mitte eines Tages in Prozent — für die Beschriftung. */
  mitte: (index: number) => string;
  /**
   * Jede wievielte Zahl beschriftet wird. Bei 28–31 Tagen wird die Achse sonst
   * Brei; bei einer kurzen Spanne darf jede zweite stehen.
   */
  schritt: number;
  /**
   * Ist der Ausschnitt zu lang für Tageszahlen?
   *
   * Über einen Monat hinaus trägt keine Achse mehr 30er-Schritte in Ziffern:
   * ein Jahr ergäbe bei `schritt: 5` dreiundsiebzig Zahlen auf etwa
   * sechshundert Pixeln, und genau das stand da — eine ununterbrochene
   * Ziffernkette, aus der sich kein Datum mehr lesen ließ. Ab hier beschriftet
   * die Achse Monate statt Tage.
   */
  langer: boolean;
  /** Der erste Tag jedes Monats im Ausschnitt — die Marken der langen Achse. */
  monatsanfaenge: string[];
}

export function datumsachse(vonISO: string, bisISO: string): Datumsachse {
  const tage: string[] = [];
  for (let d = vonISO; d <= bisISO && tage.length < 400; d = tagPlus(d, 1)) tage.push(d);
  const anzahl = Math.max(tage.length, 1);
  const index = (datum: string) => Math.max(0, Math.min(anzahl - 1, tage.indexOf(datum)));
  return {
    tage,
    links: (datum) => `${(index(datum) / anzahl) * 100}%`,
    breite: (von, bis) => `${((index(bis) - index(von) + 1) / anzahl) * 100}%`,
    mitte: (i) => `${((i + 0.5) / anzahl) * 100}%`,
    schritt: anzahl > 16 ? 5 : 2,
    langer: anzahl > 62,
    // Der erste Tag des Ausschnitts zählt mit, auch wenn er nicht der Erste
    // eines Monats ist: sonst begänne die Achse ohne Anhaltspunkt.
    monatsanfaenge: tage.filter((t, i) => i === 0 || t.slice(8) === '01'),
  };
}
