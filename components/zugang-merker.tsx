'use client';

import {useEffect} from 'react';
import type {PersonAngabe} from '@/lib/avatar';

/**
 * **Wer sich hier zuletzt angemeldet hat — im Browser gemerkt, nirgends sonst.**
 *
 * Die Anmeldeseite soll das Konto wiedererkennen, das an diesem Gerät arbeitet:
 * Gesicht, Name, vorausgefüllte Adresse. Der naheliegende Weg wäre ein Blick in
 * die Benutzertabelle — und genau der ist ausgeschlossen. Die Anmeldeseite ist
 * die einzige Seite des Hauses, die ohne Sitzung erreichbar ist; was sie von
 * sich aus verrät, verrät sie jedem. Eine Namensliste der Belegschaft gehört
 * nicht dahin.
 *
 * Also merkt es sich das Gerät selbst, nach der Anmeldung, aus der Sitzung, die
 * es ohnehin schon hat. Wer das nicht will, klickt dort „Nicht du?" — das
 * löscht den Eintrag; und wer sich nie angemeldet hat, sieht nichts.
 *
 * Zeichnet nichts. Es schreibt eine Zeile und geht.
 */

export const ZUGANG_MERK_SCHLUESSEL = 'medarbeiter.zuletzt';

export interface ZugangMerk {
  name: string;
  email: string;
  bild: string;
}

export function zugangMerkLesen(): ZugangMerk | null {
  try {
    const roh = window.localStorage.getItem(ZUGANG_MERK_SCHLUESSEL);
    if (!roh) return null;
    const wert = JSON.parse(roh) as Partial<ZugangMerk>;
    return wert.name && wert.email && wert.bild
      ? {name: wert.name, email: wert.email, bild: wert.bild}
      : null;
  } catch {
    // Ein privater Modus oder ein zerschriebener Eintrag ist kein Fehlerfall:
    // dann kennt die Anmeldeseite eben niemanden, wie am ersten Tag.
    return null;
  }
}

export function ZugangMerker({person, email}: {person: PersonAngabe; email: string}) {
  useEffect(() => {
    try {
      const merk: ZugangMerk = {name: person.name, email, bild: person.bild};
      window.localStorage.setItem(ZUGANG_MERK_SCHLUESSEL, JSON.stringify(merk));
    } catch {
      /* Kein Speicher, kein Gedächtnis — mehr passiert nicht. */
    }
  }, [person.name, person.bild, email]);

  return null;
}
