'use client';

import {Badge, Banner, Button, Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {useEffect, useState} from 'react';
import {Sinnbild} from './sinnbilder';

interface Props {
  /** Die Kennungen, unter denen die Erweiterung antworten kann: Hub-Paket und, wenn gesetzt, Web Store. */
  ids: string[];
  /** Die Version, die der Hub ausliefert. */
  version: string;
  basis: string;
  /** Die Store-Seite (ERWEITERUNG_STORE_URL) — der Weg für jeden Rechner ohne Verwaltung. */
  storeUrl: string | null;
  /** Der Wert für die Google Admin-Konsole, wenn der Hub das Paket liefert. */
  richtlinie: string | null;
}

type Stand = {art: 'frage'} | {art: 'fehlt'} | {art: 'keinChrome'} | {art: 'da'; version: string};

/**
 * Der Einrichtungsweg auf einem Blatt: Stand (ist sie da, welche Version),
 * ein Knopf. Ein Web-Blatt darf keine Erweiterung installieren, und einer
 * lokalen Richtlinie traut Chrome auf einem unverwalteten Rechner nicht
 * (lib/erweiterung.ts) — was bleibt, ist der Web Store: ein Klick, und der
 * Store hält sie aktuell. Ob sie da ist, fragt das Blatt die Erweiterung
 * direkt (externally_connectable im Manifest, nur für die Hausadresse) und
 * alle drei Sekunden erneut, bis sie antwortet.
 */
export function ErweiterungInstallation({ids, version, basis, storeUrl, richtlinie}: Props) {
  const [stand, setStand] = useState<Stand>({art: 'frage'});

  useEffect(() => {
    const chrome = (window as unknown as {chrome?: {runtime?: {sendMessage?: unknown; lastError?: unknown}}}).chrome;
    const senden = chrome?.runtime?.sendMessage as
      | ((extId: string, nachricht: unknown, antwort: (a?: {version?: string}) => void) => void)
      | undefined;
    if (!senden) {
      setStand({art: 'keinChrome'});
      return;
    }
    let laeuft = true;
    const fragen = () => {
      let offen = ids.length;
      let gefunden: string | null = null;
      for (const id of ids) {
        try {
          senden.call(chrome!.runtime, id, {art: 'da'}, (a) => {
            // lastError muss gelesen werden, sonst meldet Chrome eine unbeantwortete Nachricht.
            void chrome!.runtime!.lastError;
            if (a?.version) gefunden = a.version;
            if (--offen === 0 && laeuft) setStand(gefunden ? {art: 'da', version: gefunden} : {art: 'fehlt'});
          });
        } catch {
          if (--offen === 0 && laeuft) setStand(gefunden ? {art: 'da', version: gefunden} : {art: 'fehlt'});
        }
      }
    };
    fragen();
    const takt = setInterval(fragen, 3000);
    return () => {
      laeuft = false;
      clearInterval(takt);
    };
  }, [ids]);

  return (
    <VStack gap={4}>
      {stand.art === 'da' && (
        <Banner
          status="success"
          title={`Installiert – Version ${stand.version}`}
          description={
            stand.version === version
              ? 'Auf dem neuesten Stand. Neue Versionen kommen von selbst.'
              : `Der Hub steht auf ${version}; die neue Version kommt beim nächsten Abgleich, „Aktualisieren" auf chrome://extensions sofort.`
          }
        />
      )}
      {stand.art === 'keinChrome' && (
        <Banner
          status="info"
          title="Dieser Browser ist nicht Chrome"
          description="Die Erweiterung gibt es für Chrome (und Browser auf Chromium-Basis). Diese Seite dort öffnen, dann geht es weiter."
        />
      )}
      {(stand.art === 'fehlt' || stand.art === 'frage') && (
        <Card padding={4}>
          <VStack gap={3}>
            <HStack gap={2} vAlign="center" wrap="wrap">
              <Heading level={3}>Einrichten</Heading>
              {stand.art === 'fehlt' && <Badge variant="neutral" label="Noch nicht installiert" />}
            </HStack>
            {storeUrl ? (
              <>
                <Text type="body" as="p">
                  Im Chrome Web Store auf „Hinzufügen" klicken und bestätigen. Diese Seite meldet sich, sobald die
                  Erweiterung da ist; aktuell hält sie der Store von selbst.
                </Text>
                <HStack>
                  <Button
                    label="Im Chrome Web Store öffnen"
                    variant="primary"
                    icon={<Sinnbild sinn="installieren" />}
                    onClick={() => window.open(storeUrl, '_blank', 'noopener')}
                  />
                </HStack>
              </>
            ) : (
              <Banner
                status="warning"
                title="Noch keine Store-Seite hinterlegt"
                description="Auf einem Rechner ohne Geräteverwaltung installiert Chrome nur aus dem Web Store. Die Verwaltung lädt das Paket dort hoch (bun scripts/erweiterung-store-zip.ts, Sichtbarkeit „Nicht gelistet“) und trägt ERWEITERUNG_STORE_URL und ERWEITERUNG_STORE_ID in die Umgebung des Hubs ein – dann steht hier ein Knopf."
              />
            )}
          </VStack>
        </Card>
      )}
      <Card padding={4} variant="muted">
        <VStack gap={1}>
          <Heading level={4}>Für alle im Haus auf einmal</Heading>
          <Text type="supporting" color="secondary" as="p">
            Google Admin-Konsole → Geräte → Chrome → Apps und Erweiterungen → Nutzer und Browser → „+" → „Per
            Erweiterungs-ID hinzufügen", Richtlinie „Installation erzwingen". Aus dem Web Store genügt die Kennung;
            ohne Store-Seite nimmt die Konsole Kennung und Update-URL aus dem Wert unten – dieser Weg braucht keine
            Klicks auf den Rechnern, weil Chrome einer Cloud-Richtlinie traut.
          </Text>
          {richtlinie ? (
            <Text type="code" as="p">{richtlinie}</Text>
          ) : (
            <Text type="supporting" color="secondary" as="p">
              Der Hub liefert das Paket erst, wenn APP_URL gesetzt ist und er data/ beschreiben darf.
            </Text>
          )}
          <Text type="code" as="p">{`${basis}/api/erweiterung/update.xml`}</Text>
        </VStack>
      </Card>
    </VStack>
  );
}
