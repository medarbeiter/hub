'use client';

import {useEffect, useState, type ReactNode} from 'react';
import {Button, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {Sinnbild} from '@/components/sinnbilder';

/**
 * Die Entscheidung der Freigabeseite: zwei normale POST-Formulare, weil danach
 * eine externe OAuth-Weiterleitung folgt und keine RSC-Navigation. Genau darum
 * greift hier auch `useFormStatus` nicht — es liest nur React-verwaltete
 * Aktionen, ein URL-Formular meldet für immer „bereit". Der Zustand wohnt
 * deshalb im onSubmit.
 *
 * Nach dem Klick wird die Seite sichtbar zum Übergabeblatt: Frage, Ausweis und
 * Knöpfe treten ab, und an ihrer Stelle steht, wohin es gerade geht. Versteckt
 * wird per `hidden`, nie entfernt — das absendende Formular muss im DOM
 * bleiben, sonst bräche der Browser die begonnene Absendung ab. Die
 * Statuszeile steht dauerhaft im Baum, damit die Live-Region vor ihrem Inhalt
 * existiert.
 */
export function FreigabeFormulare({
  clientId,
  redirectUri,
  state,
  appName,
  children,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
  appName: string;
  /** Frage, Kontoschild und Datenliste — serverseitig gebaut, hier nur auf- und abgetreten. */
  children: ReactNode;
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
    <>
      <section hidden={laden !== null}>
        <VStack gap={5} padding={5}>
          {children}
          <HStack gap={2} justify="end">
            <form action="/api/oauth/authorize" method="post" onSubmit={() => setLaden('abbrechen')}>
              {felder('abbrechen')}
              <Button
                type="submit"
                variant="secondary"
                label="Abbrechen"
                icon={<Sinnbild sinn="zurueckweisen" />}
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
                endContent={<Sinnbild sinn="weiter" />}
                isLoading={laden === 'anmelden'}
                isDisabled={laden === 'abbrechen'}
              />
            </form>
          </HStack>
        </VStack>
      </section>
      <VStack gap={2} paddingInline={5} paddingBlock={laden !== null ? 8 : 0} hAlign="center">
        {laden !== null && (
          <Heading level={3} accessibilityLevel={1}>
            {laden === 'anmelden' ? `Weiter zu ${appName} …` : `Zurück zu ${appName} …`}
          </Heading>
        )}
        {/* Immer im Baum, damit die Live-Region vor ihrem Inhalt existiert. */}
        <Text type="supporting" color="secondary" role="status">
          {laden === 'anmelden' && `Anmeldung freigegeben, du wirst zu ${appName} weitergeleitet …`}
          {laden === 'abbrechen' && `Abgebrochen, du wirst zu ${appName} zurückgeleitet …`}
        </Text>
      </VStack>
    </>
  );
}
