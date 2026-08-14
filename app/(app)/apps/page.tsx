import {Card, Text, VStack} from '@astryxdesign/core';
import {requireRecht} from '@/lib/auth';
import {basisUrl} from '@/lib/mail-buch';
import {oauthClients} from '@/lib/oauth-apps';
import {AppAnbindungenTafel, AppAnlegen} from '@/components/app-anbindungen';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

/**
 * Verbundene Apps — MedArbeiter als Anmeldestelle. Andere Hausanwendungen
 * holen sich hier per OAuth 2.0 die Identität des angemeldeten Nutzers, statt
 * eigene Konten und Passwörter zu führen. Verwaltet wird die Anbindung selbst:
 * Name, Weiterleitungs-URIs, Sperre, Geheimnis. Das Geheimnis erscheint genau
 * einmal beim Anlegen oder Erneuern (lib/oauth-apps.ts) — danach gibt es nur
 * noch seinen Hash.
 */
export default async function AppsPage() {
  await requireRecht('apps.verwalten');
  const zeilen = oauthClients();
  const basis = basisUrl() ?? '';

  return (
    <ZeitRahmen
      titel="Verbundene Apps"
      figur={String(zeilen.length)}
      figurEinheit={zeilen.length === 1 ? 'Anbindung' : 'Anbindungen'}
      stand="Andere Anwendungen melden ihre Nutzer über MedArbeiter an."
      werkzeuge={<AppAnlegen />}
      belege={
        <VStack gap={4}>
          <AppAnbindungenTafel zeilen={zeilen} />
          {/* Was die anbindende Entwicklerin braucht, steht gleich hier —
              es sind öffentliche Adressen, kein Geheimnis. */}
          <Card padding={4} variant="muted">
            <VStack gap={1}>
              <Text type="supporting" color="secondary" as="p">
                Endpunkte für die App-Konfiguration (Authorization-Code, Antwort von /userinfo: sub, name, email,
                role, rechte)
              </Text>
              <Text type="code" as="p">{`${basis}/api/oauth/authorize`}</Text>
              <Text type="code" as="p">{`${basis}/api/oauth/token`}</Text>
              <Text type="code" as="p">{`${basis}/api/oauth/userinfo`}</Text>
            </VStack>
          </Card>
        </VStack>
      }
    />
  );
}
