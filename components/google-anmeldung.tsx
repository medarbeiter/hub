'use client';

// Anmeldung über Google — Googles eigener, personalisierter Knopf samt
// One-Tap-Hinweis unter dem Passwortformular. Das ID-Token geht an
// /api/google/anmelden, wo es gegen Google geprüft und auf ein aktives
// Mitarbeiterkonto abgebildet wird; hier im Browser wird ihm nichts geglaubt.
// Lädt das GIS-Skript nicht (Blocker, offline), bleibt schlicht das
// Passwortformular — es fehlt dann nichts, nur die Abkürzung.

import {Banner, Text, VStack} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';
import {mitGis} from './gis';

export function GoogleAnmeldung({clientId}: {clientId: string}) {
  const knopfRef = useRef<HTMLDivElement | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const laeuft = useRef(false);

  useEffect(() => {
    const starte = () => {
      if (!window.google || !knopfRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        use_fedcm_for_prompt: true,
        cancel_on_tap_outside: true,
        callback: async (antwort) => {
          if (!antwort.credential || laeuft.current) return;
          laeuft.current = true;
          const post = await fetch('/api/google/anmelden', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({credential: antwort.credential}),
          }).catch(() => null);
          const daten = post
            ? ((await post.json().catch(() => null)) as {ok?: boolean; ziel?: string; fehler?: string} | null)
            : null;
          if (post?.ok && daten?.ok && daten.ziel) {
            window.location.assign(daten.ziel);
          } else {
            laeuft.current = false;
            setFehler(daten?.fehler ?? 'Die Anmeldung über Google ist fehlgeschlagen. Bitte versuche es erneut.');
          }
        },
      });
      window.google.accounts.id.renderButton(knopfRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        locale: 'de',
        width: 320,
      });
      // Der One-Tap-Hinweis: der Browser kennt seine Google-Sitzung und
      // schlägt sie von sich aus vor.
      window.google.accounts.id.prompt();
    };

    const abmelden = mitGis(starte);
    return () => {
      abmelden();
      window.google?.accounts.id.cancel();
    };
  }, [clientId]);

  return (
    <VStack gap={3}>
      <Text type="supporting" color="secondary" justify="center" as="p">
        oder
      </Text>
      {fehler && <Banner status="error" title={fehler} />}
      <div ref={knopfRef} className="google-knopf" />
    </VStack>
  );
}
