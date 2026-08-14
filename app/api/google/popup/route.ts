import {NextResponse, type NextRequest} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {getDb} from '@/lib/db';
import {googleKonfiguriert, speichereGoogleKonto, tauscheGoogleCode} from '@/lib/google';
import {syncGoogleAbwesenheiten} from '@/lib/google-kalender';
import {protokolliere} from '@/lib/protokoll';

/**
 * Der Rückweg des eingebetteten Google-Knopfs (GIS-Popup): der Browser bringt
 * den Autorisierungscode per fetch statt per Weiterleitung, getauscht wird er
 * mit `postmessage` als Redirect-URI. Ab dem Code ist alles identisch zum
 * Weiterleitungs-Callback — dasselbe Konto, dieselbe Protokollzeile, derselbe
 * erste Abgleich. CSRF trägt das SameSite-Cookie: eine fremde Seite bekommt
 * die Sitzung nicht an diesen POST.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({fehler: 'Nicht angemeldet.'}, {status: 401});
  if (!googleKonfiguriert()) {
    return NextResponse.json({fehler: 'Die Google-Anbindung ist nicht konfiguriert.'}, {status: 503});
  }
  const body = (await request.json().catch(() => null)) as {code?: unknown} | null;
  const code = typeof body?.code === 'string' ? body.code : '';
  if (!code) return NextResponse.json({fehler: 'Es fehlt der Autorisierungscode.'}, {status: 400});

  const tausch = await tauscheGoogleCode(request.nextUrl.origin, code, 'postmessage');
  if (typeof tausch === 'string') {
    protokolliere({
      akteur: user,
      aktion: 'oauth.google-verbinden',
      gegenstand: `Google-Konto von ${user.name} verbinden`,
      betroffen: {id: user.id, name: user.name},
      fehler: tausch,
    });
    return NextResponse.json({fehler: tausch}, {status: 502});
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
  await syncGoogleAbwesenheiten(user.id);
  return NextResponse.json({ok: true});
}
