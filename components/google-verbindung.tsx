'use client';

import {Banner, Button, Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {useActionState, useState} from 'react';
import {googleTrennenAction, type ActionState} from '@/app/actions';
import {sicheresFormular} from '@/lib/aktion';

const INITIAL: ActionState = {error: null};

/**
 * Der Stand der Google-Verknüpfung auf der Profilseite. Verbinden ist ein
 * voller Seitenwechsel zu /api/google/start (wie im Einrichtungsassistenten);
 * Trennen räumt erst die von uns angelegten Kalender-Ereignisse ab und
 * widerruft dann den Zugriff. Die Einrichtung bleibt davon unberührt — wer
 * trennt, muss nicht neu durchs Onboarding.
 */
export function GoogleVerbindung({
  konto,
  konfiguriert,
  hinweis,
}: {
  konto: {email: string; seit: string} | null;
  konfiguriert: boolean;
  /** Deutsche Erklärung eines Google-Rücklaufs (`?google=…`), auch die gute Nachricht. */
  hinweis: {ton: 'success' | 'error'; text: string} | null;
}) {
  const [state, formAction, isPending] = useActionState(sicheresFormular(googleTrennenAction), INITIAL);
  const [leiteWeiter, setLeiteWeiter] = useState(false);

  return (
    <Card padding={4} maxWidth={680}>
      <VStack gap={4}>
        <VStack gap={1}>
          <Heading level={2}>Google Kalender</Heading>
          <Text type="supporting" color="secondary">
            Genehmigte Urlaube und gemeldete Abwesenheiten stehen automatisch in deinem Google
            Kalender. Krankmeldungen erscheinen dort nur als „Abwesend“.
          </Text>
        </VStack>
        {hinweis && <Banner status={hinweis.ton} title={hinweis.text} />}
        {state.error && <Banner status="error" title={state.error} />}
        {konto ? (
          <>
            <VStack gap={0.5}>
              <Text type="supporting" color="secondary">Verbundenes Konto</Text>
              <Text weight="medium" as="p">{konto.email}</Text>
              <Text type="supporting" color="secondary">Verbunden seit {konto.seit}</Text>
            </VStack>
            <form action={formAction}>
              <HStack justify="end">
                <Button label="Verbindung trennen" variant="secondary" type="submit" isLoading={isPending} />
              </HStack>
            </form>
          </>
        ) : konfiguriert ? (
          <HStack justify="end">
            <Button
              label="Mit Google verbinden"
              variant="secondary"
              isLoading={leiteWeiter}
              onClick={() => {
                setLeiteWeiter(true);
                window.location.assign('/api/google/start?zurueck=profil');
              }}
            />
          </HStack>
        ) : (
          <Banner
            status="warning"
            title="Die Google-Anbindung ist noch nicht eingerichtet"
            description="Bitte die Verwaltung, die Google-Zugangsdaten der Anwendung zu hinterlegen."
          />
        )}
      </VStack>
    </Card>
  );
}
