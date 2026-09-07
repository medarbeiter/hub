'use client';

import {Badge, Banner, Button, Card, Heading, HStack, List, ListItem, SegmentedControl, SegmentedControlItem, Text, VStack} from '@astryxdesign/core';
import {useEffect, useState} from 'react';
import {Sinnbild} from './sinnbilder';

export type Betriebssystem = 'mac' | 'windows' | 'linux' | 'andere';

interface Props {
  id: string;
  /** Die Version, die der Hub ausliefert. */
  version: string;
  basis: string;
  /** Vom Server aus dem User-Agent gelesen — die Seite bietet die passende Form zuerst. */
  system: Betriebssystem;
}

/**
 * Der Einrichtungsweg auf einem Blatt: Stand (ist sie da, welche Version),
 * ein Knopf, drei Schritte. Ein Web-Blatt darf keine Erweiterung installieren
 * — es gibt dem Betriebssystem die Richtlinie in seiner Doppelklick-Form, und
 * Chrome installiert beim nächsten Start selbst. Ob es geklappt hat, fragt
 * das Blatt die Erweiterung direkt (externally_connectable im Manifest, nur
 * für die Hausadresse) und alle drei Sekunden erneut, bis sie antwortet.
 */
export function ErweiterungInstallation({id, version, basis, system}: Props) {
  const [stand, setStand] = useState<{art: 'frage'} | {art: 'fehlt'} | {art: 'keinChrome'} | {art: 'da'; version: string}>(
    {art: 'frage'},
  );
  const [wahl, setWahl] = useState<Betriebssystem>(system === 'andere' ? 'mac' : system);

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
      try {
        senden.call(chrome!.runtime, id, {art: 'da'}, (a) => {
          // lastError muss gelesen werden, sonst meldet Chrome eine unbeantwortete Nachricht.
          void chrome!.runtime!.lastError;
          if (!laeuft) return;
          setStand(a?.version ? {art: 'da', version: a.version} : {art: 'fehlt'});
        });
      } catch {
        if (laeuft) setStand({art: 'fehlt'});
      }
    };
    fragen();
    const takt = setInterval(fragen, 3000);
    return () => {
      laeuft = false;
      clearInterval(takt);
    };
  }, [id]);

  const wert = `${id};${basis}/api/erweiterung/update.xml`;
  const herunterladen = (fuer: 'mac' | 'windows' | 'linux') => {
    window.location.href = `${basis}/api/erweiterung/richtlinie?fuer=${fuer}`;
  };

  return (
    <VStack gap={4}>
      {stand.art === 'da' && (
        <Banner
          status="success"
          title={`Installiert – Version ${stand.version}`}
          description={
            stand.version === version
              ? 'Auf dem neuesten Stand. Chrome holt neue Versionen von hier selbst.'
              : `Der Hub liefert ${version}; Chrome holt sie beim nächsten Abgleich, „Aktualisieren" auf chrome://extensions sofort.`
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
            <SegmentedControl label="Betriebssystem" value={wahl} onChange={(v) => setWahl(v as Betriebssystem)}>
              <SegmentedControlItem value="mac" label="Mac" />
              <SegmentedControlItem value="windows" label="Windows" />
              <SegmentedControlItem value="linux" label="Linux" />
            </SegmentedControl>
            {wahl === 'mac' && (
              <Schritte
                knopf="Profil laden"
                onClick={() => herunterladen('mac')}
                schritte={[
                  'Die geladene Datei „MedArbeiter-Zugangscodes.mobileconfig" doppelklicken.',
                  'Systemeinstellungen → Allgemein → Geräteverwaltung → das Profil „MedArbeiter Zugangscodes" installieren.',
                  'Chrome ganz beenden (⌘Q) und wieder öffnen. Diese Seite meldet sich, sobald die Erweiterung da ist.',
                ]}
              />
            )}
            {wahl === 'windows' && (
              <Schritte
                knopf="Registrierungsdatei laden"
                onClick={() => herunterladen('windows')}
                schritte={[
                  'Die geladene Datei „MedArbeiter-Zugangscodes.reg" doppelklicken und die Nachfrage bestätigen.',
                  'Chrome ganz beenden und wieder öffnen.',
                  'Nimmt Chrome die Richtlinie auf einem Rechner ohne Domäne nicht an, geht es über die Google Admin-Konsole (unten).',
                ]}
              />
            )}
            {wahl === 'linux' && (
              <Schritte
                knopf="Richtlinie laden"
                onClick={() => herunterladen('linux')}
                schritte={[
                  'Die geladene Datei nach /etc/opt/chrome/policies/managed/medarbeiter.json legen (sudo).',
                  'Chrome ganz beenden und wieder öffnen.',
                ]}
                befehl={`sudo sh -c 'mkdir -p /etc/opt/chrome/policies/managed && curl -fsSL "${basis}/api/erweiterung/richtlinie?fuer=linux" -o /etc/opt/chrome/policies/managed/medarbeiter.json'`}
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
            Erweiterungs-ID hinzufügen": Kennung und Update-URL aus dem Wert unten, Richtlinie „Installation
            erzwingen". Danach hat jeder, der in Chrome mit dem Firmenkonto angemeldet ist, die Erweiterung — ohne
            die Schritte oben.
          </Text>
          <Text type="code" as="p">{wert}</Text>
        </VStack>
      </Card>
    </VStack>
  );
}

function Schritte({
  knopf,
  onClick,
  schritte,
  befehl,
}: {
  knopf: string;
  onClick: () => void;
  schritte: string[];
  befehl?: string;
}) {
  return (
    <VStack gap={2}>
      <HStack>
        <Button label={knopf} variant="primary" icon={<Sinnbild sinn="installieren" />} onClick={onClick} />
      </HStack>
      <List listStyle="decimal">
        {schritte.map((s) => (
          <ListItem key={s} label={s} />
        ))}
      </List>
      {befehl && (
        <Text type="code" as="p">
          {befehl}
        </Text>
      )}
    </VStack>
  );
}
