import {Banner, Card, Heading, Text, VStack} from '@astryxdesign/core';
import {headers} from 'next/headers';
import {requireRecht} from '@/lib/auth';
import {erweiterungPaket, erweiterungVersion} from '@/lib/erweiterung';
import {basisUrl} from '@/lib/mail-buch';
import {type Betriebssystem, ErweiterungInstallation} from '@/components/erweiterung-installation';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

function systemAus(userAgent: string): Betriebssystem {
  if (/Windows/i.test(userAgent)) return 'windows';
  if (/Mac OS X|Macintosh/i.test(userAgent)) return 'mac';
  if (/Linux|X11|CrOS/i.test(userAgent)) return 'linux';
  return 'andere';
}

/**
 * Die Browser-Erweiterung — wie sie ins Haus kommt und aktuell bleibt.
 *
 * Chrome aktualisiert nur, was es über eine Richtlinie installiert hat; ein
 * entpackt geladener Ordner bleibt, wie er ist. Ein Web-Blatt darf keine
 * Erweiterung installieren — es gibt dem Betriebssystem die Richtlinie in
 * seiner Doppelklick-Form (lib/erweiterung.ts), Chrome installiert beim
 * nächsten Start und hält sie von da an selbst aktuell. Alles darauf ist
 * öffentlich — die Codes holt die Erweiterung erst zur Laufzeit mit der
 * eigenen Sitzung.
 */
export default async function ErweiterungPage() {
  await requireRecht('zugangscodes.sehen');
  const basis = basisUrl() ?? '';
  const paket = basis ? erweiterungPaket(basis) : null;
  const version = erweiterungVersion();
  const system = systemAus((await headers()).get('user-agent') ?? '');

  return (
    <ZeitRahmen
      titel="Browser-Erweiterung"
      sinn="installieren"
      figur={version}
      figurEinheit="Version"
      stand="Trägt die Zugangscodes auf Anmeldeseiten ein und hält sich über den Hub selbst aktuell."
      belege={
        <VStack gap={4}>
          {paket ? (
            <ErweiterungInstallation id={paket.id} version={paket.version} basis={basis} system={system} />
          ) : (
            <Banner
              status="warning"
              title="Kein Paket verfügbar"
              description="Der Hub braucht APP_URL in der Umgebung und muss data/ beschreiben dürfen (dort legt er seinen Signierschlüssel ab). Bis dahin lässt sich der Ordner extension/ nur entpackt laden – ohne Aktualisierung."
            />
          )}
          {paket && (
            <Card padding={4} variant="muted">
              <VStack gap={1}>
                <Text type="supporting" color="secondary" as="p">
                  Was der Hub dafür bereitstellt – öffentlich, ohne Geheimnis. Eine neue Version entsteht durch die
                  Versionsnummer in extension/manifest.json; Chrome holt sie beim nächsten Abgleich, „Aktualisieren" auf
                  chrome://extensions erzwingt ihn.
                </Text>
                <Text type="code" as="p">{`${basis}/api/erweiterung/update.xml`}</Text>
                <Text type="code" as="p">{`${basis}/api/erweiterung/medarbeiter-zugangscodes.crx`}</Text>
              </VStack>
            </Card>
          )}
          <Card padding={4} variant="muted">
            <VStack gap={1}>
              <Heading level={4}>Zum Entwickeln</Heading>
              <Text type="supporting" color="secondary" as="p">
                chrome://extensions → Entwicklermodus → „Entpackte Erweiterung laden" → Ordner extension/ im Repository.
                Diese Kopie aktualisiert sich nicht; die Adresse des Hubs steht in ihren Einstellungen.
              </Text>
            </VStack>
          </Card>
        </VStack>
      }
    />
  );
}
