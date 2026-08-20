import Image from 'next/image';
import {redirect} from 'next/navigation';
import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {getSessionUser} from '@/lib/auth';
import {FreigabeFormulare} from '@/components/freigabe-formulare';
import {PersonZeichen} from '@/components/person-zeichen';
import {personAngabe} from '@/lib/avatar';
import {oauthClientById} from '@/lib/oauth-apps';
import {onboardingIstFertig} from '@/lib/onboarding';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Freigabe – MedArbeiter Hub'};

/**
 * Die Freigabeseite einer App-Anmeldung: der Autorisierungs-Endpunkt schickt
 * die angemeldete Person hierher, und erst ihr Klick stellt den Code aus
 * (POST /api/oauth/authorize). Schalenlos wie die Anmeldung selbst — wer hier steht,
 * ist auf dem Weg in eine andere App, nicht im Hub.
 *
 * Der Aufbau folgt Googles Einwilligungsblatt, weil es das eine ist, das jede
 * Person hier schon kennt: oben die Anmeldestelle, dann „Weiter zu <App>" als
 * Ziel, das Konto als umrandeter Ausweis in der Mitte, die Folgen als ein
 * Satz — und die Entscheidung heißt „Weiter", nicht noch einmal „Anmelden".
 */
export default async function FreigabeSeite({
  searchParams,
}: {
  searchParams: Promise<{client_id?: string; redirect_uri?: string; state?: string}>;
}) {
  const {client_id = '', redirect_uri = '', state = ''} = await searchParams;

  // Jede Lücke geht zurück an den Autorisierungs-Endpunkt: der kennt für alle
  // Fälle die richtige Antwort — 400-Seite, Fehler-Rücksprung oder /login —
  // und schickt nur vollständige, geprüfte Anfragen wieder hierher.
  const autorisierung =
    `/api/oauth/authorize?client_id=${encodeURIComponent(client_id)}` +
    `&redirect_uri=${encodeURIComponent(redirect_uri)}&response_type=code&state=${encodeURIComponent(state)}`;

  const client = oauthClientById(client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri) || !state) redirect(autorisierung);
  const user = await getSessionUser();
  if (!user || !onboardingIstFertig(user.id)) redirect(autorisierung);

  return (
    <main className="zugang-seite">
      <VStack className="zugang-rahmen" width="100%" gap={4} paddingInline={4} hAlign="center">
        <Card className="zugang-karte" padding={0} width="100%" elevation="med">
          <VStack gap={0}>
            {/* Die Kopfzeile ist das Markenband, nicht die Frage der Seite —
                als h2 in Zeilengröße bleibt sie einzeilig neben dem Logo,
                die eigentliche Überschrift ist das „Weiter zu <App>". */}
            <HStack className="zugang-kopf" gap={3} paddingInline={5} paddingBlock={3} vAlign="center" wrap="nowrap">
              <Image className="zugang-logo-marke" src="/logo-mark.png" alt="MedArbeiter" width={40} height={40} priority />
              <Heading level={2}>Mit MedArbeiter anmelden</Heading>
            </HStack>
            <VStack gap={5} padding={5}>
              <VStack gap={3} hAlign="start">
                <Heading level={1}>Weiter zu {client.name}</Heading>
                {/* Welches Konto gleich weitergereicht wird, ist die eine Frage
                    dieser Seite — es steht deshalb als umrandeter Ausweis da,
                    wie das Kontoschild bei Google. */}
                <HStack className="freigabe-konto" gap={2} paddingInline={4} paddingBlock={2} vAlign="center" wrap="nowrap">
                  <PersonZeichen
                    person={personAngabe(user)}
                    groesse="karte"
                    mitName
                    betont
                    unterzeile={user.email}
                  />
                </HStack>
              </VStack>
              <Text type="supporting" color="secondary">
                Wenn du fortfährst, gibt MedArbeiter Name, E-Mail-Adresse sowie Rolle und Rechte
                dieses Kontos an {client.name} weiter. Dein Passwort bleibt bei MedArbeiter.
              </Text>
              <FreigabeFormulare
                clientId={client.client_id}
                redirectUri={redirect_uri}
                state={state}
                appName={client.name}
              />
            </VStack>
          </VStack>
        </Card>
      </VStack>
    </main>
  );
}
