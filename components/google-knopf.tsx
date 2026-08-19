'use client';

// Der eingebettete Google-Knopf — Googles eigener, personalisierter Knopf samt
// One-Tap-Hinweis: der Browser kennt seine Google-Sitzung, also steht dort
// „Weiter als Jessica" mit Bild, bevor die Anwendung irgendetwas weiß. Ein
// Klick darauf führt in denselben Weiterleitungs-Fluss, den auch der Knopf
// daneben nimmt (/api/google/start) — er sieht nur aus wie Google.
//
// Die Kalender-Freigabe wurde früher direkt hier im Popup geholt. Das kann
// nicht funktionieren: der Klick landet in Googles eigenem Rahmen, unsere
// Seite bekommt davon keine Benutzeraktivierung, und das anschließende
// `window.open` aus dem asynchronen Rückruf wird vom Browser als
// unaufgeforderter Aufklapper geblockt. Der Fluss ist deshalb genau einer.
//
// Fällt das Skript aus (Blocker, offline), rendert dieser Baustein schlicht
// nichts — der klassische Weiterleitungs-Knopf daneben bleibt der Rückweg.

import {useEffect, useRef} from 'react';
import {mitGis} from './gis';

export function GoogleKnopf({
  clientId,
  zurueckPfad,
}: {
  clientId: string;
  /** Wohin nach der erfolgreichen Verknüpfung — `/login` (Assistent) oder `/profil`. */
  zurueckPfad: '/login' | '/profil';
}) {
  const knopfRef = useRef<HTMLDivElement | null>(null);
  const laeuft = useRef(false);

  useEffect(() => {
    let beendet = false;

    const starte = () => {
      if (beendet || !window.google || !knopfRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
        callback: () => {
          // Identität ist bestätigt — die Kalender-Freigabe holt der
          // Weiterleitungs-Fluss, der die Sitzung ohnehin als `login_hint`
          // mitgibt.
          if (laeuft.current) return;
          laeuft.current = true;
          window.location.assign(
            `/api/google/start?zurueck=${zurueckPfad === '/profil' ? 'profil' : 'login'}`,
          );
        },
      });
      window.google.accounts.id.renderButton(knopfRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        locale: 'de',
        width: 320,
      });
      // Der One-Tap-Hinweis oben rechts: „Über Google anmelden als …".
      window.google.accounts.id.prompt();
    };

    const abmelden = mitGis(starte);

    return () => {
      beendet = true;
      abmelden();
      // Der One-Tap-Hinweis gehört nur zu diesem Schritt — beim Verlassen weg damit.
      window.google?.accounts.id.cancel();
    };
  }, [clientId, zurueckPfad]);

  return <div ref={knopfRef} className="google-knopf" />;
}
