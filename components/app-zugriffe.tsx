'use client';

import {useState, useTransition} from 'react';
import {Button, Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {appZugriffBeendenAction} from '@/app/actions';
import type {AppAnmeldung} from '@/lib/oauth-apps';
import {fmtDate} from '@/lib/format';
import {useMelde} from './melde';

/**
 * „Angemeldete Apps" auf /profil: die Hausanwendungen, bei denen sich diese
 * Person über den Hub angemeldet hat — mit letztem Zeitpunkt und dem eigenen
 * Widerruf. Das Gegenstück zur Verwaltungssicht auf /apps: dort die
 * Anbindungen des Hauses, hier das eigene Konto. Ein Fehler beim Beenden ist
 * ein einmaliges Ereignis und geht als Toast (useMelde), wie jede
 * zeilengebundene Server-Aktion.
 */
export function AppZugriffe({apps}: {apps: AppAnmeldung[]}) {
  const melde = useMelde();
  const [, starte] = useTransition();
  const [laeuft, setLaeuft] = useState<number | null>(null);

  const beenden = (clientNummer: number) => {
    setLaeuft(clientNummer);
    starte(async () => {
      const ergebnis = await appZugriffBeendenAction(clientNummer);
      setLaeuft(null);
      if (ergebnis.error) {
        melde({ton: 'fehler', titel: 'Zugriff nicht beendet', text: ergebnis.error});
      }
    });
  };

  return (
    <Card padding={4} maxWidth={680}>
      <VStack gap={3}>
        <VStack gap={1}>
          <Heading level={2}>Angemeldete Apps</Heading>
          <Text type="supporting" color="secondary">
            Bei diesen Hausanwendungen hast du dich über den Hub angemeldet. „Zugriff beenden"
            widerruft, was der Hub der App über dein Konto herausgibt — eine offene Sitzung in
            der App selbst endet erst mit deren eigener Abmeldung.
          </Text>
        </VStack>
        <VStack gap={3}>
          {apps.map((app) => (
            <HStack key={app.clientNummer} gap={3} vAlign="center" justify="between" wrap="nowrap">
              <VStack gap={0}>
                <Text>{app.name}</Text>
                <Text type="supporting" color="secondary">
                  Zuletzt angemeldet am {fmtDate(app.zuletztAt.slice(0, 10))}
                </Text>
              </VStack>
              <Button
                label="Zugriff beenden"
                variant="secondary"
                size="sm"
                isLoading={laeuft === app.clientNummer}
                isDisabled={laeuft !== null && laeuft !== app.clientNummer}
                onClick={() => beenden(app.clientNummer)}
              />
            </HStack>
          ))}
        </VStack>
      </VStack>
    </Card>
  );
}
