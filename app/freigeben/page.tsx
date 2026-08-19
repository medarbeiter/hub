import Image from 'next/image';
import {redirect} from 'next/navigation';
import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {getSessionUser} from '@/lib/auth';
import {AbsendeKnopf} from '@/components/absende-knopf';
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
            <HStack className="zugang-kopf" gap={3} paddingInline={5} paddingBlock={3} vAlign="center" wrap="nowrap">
              <Image className="zugang-logo-marke" src="/logo-mark.png" alt="MedArbeiter" width={40} height={40} priority />
              <Heading level={1}>Anmeldung freigeben</Heading>
            </HStack>
            <VStack gap={4} padding={5}>
              {/* Welches Konto hier gleich weitergereicht wird, ist die eine
                  Frage dieser Seite — sie steht deshalb als Person da und
                  nicht als Nebensatz. */}
              <PersonZeichen
                person={personAngabe(user)}
                groesse="karte"
                mitName
                betont
                unterzeile={user.email}
              />
              <Text>{client.name} möchte dich über MedArbeiter anmelden – mit diesem Konto.</Text>
              <Text type="supporting" color="secondary">
                Die App erfährt dabei Name, E-Mail-Adresse, Rolle und Rechte deines Kontos.
              </Text>
              <FreigabeFormulare clientId={client.client_id} redirectUri={redirect_uri} state={state} />
            </VStack>
          </VStack>
        </Card>
      </VStack>
    </main>
  );
}

export function FreigabeFormulare({
  clientId,
  redirectUri,
  state,
}: {
  clientId: string;
  redirectUri: string;
  state: string;
}) {
  const felder = (entscheidung: 'abbrechen' | 'anmelden') => (
    <>
      <input type="hidden" name="client_id" value={clientId} />
      <input type="hidden" name="redirect_uri" value={redirectUri} />
      <input type="hidden" name="state" value={state} />
      <input type="hidden" name="entscheidung" value={entscheidung} />
    </>
  );

  return (
    <HStack gap={2} justify="end">
      {/* Ein normaler POST ist hier absichtlich die Protokollgrenze: danach
          folgt eine externe OAuth-Weiterleitung, keine RSC-Navigation. */}
      <form action="/api/oauth/authorize" method="post">
        {felder('abbrechen')}
        <AbsendeKnopf label="Abbrechen" variant="secondary" />
      </form>
      <form action="/api/oauth/authorize" method="post">
        {felder('anmelden')}
        <AbsendeKnopf label="Anmelden" variant="primary" />
      </form>
    </HStack>
  );
}
