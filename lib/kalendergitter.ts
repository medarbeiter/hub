// Die Datumsachse, an der Wochengrenze gefaltet.
//
// `lib/datumsachse.ts` legt einen Monat in *eine* Zeile: gut, um Dauern zu
// vergleichen, schlecht, um einen Tag zu finden. Denn die Achse, auf der
// Abwesenheiten, Reisen und Protokollzeilen tatsächlich variieren, ist nicht
// die durchlaufende Zeit — es sind der Wochentag und die Kalenderwoche, und
// genau die wirft ein Band weg. Gemessen: neun Bahnen für eine Abwesenheit,
// 1 % Tinte auf 99 % Spur, und die Frage „kann ich Freitag den 21. weg?" nur
// durch Abzählen von Zellen zu beantworten.
//
// Hier ist dieselbe Rechnung in sieben Spalten. Der Wochentag wird dadurch zur
// Position statt zur Zählaufgabe, Wochenende und Feiertag werden zur Struktur
// statt zur Schraffur, und die Leere kehrt sich um: ein ruhiger Monat ist ein
// stilles Raster, ein voller ist sichtbar dicht.
//
// Rein und clientfähig wie `datumsachse.ts` — und aus demselben Grund ein
// eigenes Modul: vier Oberflächen zeichnen dasselbe Gitter, und läge die
// Faltung viermal im Code, liefe irgendwann eine davon auf einer anderen
// Woche.

import {addDays, kwOf, letzterTagDesMonats, mondayOf, monthOf, weekdayIndex} from './format';

/** Mo–So, so wie ein deutscher Kalender die Woche schreibt. */
export const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** Sonnabend und Sonntag — die zwei Spalten, die von sich aus ruhen. */
export const WOCHENENDE: ReadonlySet<number> = new Set([5, 6]);

export interface GitterTag {
  datum: string;
  /** Die Zahl, die in der Zelle steht. */
  zahl: number;
  /**
   * Gehört der Tag dem Monat, um den es geht? Die erste und die letzte Woche
   * ragen in die Nachbarmonate; diese Tage werden gezeichnet (sonst hätte das
   * Gitter Löcher), aber sie stehen zurück.
   */
  imMonat: boolean;
  /** Spaltenindex 0–6, Montag = 0. */
  spalte: number;
}

export interface GitterWoche {
  /** Die Kalenderwoche, wie sie die Lohnbuchhaltung nennt. */
  kw: number;
  /** Der Montag — der Schlüssel der Zeile. */
  montag: string;
  /** Immer sieben, immer Mo–So. */
  tage: GitterTag[];
}

export interface Kalendergitter {
  /** Der Monat, um den es geht, als YYYY-MM. */
  monat: string;
  /** Vier bis sechs Zeilen. */
  wochen: GitterWoche[];
  /** Jeder gezeichnete Tag, auch die aus den Nachbarmonaten. */
  alleTage: string[];
  /** Nur die Tage des Monats selbst — was eine Summe zählen darf. */
  monatsTage: string[];
}

/**
 * Das Gitter eines Monats: volle Wochen von Montag bis Sonntag, sodass jede
 * Spalte durchgehend ein Wochentag ist.
 */
export function kalendergitter(monat: string): Kalendergitter {
  const erster = `${monat}-01`;
  const letzter = letzterTagDesMonats(monat);
  const start = mondayOf(erster);
  // Bis zum Sonntag der Woche, in der der Monat endet.
  const ende = addDays(letzter, 6 - weekdayIndex(letzter));

  const wochen: GitterWoche[] = [];
  const alleTage: string[] = [];
  for (let montag = start; montag <= ende; montag = addDays(montag, 7)) {
    const tage: GitterTag[] = [];
    for (let i = 0; i < 7; i++) {
      const datum = addDays(montag, i);
      tage.push({
        datum,
        zahl: Number(datum.slice(8)),
        imMonat: monthOf(datum) === monat,
        spalte: i,
      });
      alleTage.push(datum);
    }
    wochen.push({kw: kwOf(montag), montag, tage});
  }

  return {
    monat,
    wochen,
    alleTage,
    monatsTage: alleTage.filter((t) => monthOf(t) === monat),
  };
}

// ---------------------------------------------------------------------------
// Das Jahr ist eine andere Frage
// ---------------------------------------------------------------------------
//
// Ein Jahr als 365-Tage-Bahn ergab 1,2 px je Tag: ein zwölftägiger Urlaub war
// acht Pixel breit, und weil ~104 Wochenendzellen bei dieser Auflösung zu einem
// durchgehenden Karo verschmelzen, musste die Ruhetags-Hinterlegung oberhalb
// von 62 Tagen sogar abgeschaltet werden — übrig blieb eine Spur ganz ohne
// Struktur.
//
// Mit der Auflösung wechselt aber auch die Frage. Im Jahr fragt niemand „an
// welchem Tag", sondern „in welchen Wochen" und „wer hat wie viel verbraucht".
// 52 Spalten sind dafür lesbar, 365 sind es nie.

export interface RasterWoche {
  kw: number;
  montag: string;
  sonntag: string;
  /** Ob die Woche überhaupt in das Jahr hineinragt. */
  imJahr: boolean;
}

/**
 * Die Wochen eines Jahres, als Spalten eines Rasters.
 *
 * Gezählt wird nach ISO: die Woche gehört dem Jahr, in dem ihr Donnerstag
 * liegt. Ein Jahr hat danach 52 oder 53 Wochen — die Reihe wird also berechnet
 * und nicht auf 52 festgenagelt, sonst fiele in einem 53-Wochen-Jahr (2026 ist
 * keins, 2020 war eins) die letzte Woche stumm heraus.
 */
export function wochenraster(jahr: string): RasterWoche[] {
  const wochen: RasterWoche[] = [];
  // Der 4. Januar liegt nach ISO immer in der ersten Kalenderwoche.
  let montag = mondayOf(`${jahr}-01-04`);
  for (let i = 0; i < 53; i++) {
    const sonntag = addDays(montag, 6);
    const donnerstag = addDays(montag, 3);
    if (donnerstag.slice(0, 4) !== jahr) break;
    wochen.push({kw: kwOf(montag), montag, sonntag, imJahr: true});
    montag = addDays(montag, 7);
  }
  return wochen;
}

/**
 * Wie voll eine Zelle des Wochenrasters ist: 0–5 Arbeitstage, in vier Stufen.
 *
 * Vier und nicht fünf, weil eine Rampe aus fünf Steinen an ihrem oberen Ende
 * nicht mehr zu unterscheiden ist; die Stufen liegen dort, wo die Unterschiede
 * etwas bedeuten — ein einzelner Tag, ein paar Tage, fast die Woche, die ganze.
 */
export function rasterStufe(tage: number): 0 | 1 | 2 | 3 | 4 {
  if (tage <= 0) return 0;
  if (tage === 1) return 1;
  if (tage <= 3) return 2;
  if (tage <= 4) return 3;
  return 4;
}
