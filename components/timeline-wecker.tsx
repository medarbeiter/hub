'use client';

import {usePathname, useRouter} from 'next/navigation';
import {useEffect, useRef} from 'react';
import type {NeuesEreignis} from '@/lib/timeline-wecker';
import {useMelde} from './melde';

const TAKT_MS = 60_000;
const STEHT_MS = 10_000;

/**
 * Meldet, was in der Timeline neu ist — als Meldung unten rechts, zehn
 * Sekunden lang. Fragt einmal je Minute, und nur solange das Fenster
 * sichtbar ist: ein verdecktes Fenster fragt nichts und holt beim Wiederkommen
 * sofort nach. Zeichnet selbst nichts.
 */
export function TimelineWecker({start}: {start: number}) {
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
        const daten: {jetzt: number; ereignisse: NeuesEreignis[]} = await antwort.json();
        seit.current = daten.jetzt;
        for (const e of daten.ereignisse) {
          const erfolg = e.art === 'ziel_erreicht' || e.art === 'jubilaeum' || e.art === 'eintritt';
          melde({
            ton: erfolg ? 'erfolg' : 'hinweis',
            dauerhaft: false,
            autoHideDuration: STEHT_MS,
            uniqueID: `timeline-${e.id}`,
            titel: e.titel,
            text: e.beschreibung,
            aktionen: [{label: 'Zur Timeline', onClick: () => router.push('/timeline')}],
          });
        }
        if (daten.ereignisse.length && pfadRef.current.startsWith('/timeline')) router.refresh();
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

  return null;
}
