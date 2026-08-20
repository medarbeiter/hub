import Image from 'next/image';
import {redirect} from 'next/navigation';
import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {logoutAction} from '@/app/actions';
import {getSessionUser} from '@/lib/auth';
import {AbsendeKnopf} from '@/components/absende-knopf';
import {FreigabeFormulare} from '@/components/freigabe-formulare';
import {PersonZeichen} from '@/components/person-zeichen';
import {Sinnbild} from '@/components/sinnbilder';
import {personAngabe} from '@/lib/avatar';
import {oauthClientById} from '@/lib/oauth-apps';
import {onboardingIstFertig} from '@/lib/onboarding';
import {rolleLabel} from '@/lib/rollen';

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
 * Ziel, das Konto als umrandeter Ausweis mit Kontowechsel darunter, die
 * weitergegebenen Angaben als benannte Werte statt als Fließtextsatz — und
 * die Entscheidung heißt „Weiter", nicht noch einmal „Anmelden".
 */
export default async function FreigabeSeite({
  searchParams,
}: {
  searchParams: Promise<{client_id?: string; redirect_uri?: string; state?: string}>;
}) {
  const {client_id = '', redirect_uri = '', state = ''} = await searchParams;

  // Jede Lücke geht zurück an den Autorisierungs-Endpunkt: der kennt für alle
  // Fälle die richtige Antwort — Fehlerblatt, Fehler-Rücksprung oder /login —
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
      <VStack className="zugang-rahmen freigabe-rahmen" width="100%" gap={4} paddingInline={4} hAlign="center">
        <Card className="zugang-karte" padding={0} width="100%" elevation="med">
          <VStack gap={0}>
            {/* Die Kopfzeile ist das Markenband, nicht die Frage der Seite —
                als h2 in voller Größe, einzeilig dank kurzem Wortlaut und
                dem breiteren Freigabeblatt; die Überschrift der Seite ist das
                „Weiter zu <App>". */}
            <HStack className="zugang-kopf" gap={3} paddingInline={5} paddingBlock={3} vAlign="center" wrap="nowrap">
              <Image className="zugang-logo-marke" src="/logo-mark.png" alt="MedArbeiter Hub" width={40} height={40} priority />
              <Heading level={2}>Mit dem Hub anmelden</Heading>
            </HStack>
            <FreigabeFormulare
              clientId={client.client_id}
              redirectUri={redirect_uri}
              state={state}
              appName={client.name}
            >
              <VStack gap={3} hAlign="start">
                {/* Sichtbar eine Stufe unter dem Kartenmaß, im Dokument die
                    eine Überschrift der Seite. */}
                <Heading level={3} accessibilityLevel={1}>Weiter zu {client.name}</Heading>
                {/* Welches Konto gleich weitergereicht wird, ist die eine Frage
                    dieser Seite — es steht deshalb als umrahmte Gruppe da, und
                    der Kontowechsel ist ihre zweite Zeile statt eines frei
                    schwebenden Knopfs. Meldet ab und kehrt mit dem geprüften
                    ?weiter= zur Anmeldung zurück — die App-Anmeldung geht
                    dabei nicht verloren. */}
                <VStack className="freigabe-gruppe" gap={0}>
                  <HStack gap={2} paddingInline={4} paddingBlock={3} vAlign="center" wrap="nowrap">
                    <PersonZeichen
                      person={personAngabe(user)}
                      groesse="karte"
                      mitName
                      betont
                      unterzeile={user.email}
                    />
                  </HStack>
                  <form action={logoutAction}>
                    <input type="hidden" name="weiter" value={autorisierung} />
                    <AbsendeKnopf label="Anderes Konto verwenden" variant="ghost" size="sm" width="100%" />
                  </form>
                </VStack>
              </VStack>
              {/* Was hinübergeht, steht als benannter Wert in derselben
                  Gruppenform: Kopfzeile auf gedeckter Fläche, drei Zeilen,
                  ablesbar in drei Blicken. */}
              <VStack gap={2} hAlign="start">
                <VStack className="freigabe-gruppe" gap={0}>
                  <HStack className="freigabe-gruppe-kopf" paddingInline={4} paddingBlock={2}>
                    <Text type="supporting" color="secondary">
                      Diese Daten gibt der Hub an {client.name} weiter
                    </Text>
                  </HStack>
                  {/* Zeichen statt ausgeschriebener Feldnamen — fürs Ohr
                      trägt der umspannende span die Bedeutung, das Zeichen
                      selbst bleibt aria-hidden wie überall. */}
                  <HStack gap={3} paddingInline={4} paddingBlock={2} vAlign="center" wrap="nowrap">
                    <span role="img" aria-label="Name">
                      <Sinnbild sinn="person" groesse="zeile" ton="sekundaer" />
                    </span>
                    <Text>{user.name}</Text>
                  </HStack>
                  <HStack gap={3} paddingInline={4} paddingBlock={2} vAlign="center" wrap="nowrap">
                    <span role="img" aria-label="E-Mail-Adresse">
                      <Sinnbild sinn="email" groesse="zeile" ton="sekundaer" />
                    </span>
                    <Text>{user.email}</Text>
                  </HStack>
                  <HStack gap={3} paddingInline={4} paddingBlock={2} vAlign="center" wrap="nowrap">
                    <span role="img" aria-label="Rolle und Rechte">
                      <Sinnbild sinn="rolle" groesse="zeile" ton="sekundaer" />
                    </span>
                    <Text>{rolleLabel(user.role)}</Text>
                  </HStack>
                </VStack>
                <HStack gap={2} vAlign="center" wrap="nowrap">
                  <Sinnbild sinn="gesperrt" groesse="zeile" />
                  <Text type="supporting" color="secondary">
                    Dein Passwort bleibt beim Hub.
                  </Text>
                </HStack>
              </VStack>
            </FreigabeFormulare>
          </VStack>
        </Card>
      </VStack>
    </main>
  );
}
