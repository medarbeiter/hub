'use client';

import {useEffect, useRef, useState} from 'react';

const RING_RADIUS = 7;
const RING_UMFANG = 2 * Math.PI * RING_RADIUS;

/**
 * Eine Restzeit als schwindender Bogen — wann etwas wechselt oder geht, nicht
 * als tickende Zahl. Der Bogen beginnt oben und nimmt im Uhrzeigersinn ab;
 * ab `warnAb` Millisekunden warnt Orange. Die Geometrie ist SVG-eigenes Maß
 * (keine Gestaltungsgröße, die ein Token sagen könnte); die Farben sind Tokens
 * und kontrastgeprüft. Der 1-s-Übergang auf dem Bogen (`.code-ring-bogen`,
 * globals.css) füllt die Lücke zwischen zwei Sekundenschritten.
 */
export function TaktRing({
  restMs,
  gesamtMs,
  label,
  warnAb = 5000,
}: {
  restMs: number;
  gesamtMs: number;
  /** Ohne Beschriftung ist der Ring Schmuck (`aria-hidden`). */
  label?: string;
  warnAb?: number;
}) {
  const anteil = Math.max(0, Math.min(1, restMs / gesamtMs));
  const knapp = restMs <= warnAb;
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{flexShrink: 0}}
    >
      <circle cx={9} cy={9} r={RING_RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={2} />
      <circle
        className="code-ring-bogen"
        cx={9}
        cy={9}
        r={RING_RADIUS}
        fill="none"
        stroke={knapp ? 'var(--color-warning)' : 'var(--color-icon-secondary)'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={RING_UMFANG}
        strokeDashoffset={RING_UMFANG * (1 - anteil)}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

/**
 * Der Ring einer Meldung, die von selbst geht: läuft `ms` herunter und hält
 * an, wenn Astryx' Meldung anhält — beim Zeigen, beim Fokus, bei verlassenem
 * Fenster. Die Meldung selbst kennt keinen Rückkanal für ihre Restzeit, also
 * hört der Ring auf dieselben Ereignisse am nächsten `role="status"`-Element.
 * Ohne Beschriftung: die Meldung ist `aria-atomic`, ein sich sekündlich
 * ändernder Text würde sie sekündlich neu vorlesen.
 */
export function AblaufRing({ms}: {ms: number}) {
  const [rest, setRest] = useState(ms);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let takt: number | null = null;
    const start = () => {
      if (takt !== null) return;
      setRest((r) => Math.max(0, r - 1000));
      takt = window.setInterval(() => setRest((r) => Math.max(0, r - 1000)), 1000);
    };
    const halt = () => {
      if (takt !== null) window.clearInterval(takt);
      takt = null;
    };
    const wirt = ref.current?.closest<HTMLElement>('[role="status"],[role="alert"]');
    wirt?.addEventListener('mouseenter', halt);
    wirt?.addEventListener('mouseleave', start);
    wirt?.addEventListener('focusin', halt);
    wirt?.addEventListener('focusout', start);
    window.addEventListener('blur', halt);
    window.addEventListener('focus', start);
    start();
    return () => {
      halt();
      wirt?.removeEventListener('mouseenter', halt);
      wirt?.removeEventListener('mouseleave', start);
      wirt?.removeEventListener('focusin', halt);
      wirt?.removeEventListener('focusout', start);
      window.removeEventListener('blur', halt);
      window.removeEventListener('focus', start);
    };
  }, []);
  return (
    <span ref={ref} style={{display: 'contents'}}>
      <TaktRing restMs={rest} gesamtMs={ms} warnAb={0} />
    </span>
  );
}
