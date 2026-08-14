import {NextResponse, type NextRequest} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {getDb} from '@/lib/db';
import {speichereGoogleKonto, tauscheGoogleCode} from '@/lib/google';
import {syncGoogleAbwesenheiten} from '@/lib/google-kalender';
import {protokolliere} from '@/lib/protokoll';

/**
 * Googles Rückruf nach der Einwilligung. Prüft den CSRF-Zustand aus dem
 * Cookie, tauscht den Code gegen Tokens, verbucht das verbundene Konto und
 * stößt den ersten Kalender-Abgleich an. Jeder Ausgang — auch die Absage —
 * landet als `?google=…` am Rückweg, wo der Assistent bzw. die Profilseite ihn
 * auf Deutsch erklärt.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const url = request.nextUrl;
  const cookie = request.cookies.get('google_oauth_state')?.value ?? '';
  const trenner = cookie.indexOf('|');
  const erwarteterState = trenner === -1 ? '' : cookie.slice(0, trenner);
  const cookieZiel = cookie.slice(trenner + 1);
  const zurueck = cookieZiel === '/profil' ? '/profil' : cookieZiel === '/new/login' ? '/new/login' : '/login';

  const weiter = (ergebnis: string): NextResponse => {
    const antwort = NextResponse.redirect(new URL(`${zurueck}?google=${ergebnis}`, url.origin));
    antwort.cookies.delete({name: 'google_oauth_state', path: '/api/google'});
    return antwort;
  };

  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL('/login', url.origin));

  if (url.searchParams.get('error')) {
    protokolliere({
      akteur: user,
      aktion: 'oauth.google-verbinden',
      gegenstand: `Google-Konto von ${user.name} verbinden`,
      betroffen: {id: user.id, name: user.name},
      fehler: 'Die Einwilligung bei Google wurde abgebrochen.',
    });
    return weiter('abgelehnt');
  }

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state || !erwarteterState || state !== erwarteterState) {
    return weiter('fehler');
  }

  const tausch = await tauscheGoogleCode(url.origin, code);
  if (typeof tausch === 'string') {
    protokolliere({
      akteur: user,
      aktion: 'oauth.google-verbinden',
      gegenstand: `Google-Konto von ${user.name} verbinden`,
      betroffen: {id: user.id, name: user.name},
      fehler: tausch,
    });
    return weiter('fehler');
  }

  speichereGoogleKonto(user.id, tausch);
  getDb().query('UPDATE users SET google_einrichtung_abgeschlossen = 1 WHERE id = ?').run(user.id);
  protokolliere({
    akteur: user,
    aktion: 'oauth.google-verbinden',
    gegenstand: `Google-Konto von ${user.name} verbunden`,
    betroffen: {id: user.id, name: user.name},
    nachher: {'Google-Konto': tausch.email},
  });
  // Was schon an wirksamen Abwesenheiten dasteht, gehört sofort in den
  // frisch verbundenen Kalender — nicht erst bei der nächsten Änderung.
  await syncGoogleAbwesenheiten(user.id);
  return weiter('verbunden');
}
