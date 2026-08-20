import Image from 'next/image';
import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {Verweis} from '@/components/verweis';

export const metadata = {title: 'Anmeldung nicht möglich – MedArbeiter Hub'};

/**
 * Das Fehlerblatt der App-Anmeldung: hierher schickt der Autorisierungs-
 * Endpunkt, wenn client_id oder redirect_uri nicht stimmen — auf eine
 * ungeprüfte URI wird nie weitergeleitet (RFC 6749 §4.1.2.1), und ein nackter
 * Browsertext war die schlechtest gekleidete Stelle der Anwendung. Dieselbe
 * Karte wie Anmeldung und Freigabe, damit das Blatt als Teil des Hubs lesbar
 * bleibt; bewusst ohne Einzelheiten, welcher Wert fehlte — die stehen dem
 * Betreiber der App zu, nicht der Adressleiste.
 */
export default function FreigabeFehlerSeite() {
  return (
    <main className="zugang-seite">
      <VStack className="zugang-rahmen freigabe-rahmen" width="100%" gap={4} paddingInline={4} hAlign="center">
        <Card className="zugang-karte" padding={0} width="100%" elevation="med">
          <VStack gap={0}>
            <HStack className="zugang-kopf" gap={3} paddingInline={5} paddingBlock={3} vAlign="center" wrap="nowrap">
              <Image className="zugang-logo-marke" src="/logo-mark.png" alt="MedArbeiter Hub" width={40} height={40} priority />
              <Heading level={2}>Mit dem Hub anmelden</Heading>
            </HStack>
            <VStack gap={4} padding={5} hAlign="start">
              <Heading level={3} accessibilityLevel={1}>Anmeldung nicht möglich</Heading>
              <Text color="secondary">
                Die App, die dich hierher geschickt hat, ist dem Hub nicht bekannt oder wurde
                gesperrt. Es wurde nichts freigegeben und niemand angemeldet.
              </Text>
              <Text type="supporting" color="secondary">
                Versuche es aus der App heraus noch einmal. Bleibt es dabei, wende dich an die
                Verwaltung — sie pflegt die App-Anbindungen des Hubs.
              </Text>
              <Verweis href="/">Zum Hub</Verweis>
            </VStack>
          </VStack>
        </Card>
      </VStack>
    </main>
  );
}
