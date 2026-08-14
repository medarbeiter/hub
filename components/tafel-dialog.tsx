'use client';

import {Dialog, type DialogProps} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';

/** Muss zu `--takt-fort` in globals.css passen. */
const TAKT_FORT_MS = 150;

/**
 * Jede Tafel dieser Anwendung — Eintrag korrigieren, Beleg hinzufügen, Reise
 * erfassen, Mitarbeiter anlegen — geht durch diesen einen Dialog.
 *
 * Astryx bringt den Auftritt schon mit, und zwar einen guten: die Tafel kommt
 * aus der Richtung des Knopfes herein, der sie geöffnet hat. Was fehlte, war
 * der Abgang. Die Bibliothek ruft beim Schließen `dialog.close()`, und weil ein
 * geschlossenes <dialog> sofort aus dem Top-Layer fällt, kann danach nichts
 * mehr animiert werden: die Tafel war im selben Bild weg, während der Schleier
 * dahinter noch ausblendete. Eine Tafel, die anders geht, als sie kommt, ist
 * der auffälligste Bruch, den ein Bewegungssystem haben kann.
 *
 * Deshalb wird das Schließen hier um --takt-fort aufgehalten. In dieser Spanne
 * bleibt der Dialog offen und trägt `.tafel-abgang`, dessen Animation ihn und
 * seinen Schleier hinausträgt; erst danach geht `isOpen` wirklich auf `false`
 * und Astryx schließt. Der Fokus kehrt entsprechend 150 ms später zum Knopf
 * zurück — nicht spürbar, und die Tastaturbedienung bleibt vollständig.
 *
 * Wer die Tafel mit Escape schließt, löst denselben Weg aus: `onOpenChange`
 * ist unverändert die eine Stelle, an der geschlossen wird.
 */
export function TafelDialog({isOpen, className, ...rest}: DialogProps) {
  const [sichtbar, setSichtbar] = useState(isOpen);
  const [geht, setGeht] = useState(false);
  const zuvor = useRef(isOpen);

  useEffect(() => {
    if (isOpen === zuvor.current) return;
    zuvor.current = isOpen;
    if (isOpen) {
      setGeht(false);
      setSichtbar(true);
      return;
    }
    setGeht(true);
    const zeit = setTimeout(() => {
      setSichtbar(false);
      setGeht(false);
    }, TAKT_FORT_MS);
    return () => clearTimeout(zeit);
  }, [isOpen]);

  const klassen = [className, 'tafel-dialog', geht ? 'tafel-abgang' : null].filter(Boolean).join(' ');

  return <Dialog {...rest} isOpen={sichtbar} className={klassen} />;
}
