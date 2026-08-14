'use client';

import {useEffect} from 'react';

/**
 * Übersetzt die Sprungmarke der AppShell.
 *
 * Astryx schreibt „Skip to content" fest in die Komponente — ohne Prop und ohne
 * Nachrichtenschlüssel, den `locales/de.json` überschreiben könnte (siehe
 * `AppShell.tsx`, `data-testid="skip-to-content"`). Es ist damit die einzige
 * englische Zeichenkette der Oberfläche, und ausgerechnet die erste, die eine
 * Tastaturbedienung hört.
 *
 * Über CSS ließe sich nur das Sichtbare tauschen — der zugängliche Name bliebe
 * englisch und beides liefe auseinander. Deshalb der Textknoten selbst. Die
 * Marke ist statisch, React zeichnet sie nach dem Einhängen nicht neu; und weil
 * sie erst mit dem Tastaturfokus erreichbar wird, ist der Zeitpunkt nach der
 * Hydration früh genug.
 *
 * Fällt die Marke weg oder bekommt Astryx eine Prop dafür, kann diese
 * Komponente ersatzlos verschwinden.
 */
const DEUTSCH = 'Zum Inhalt springen';

export function SprungmarkeDeutsch() {
  useEffect(() => {
    const marke = document.querySelector('[data-testid="skip-to-content"]');
    if (marke && marke.textContent !== DEUTSCH) marke.textContent = DEUTSCH;
  }, []);
  return null;
}
