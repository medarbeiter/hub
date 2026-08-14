'use client';

import {useEffect, useState, type ReactNode} from 'react';

/** Muss zu `--takt-zug` in globals.css passen. */
const TAKT_ZUG_MS = 360;

/**
 * Ein Fach, das an Ort und Stelle aufgeht.
 *
 * Alle drei Stapel der Anwendung — Tage, Reisen, Prüfliste — öffnen eine Zeile
 * in sich selbst statt in einem Bereich daneben. Bisher wurde der Inhalt dabei
 * schlicht gehängt und wieder abgehängt: die Zeilen darunter sprangen.
 *
 * Die Bewegung ist Astryx' eigene Technik für aufklappende Navigationseinträge
 * — `grid-template-rows` von `0fr` auf `1fr`, was eine Höhe animierbar macht,
 * ohne sie zu kennen. Zwei Dinge kommen hier dazu:
 *
 * 1. **Der Inhalt wird erst beim Öffnen gehängt.** Ein Monat mit 31 Tagen soll
 *    nicht 31 Tagestafeln im Baum halten, nur damit eine davon animiert werden
 *    kann. Weil `0fr` die Zeile unabhängig vom Inhalt auf null zieht, darf das
 *    Hängen im selben Commit geschehen wie der Wechsel auf `1fr` — der Übergang
 *    läuft trotzdem, weil der *vorherige* gerenderte Zustand `0fr` war.
 * 2. **Beim Schließen bleibt er hängen, bis die Bewegung durch ist.** Sonst
 *    fiele das Fach in sich zusammen, während es schon leer ist — es würde
 *    zuschnappen statt zuzugehen.
 */
export function Ausklapp({offen, children}: {offen: boolean; children: ReactNode}) {
  const [haengt, setHaengt] = useState(offen);

  // Öffnen noch im Render: der Inhalt muss in demselben Commit stehen, in dem
  // die Zeile auf 1fr geht — ein Effekt käme einen Frame zu spät und die Höhe
  // spränge auf ihren Endwert, statt dorthin zu laufen.
  if (offen && !haengt) setHaengt(true);

  useEffect(() => {
    if (offen) return;
    const zeit = setTimeout(() => setHaengt(false), TAKT_ZUG_MS);
    return () => clearTimeout(zeit);
  }, [offen]);

  return (
    <span className="bahn-ausklapp" data-offen={offen ? 'true' : 'false'}>
      <span>{haengt ? children : null}</span>
    </span>
  );
}
