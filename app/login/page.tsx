import {redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/auth';
import {googleKonfiguriert} from '@/lib/google';
import {weiterZielGueltig} from '@/lib/oauth-apps';
import {LoginForm} from '@/components/login-form';
import {
  einrichtungsDaten,
  onboardingIstFertig,
  startPfad,
} from '@/lib/onboarding';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Zugang – MedArbeiter Hub'};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{google?: string; weiter?: string}>;
}) {
  const {google, weiter} = await searchParams;
  // Der Rücksprung einer App-Anmeldung: nur der eigene Autorisierungs-Endpunkt,
  // serverseitig geprüft — sonst wäre der Parameter eine offene Weiterleitung.
  const weiterZiel = weiterZielGueltig(weiter) ? weiter : null;
  const user = await getSessionUser();
  if (user && onboardingIstFertig(user.id)) redirect(weiterZiel ?? startPfad(user.id));
  return (
    <LoginForm
      initialEinrichtung={
        user ? einrichtungsDaten(user) : null
      }
      weiter={weiterZiel}
      googleClientId={googleKonfiguriert() ? (process.env.GOOGLE_CLIENT_ID ?? null) : null}
      googleHinweis={
        google === 'abgelehnt'
          ? 'Die Einwilligung bei Google wurde abgebrochen. Bitte versuche es erneut.'
          : google === 'fehler'
            ? 'Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.'
            : google === 'nicht-konfiguriert'
              ? 'Die Google-Anbindung ist noch nicht eingerichtet. Bitte wende dich an die Verwaltung.'
              : null
      }
    />
  );
}
