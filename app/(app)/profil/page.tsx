import {Card, Heading, Text, VStack} from '@astryxdesign/core';
import {requireUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {fmtDate, fmtDuration} from '@/lib/format';
import {googleKonfiguriert, googleKontoFuer} from '@/lib/google';
import {onboardingProfil, persoenlicheEinstellungen} from '@/lib/onboarding';
import {GoogleVerbindung} from '@/components/google-verbindung';
import {PersoenlicheEinstellungenForm} from '@/components/persoenliche-einstellungen';
import {ProfilbildFeld} from '@/components/profilbild-feld';
import {ProfilDaten} from '@/components/profil-daten';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

export default async function ProfilPage({
  searchParams,
}: {
  searchParams: Promise<{google?: string}>;
}) {
  const user = await requireUser();
  const profil = onboardingProfil(user);
  const konto = googleKontoFuer(user.id);
  const {google} = await searchParams;
  const googleHinweis =
    google === 'verbunden'
      ? {ton: 'success' as const, text: 'Google-Konto verbunden. Deine Abwesenheiten stehen jetzt im Kalender.'}
      : google === 'abgelehnt'
        ? {ton: 'error' as const, text: 'Die Einwilligung bei Google wurde abgebrochen.'}
        : google === 'fehler'
          ? {ton: 'error' as const, text: 'Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.'}
          : null;

  return (
    <ZeitRahmen
      titel="Mein Profil"
      sinn={hatRecht(user, 'mitarbeiter.verwalten') ? 'rolleVerwaltung' : 'rolleMitarbeiter'}
      figur={fmtDuration(user.weekly_minutes)}
      figurEinheit="Std./Woche"
      stand="Diese Stammdaten hast du bestätigt. Änderungen nimmt die Verwaltung vor."
      belege={
        <VStack gap={4}>
          {/* Eigenes Blatt und eigenes Formular: die Datei liegt im State und
              das Hochladen hat seinen eigenen Ausgang — ein Feld im großen
              Formular hieße, es ginge beim Speichern der Startansicht mit. */}
          <Card padding={4} maxWidth={680}>
            <ProfilbildFeld hatBild={Boolean(user.avatar_datei)} userId={user.id} />
          </Card>
          <PersoenlicheEinstellungenForm initial={persoenlicheEinstellungen(user.id)} />
          <GoogleVerbindung
            konto={konto ? {email: konto.google_email, seit: fmtDate(konto.verbunden_at.slice(0, 10))} : null}
            konfiguriert={googleKonfiguriert()}
            hinweis={googleHinweis}
          />
        </VStack>
      }
      kontext={
        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Bestätigte Stammdaten</Heading>
              <Text type="supporting" color="secondary">
                Sie bestimmen Sollzeit, Feiertage und Urlaubsanspruch.
              </Text>
            </VStack>
            <ProfilDaten profil={profil} />
          </VStack>
        </Card>
      }
    />
  );
}
