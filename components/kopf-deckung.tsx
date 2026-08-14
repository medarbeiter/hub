'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/**
 * Die Deckung: sagt die Seite, auf der man gerade steht, den Stand von heute
 * schon selbst?
 *
 * Die Stempelleiste stand bisher auf jeder Route mit demselben Inhalt — auch
 * auf „Meine Zeit / Tag", wo der Kopf dieselbe Zahl in Anzeigegröße trägt, die
 * Bahn den Beginn zeigt und die Feierabend-Marke auf der Achse steht. Zwei
 * Stellen, dieselbe Angabe, keine zwei Meter voneinander entfernt: das ist
 * keine Absicherung, das ist Rauschen.
 *
 * Die Antwort hat zwei Hälften, und beide werden gebraucht:
 *
 *  1. **Welche Ansicht?** — steht in der URL und ist deshalb schon auf dem
 *     Server bekannt (`zeitAusUrl` in `lib/bereiche.ts`). Die Leiste kommt
 *     damit von Anfang an richtig aus dem Server; nichts blitzt beim
 *     Hydrieren auf und fällt dann zusammen.
 *  2. **Steht der Kopf noch im Bild?** — kann nur der Browser wissen, und
 *     genau dafür ist dieses Modul da. Scrollt der Kopf weg, ist die Angabe
 *     fort und die Leiste übernimmt sie wieder.
 *
 * So gibt es zu jedem Zeitpunkt genau einen Ort, an dem heute steht — und nie
 * keinen.
 */
const ImBildContext = createContext(true);
const MeldeContext = createContext<((imBild: boolean) => void) | null>(null);

/**
 * Steht der Kopf, der heute ausspricht, gerade im Bild? Ohne einen solchen Kopf
 * auf der Seite ist die Antwort bedeutungslos — dann entscheidet allein die
 * URL, und die sagt schon nein.
 */
export function useKopfImBild(): boolean {
  return useContext(ImBildContext);
}

export function KopfSichtProvider({children}: {children: ReactNode}) {
  // Voreinstellung: ja. Ein Kopf, der eben erst gerendert wurde, steht oben.
  const [imBild, setImBild] = useState(true);
  // Stabil, damit der Effekt im Melder nicht bei jedem Rendern neu aufsetzt.
  const melde = useCallback((wert: boolean) => setImBild(wert), []);
  return (
    <MeldeContext.Provider value={melde}>
      <ImBildContext.Provider value={imBild}>{children}</ImBildContext.Provider>
    </MeldeContext.Provider>
  );
}

/**
 * Die Schwellen mit Hysterese: die Angabe verlässt den Kopf erst, wenn er zu
 * weniger als der Hälfte im Bild steht, und kehrt erst zurück, wenn er wieder
 * fast ganz da ist. Ein einzelner Schwellwert ließe die Leiste flattern, wenn
 * man genau auf ihm zum Stehen kommt — und ein flackernder Zeitnachweis ist
 * schlimmer als eine doppelte Angabe.
 */
const GEHT = 0.5;
const KOMMT = 0.92;

/**
 * Die klebrige Leiste liegt über dem Inhalt (auf dem Telefon unter ihm). Was
 * hinter ihr steht, ist nicht im Bild — der Rand nimmt ihre Höhe an beiden
 * Enden heraus, damit „sichtbar" auch sichtbar heißt.
 */
const LEISTEN_RAND = '-76px 0px -76px 0px';

/** Fein genug, dass die Rückrufe nahe an den beiden Schwellen wirklich kommen. */
const SCHWELLEN = Array.from({length: 21}, (_, i) => i / 20);

/**
 * Auf dem Server gibt es kein Layout zu messen; `useLayoutEffect` warnte dort
 * nur. Im Browser muss die Meldung aber vor den ersten Anstrich, siehe unten.
 */
const useVorDemAnstrich = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Meldet den Block, in dem er steht, als sichtbar oder nicht. Er misst nicht
 * sich selbst, sondern sein Elternelement — der Kopf ist der Block aus
 * Überschrift, Zahl und Standzeile, und genau der ist die Angabe.
 */
export function HeuteDeckung() {
  const melde = useContext(MeldeContext);
  const anker = useRef<HTMLSpanElement>(null);

  /**
   * „Ich stehe im Bild" — noch vor dem ersten Anstrich, und deshalb als
   * Layout-Effekt. Kommt man von einer gescrollten Tagesansicht zurück, steht
   * sonst kurz das Ergebnis der letzten Messung da: die Angaben wären beim
   * Seitenwechsel einen Moment doppelt zu sehen.
   *
   * Beim Verlassen wieder auf „ja": ohne Kopf ist die Frage bedeutungslos, und
   * ein zurückgelassenes „nein" wäre eine Messung, die niemand mehr vornimmt.
   */
  useVorDemAnstrich(() => {
    if (!melde) return;
    melde(true);
    return () => melde(true);
  }, [melde]);

  useEffect(() => {
    const ziel = anker.current?.parentElement;
    if (!melde || !ziel || typeof IntersectionObserver === 'undefined') return;

    let steht = true;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const anteil = eintraege[eintraege.length - 1]?.intersectionRatio ?? 0;
        const naechst = steht ? anteil >= GEHT : anteil >= KOMMT;
        if (naechst === steht) return;
        steht = naechst;
        melde(naechst);
      },
      {threshold: SCHWELLEN, rootMargin: LEISTEN_RAND},
    );
    beobachter.observe(ziel);
    // Das Zurücksetzen hängt am Layout-Effekt darüber, damit es genau einen Ort
    // gibt, an dem „dieser Kopf ist fort" gesagt wird.
    return () => beobachter.disconnect();
  }, [melde]);

  return <span ref={anker} aria-hidden hidden />;
}
