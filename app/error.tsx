'use client';

import {Banner, Button, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {useEffect} from 'react';
import {Sinnbild} from '@/components/sinnbilder';

/**
 * Das Netz unter den Seiten *außerhalb* der angemeldeten Schale — Anmeldung,
 * Einrichtung, Freigabe, Druckansicht. `app/(app)/error.tsx` fängt nur, was
 * darin passiert; hier fiel ein Fehler bis zu Next' eigener Anzeige durch, die
 * englisch ist und niemandem sagt, was zu tun ist.
 *
 * Gefangen wird hier, was `lib/aktion.ts` nicht abfangen kann: das Abmelden
 * trägt seine Server-Aktion bewusst unumhüllt am Formular, damit es ohne
 * JavaScript funktioniert (siehe `app-nav.tsx`) — und genau dann kann es die
 * veraltete Aktions-ID einer lange offenen Seite treffen.
 *
 * „Erneut versuchen" allein hilft dagegen nicht: `reset()` rendert denselben
 * alten Build noch einmal. Darum steht das Neuladen gleichberechtigt daneben —
 * es holt den aktuellen Build und ist bei einer veralteten Seite das einzige,
 * was wirkt.
 */
export default function Error({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  useEffect(() => {
    console.error('[MedArbeiter]', error);
  }, [error]);

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={0.5}>
        <Heading level={1}>Das hat nicht geklappt</Heading>
        <Text type="supporting" color="secondary">
          Deine erfassten Zeiten sind davon nicht betroffen – es ist nichts verloren gegangen.
        </Text>
      </VStack>
      <Banner
        status="error"
        title="Unerwarteter Fehler"
        description={
          error.digest
            ? `Bitte die Seite neu laden. Falls es wieder auftritt, nenne der Verwaltung diese Kennung: ${error.digest}`
            : 'Bitte die Seite neu laden. Falls es wieder auftritt, wende dich an die Verwaltung.'
        }
      />
      <HStack gap={2}>
        <Button
          label="Seite neu laden"
          variant="primary"
          icon={<Sinnbild sinn="erneut" />}
          onClick={() => window.location.reload()}
        />
        <Button label="Erneut versuchen" variant="secondary" onClick={() => reset()} />
      </HStack>
    </VStack>
  );
}
