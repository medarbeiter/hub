import {NextResponse, type NextRequest} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {appBasis, googleAuthUrl, googleKonfiguriert} from '@/lib/google';

/**
 * Beginnt die Google-Verknüpfung: legt den CSRF-Zustand in ein kurzlebiges
 * Cookie und leitet zu Googles Einwilligungsseite weiter. `?zurueck=profil`
 * bringt den Rückweg mit — der Einrichtungsassistent und die Profilseite
 * benutzen denselben Handler.
 *
 * Wie beim Beleg-Handler: eine Sitzung ist Pflicht, aber `requireUser()` passt
 * hier nicht — der Assistent läuft, bevor das Onboarding fertig ist.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  const url = request.nextUrl;
  const ziel = url.searchParams.get('zurueck');
  const zurueck = ziel === 'profil' ? '/profil' : ziel === 'new-login' ? '/new/login' : '/login';
  const basis = appBasis(url.origin);
  if (!user) return NextResponse.redirect(new URL('/login', basis));
  if (!googleKonfiguriert()) {
    return NextResponse.redirect(new URL(`${zurueck}?google=nicht-konfiguriert`, basis));
  }

  const state = crypto.randomUUID();
  const antwort = NextResponse.redirect(googleAuthUrl(basis, state, user.email));
  antwort.cookies.set('google_oauth_state', `${state}|${zurueck}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/api/google',
    maxAge: 600,
  });
  return antwort;
}
