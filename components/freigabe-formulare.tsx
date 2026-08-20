'use client';

import {useEffect, useState} from 'react';
import {Button, HStack, Text, VStack} from '@astryxdesign/core';

/**
 * Die Entscheidung der Freigabeseite: zwei normale POST-Formulare, weil danach
 * eine externe OAuth-Weiterleitung folgt und keine RSC-Navigation. Genau darum
 * greift hier auch `useFormStatus` nicht — es liest nur React-verwaltete
 * Aktionen, ein URL-Formular meldet für immer „bereit". Der Zustand wohnt
 * deshalb im onSubmit: der geklickte Knopf lädt, der andere ist gesperrt, und
 * eine Statuszeile sagt an, wohin es gleich geht.
 */
export function FreigabeFormulare({
  clientId,
  redirectUri,
  state,
  appName,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  appName: string;
}) {
  const [laden, setLaden] = useState<'abbrechen' | 'anmelden' | null>(null);

  // Kommt die Seite über den Zurück-Knopf aus dem Back-Forward-Cache wieder,
  // wäre der Ladezustand sonst eingefroren und beide Knöpfe blieben gesperrt.
  useEffect(() => {
    const zuruecksetzen = (ereignis: PageTransitionEvent) => {
      if (ereignis.persisted) setLaden(null);
    };
    window.addEventListener('pageshow', zuruecksetzen);
    return () => window.removeEventListener('pageshow', zuruecksetzen);
  }, []);

  const felder = (entscheidung: 'abbrechen' | 'anmelden') => (
    <>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="entscheidung" value={entscheidung} />
    </>
  );

  return (
    <VStack gap={3}>
      <HStack gap={2} justify="end">
        <form action="/api/oauth/authorize" method="post" onSubmit={() => setLaden('abbrechen')}>
          {felder('abbrechen')}
          <Button
            type="submit"
            variant="secondary"
            label="Abbrechen"
            isLoading={laden === 'abbrechen'}
            isDisabled={laden === 'anmelden'}
          />
        </form>
        <form action="/api/oauth/authorize" method="post" onSubmit={() => setLaden('anmelden')}>
          {felder('anmelden')}
          <Button
            type="submit"
            variant="primary"
            label="Weiter"
            isLoading={laden === 'anmelden'}
            isDisabled={laden === 'abbrechen'}
          />
        </form>
      </HStack>
      {/* Immer im Baum, damit die Live-Region vor ihrem Inhalt existiert. */}
      <Text type="supporting" color="secondary" role="status">
        {laden === 'anmelden' && `Anmeldung freigegeben – du wirst zu ${appName} weitergeleitet …`}
        {laden === 'abbrechen' && `Abgebrochen – du wirst zu ${appName} zurückgeleitet …`}
      </Text>
    </VStack>
  );
}
