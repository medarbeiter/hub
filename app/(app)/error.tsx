'use client';

import {Banner, Button, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {useEffect} from 'react';
import {Sinnbild} from '@/components/sinnbilder';

/**
 * Unexpected failure inside the authenticated shell. Says what happened, what
 * is safe (recorded times are not lost), and offers the one useful action.
 */
export default function Error({error, reset}: {error: Error & {digest?: string}; reset: () => void}) {
  useEffect(() => {
    console.error('[MedArbeiter]', error);
  }, [error]);

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={0.5}>
        <Heading level={1}>Diese Seite konnte nicht geladen werden</Heading>
        <Text type="supporting" color="secondary">
          Deine erfassten Zeiten sind davon nicht betroffen – es ist nichts verloren gegangen.
        </Text>
      </VStack>
      <Banner
        status="error"
        title="Unerwarteter Fehler"
        description={
          error.digest
            ? `Bitte erneut versuchen. Falls es wieder auftritt, nenne der Verwaltung diese Kennung: ${error.digest}`
            : 'Bitte erneut versuchen. Falls es wieder auftritt, wende dich an die Verwaltung.'
        }
      />
      <HStack gap={2}>
        <Button
          label="Erneut versuchen"
          variant="primary"
          icon={<Sinnbild sinn="erneut" />}
          onClick={() => reset()}
        />
      </HStack>
    </VStack>
  );
}
