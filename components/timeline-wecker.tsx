'use client';

import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useRef, useState} from 'react';
import type {PersonAngabe} from '@/lib/avatar';
import type {Resonanz} from '@/lib/resonanz';
import type {NeuesEreignis} from '@/lib/timeline-wecker';
import {useMelde} from './melde';
import {PersonKarte} from './person-zeichen';

const TAKT_MS = 60_000;
const STEHT_MS = 5_000;
/** Eine Nachricht an mich darf länger stehen als eine Nachricht über andere. */
const RESONANZ_STEHT_MS = 10_000;

/**
 * Meldet, was in der Timeline neu ist — als Meldung unten rechts, fünf
 * Sekunden lang mit schwindendem Ring. Bei einem Ziel steht die Person im
 * Titel („… hat sich ein neues Ziel gesetzt“) und das Ziel darunter. Fragt einmal je Minute, und nur solange das Fenster
 * sichtbar ist: ein verdecktes Fenster fragt nichts und holt beim Wiederkommen
 * sofort nach. Dazu die **Resonanz** an die angemeldete Person — ein
 * Kommentar auf ihrer Karte, eine Reaktion auf ihr Ereignis — mit dem Weg
 * dorthin: die eigene Karte (hier gehängt, weil ein Kommentar nur dort steht)
 * bzw. die Timeline. Zeichnet sonst nichts.
 */
export function TimelineWecker({start, ich}: {start: number; ich: PersonAngabe}) {
  const [karte, setKarte] = useState(false);
  const melde = useMelde();
  const router = useRouter();
  const pfad = usePathname();
  const seit = useRef(start);
  const zuletzt = useRef(0);
  const pfadRef = useRef(pfad);
  pfadRef.current = pfad;

  useEffect(() => {
    let laeuft = false;
    const fragen = async () => {
      if (document.visibilityState !== 'visible' || laeuft) return;
      laeuft = true;
      zuletzt.current = Date.now();
      try {
        const antwort = await fetch(`/api/timeline/neu?seit=${seit.current}`, {cache: 'no-store'});
        if (!antwort.ok) return;
        const daten: {jetzt: number; ereignisse: NeuesEreignis[]; resonanz: Resonanz[]} = await antwort.json();
        seit.current = daten.jetzt;
        for (const e of daten.ereignisse) {
          const erfolg = e.art === 'ziel_erreicht' || e.art === 'jubilaeum' || e.art === 'geburtstag' || e.art === 'eintritt';
          const ziel = e.art.startsWith('ziel_');
          melde({
            ton: erfolg ? 'erfolg' : 'hinweis',
            ablauf: STEHT_MS,
            uniqueID: `timeline-${e.id}`,
            titel: ziel ? e.beschreibung.split(/ [·–] /)[0]! : e.titel,
            text: ziel ? e.titel : e.beschreibung,
            aktionen: [{label: 'Zur Timeline', onClick: () => router.push('/timeline')}],
          });
        }
        for (const r of daten.resonanz) {
          melde({
            ton: 'hinweis',
            ablauf: RESONANZ_STEHT_MS,
            uniqueID: `resonanz-${r.art}-${r.id}`,
            titel: r.art === 'kommentar' ? `${r.von} hat auf deine Karte geschrieben` : `${r.von} hat auf „${r.ereignis}“ reagiert`,
            text: r.art === 'kommentar' ? `„${r.text}“` : r.text,
            aktionen: r.art === 'kommentar'
              ? [{label: 'Zur Karte', onClick: () => setKarte(true)}]
              : [{label: 'Zur Timeline', onClick: () => router.push('/timeline')}],
          });
        }
        if ((daten.ereignisse.length || daten.resonanz.length) && pfadRef.current.startsWith('/timeline')) router.refresh();
      } catch {
        /* ohne Netz: beim nächsten Takt wieder */
      } finally {
        laeuft = false;
      }
    };
    const takt = window.setInterval(fragen, TAKT_MS);
    const zurueck = () => {
      if (document.visibilityState === 'visible' && Date.now() - zuletzt.current > TAKT_MS) fragen();
    };
    document.addEventListener('visibilitychange', zurueck);
    window.addEventListener('focus', zurueck);
    return () => {
      window.clearInterval(takt);
      document.removeEventListener('visibilitychange', zurueck);
      window.removeEventListener('focus', zurueck);
    };
  }, [melde, router]);

  return <PersonKarte person={ich} isOpen={karte} onOpenChange={setKarte} blattHref="/profil" blattText="Zum Profil" />;
}
