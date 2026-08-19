// Der Bildausschnitt (rein, browsertauglich) — dieselbe Trennung wie
// `lib/pausenschnitt.ts` von `lib/time.ts`: die Rechnung steht für sich,
// gezeichnet wird sie in `components/bild-zuschnitt.tsx`.
//
// Ein Ausschnitt ist ein **Quadrat in Bildpixeln**: Kantenlänge `seite`, Mitte
// (`x`, `y`). Quadratisch, weil das Bild später überall im Haus quadratisch
// beschnitten steht; in Bildpixeln, weil daraus sowohl die Vorschau als auch
// der Canvas-Aufruf rechnet und die beiden so nicht auseinanderlaufen können.

export type Ausschnitt = {seite: number; x: number; y: number};

/**
 * Der Ausschnitt bei gegebener Vergrößerung, an den Bildrand geklemmt: Zoom 1
 * ist das größte Quadrat, das ins Bild passt (genau der mittige Beschnitt, den
 * `Avatar` ohnehin zeigt), höhere Werte schneiden enger. Geklemmt wird immer,
 * damit kein Rand ins Bild ragt — auch beim Herauszoomen, wo ein zuvor
 * gültiger Mittelpunkt plötzlich zu weit außen liegt.
 */
export function zuschnitt(breite: number, hoehe: number, zoom: number, x: number, y: number): Ausschnitt {
  const seite = Math.min(breite, hoehe) / Math.max(zoom, 1);
  return {
    seite,
    x: Math.min(Math.max(x, seite / 2), breite - seite / 2),
    y: Math.min(Math.max(y, seite / 2), hoehe - seite / 2),
  };
}
