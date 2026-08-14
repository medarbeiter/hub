import {redirect} from 'next/navigation';
import {getSessionUser} from '@/lib/auth';
import {googleKonfiguriert} from '@/lib/google';
import {NewAuthFlow} from '@/components/new-ui/auth-flow';
import {
  einrichtungsDaten,
  onboardingIstFertig,
  startPfad,
} from '@/lib/onboarding';

export const dynamic = 'force-dynamic';
export const metadata = {title: 'Zugang – MedArbeiter Hub'};

const GOOGLE_HINWEISE: Record<string, string> = {
  abgelehnt: 'Die Einwilligung bei Google wurde abgebrochen. Bitte versuche es erneut.',
  fehler: 'Die Verknüpfung mit Google ist fehlgeschlagen. Bitte versuche es erneut.',
  'nicht-konfiguriert':
    'Die Google-Anbindung ist noch nicht eingerichtet. Bitte wende dich an die Verwaltung.',
};

export default async function NeuLoginPage({
  searchParams,
}: {
  searchParams: Promise<{google?: string}>;
}) {
  const user = await getSessionUser();
  if (user && onboardingIstFertig(user.id)) redirect(startPfad(user.id));
  const {google} = await searchParams;
  return (
    <NewAuthFlow
      initialSetup={user ? einrichtungsDaten(user) : null}
      googleClientId={googleKonfiguriert() ? (process.env.GOOGLE_CLIENT_ID ?? null) : null}
      googleMessage={google ? (GOOGLE_HINWEISE[google] ?? null) : null}
    />
  );
}
