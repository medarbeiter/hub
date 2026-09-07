import {Card, Heading, Text, VStack} from '@astryxdesign/core';
import {requireRecht} from '@/lib/auth';
import {erweiterungIdAusManifest, erweiterungPaket, erweiterungVersion, richtlinienWert} from '@/lib/erweiterung';
import {basisUrl} from '@/lib/mail-buch';
import {ErweiterungInstallation} from '@/components/erweiterung-installation';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

/**
 * Die Browser-Erweiterung — wie sie ins Haus kommt und aktuell bleibt.
 *
 * Ein Web-Blatt darf keine Erweiterung installieren, und einer lokalen
 * Richtlinie traut Chrome auf einem unverwalteten Rechner nicht
 * (lib/erweiterung.ts). Zwei Wege bleiben: der Web Store (ein Klick je
 * Rechner, ERWEITERUNG_STORE_URL) und die Google Admin-Konsole (kein Klick,
 * für alle). Das Blatt fragt die Erweiterung selbst, ob sie da ist.
 */
export default async function ErweiterungPage() {
  await requireRecht('zugangscodes.sehen');
  const basis = basisUrl() ?? '';
  const paket = basis ? erweiterungPaket(basis) : null;
  const storeUrl = process.env.ERWEITERUNG_STORE_URL?.trim() || null;
  const storeId = process.env.ERWEITERUNG_STORE_ID?.trim() || null;
  // Hub-Paket, entpackte Entwicklungskopie (Key im Manifest) und Store — auf Prod ein und dieselbe Kennung.
  const ids = [...new Set([paket?.id, erweiterungIdAusManifest(), storeId].filter((id): id is string => Boolean(id)))];

  return (
    <ZeitRahmen
      titel="Browser-Erweiterung"
      sinn="installieren"
      figur={erweiterungVersion()}
      figurEinheit="Version"
      stand="Trägt die Zugangscodes auf Anmeldeseiten ein und hält sich von selbst aktuell."
      belege={
        <VStack gap={4}>
          <ErweiterungInstallation
            ids={ids}
            version={erweiterungVersion()}
            basis={basis}
            storeUrl={storeUrl}
            richtlinie={paket ? richtlinienWert(paket, basis) : null}
          />
          <Card padding={4} variant="muted">
            <VStack gap={1}>
              <Heading level={4}>Zum Entwickeln</Heading>
              <Text type="supporting" color="secondary" as="p">
                chrome://extensions → Entwicklermodus → „Entpackte Erweiterung laden" → Ordner extension/ im Repository.
                Diese Kopie aktualisiert sich nicht; die Adresse des Hubs steht in ihren Einstellungen. Neue Version:
                Versionsnummer in extension/manifest.json erhöhen, bun scripts/erweiterung-store-zip.ts, im Developer
                Dashboard hochladen.
              </Text>
            </VStack>
          </Card>
        </VStack>
      }
    />
  );
}
