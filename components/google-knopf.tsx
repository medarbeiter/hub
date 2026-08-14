'use client';

// Der eingebettete Google-Knopf — Google Identity Services (GIS) in zwei
// Stufen. Stufe eins ist Googles eigener, personalisierter Knopf samt
// One-Tap-Hinweis: der Browser kennt seine Google-Sitzung, also steht dort
// „Weiter als Jessica" mit Bild, bevor die Anwendung irgendetwas weiß. Stufe
// zwei holt im Popup die eigentliche Berechtigung (Kalender-Scope) als
// Autorisierungscode und reicht ihn an /api/google/popup.
//
// Das ID-Token aus Stufe eins wird hier NUR als Vorauswahl (`hint`) für das
// Einwilligungs-Popup benutzt und nie dem Server als Nachweis vorgelegt —
// verbucht wird ausschließlich, was der Server selbst beim Code-Tausch von
// Googles Token-Endpunkt zurückbekommt. Ein manipuliertes Token im Browser
// kann damit höchstens das falsche Konto vorschlagen.
//
// Fällt das Skript aus (Blocker, offline), rendert dieser Baustein schlicht
// nichts — der klassische Weiterleitungs-Knopf daneben bleibt der Rückweg.

import {Banner, VStack} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';
import {emailAusIdToken, mitGis} from './gis';

const KALENDER_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.events';

export function GoogleKnopf({
  clientId,
  zurueckPfad,
}: {
  clientId: string;
  /** Wohin nach der erfolgreichen Verknüpfung — `/login` (Assistent) oder `/profil`. */
  zurueckPfad: '/login' | '/profil';
}) {
  const knopfRef = useRef<HTMLDivElement | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laeuft = useRef(false);

  useEffect(() => {
    let beendet = false;

    const einwilligung = (hint?: string) => {
      if (laeuft.current || !window.google) return;
      laeuft.current = true;
      window.google.accounts.oauth2
        .initCodeClient({
          client_id: clientId,
          scope: KALENDER_SCOPES,
          ux_mode: 'popup',
          hint,
          callback: async (antwort) => {
            laeuft.current = false;
            if (!antwort.code) {
              if (antwort.error && antwort.error !== 'access_denied') {
                setFehler('Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.');
              }
              return;
            }
            const post = await fetch('/api/google/popup', {
              method: 'POST',
              headers: {'Content-Type': 'application/json'},
              body: JSON.stringify({code: antwort.code}),
            }).catch(() => null);
            const daten = post ? ((await post.json().catch(() => null)) as {ok?: boolean; fehler?: string} | null) : null;
            if (post?.ok && daten?.ok) {
              window.location.assign(`${zurueckPfad}?google=verbunden`);
            } else {
              setFehler(daten?.fehler ?? 'Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.');
            }
          },
        })
        .requestCode();
    };

    const starte = () => {
      if (beendet || !window.google || !knopfRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
        callback: (antwort) => {
          // Identität ist bestätigt — jetzt fehlt nur noch die Kalender-Freigabe,
          // mit dem eben gewählten Konto als Vorauswahl.
          einwilligung(antwort.credential ? emailAusIdToken(antwort.credential) : undefined);
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

  return (
    <VStack gap={3}>
      {fehler && <Banner status="error" title={fehler} />}
      <div ref={knopfRef} className="google-knopf" />
    </VStack>
  );
}
