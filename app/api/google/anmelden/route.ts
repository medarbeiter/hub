import {NextResponse, type NextRequest} from 'next/server';
import {createSession} from '@/lib/auth';
import {getDb, type User} from '@/lib/db';
import {benutzerFuerGoogleLogin, googleKonfiguriert, pruefeIdToken} from '@/lib/google';
import {weiterZielGueltig} from '@/lib/oauth-apps';
import {onboardingIstFertig, startPfad} from '@/lib/onboarding';
import {protokolliere} from '@/lib/protokoll';

/**
 * Anmeldung über Google: der Browser bringt das ID-Token des GIS-Knopfs, hier
 * wird es gegen Google geprüft (Signatur, Aussteller, `aud`, bestätigte
 * E-Mail) und auf ein aktives Mitarbeiterkonto abgebildet — zuerst über die
 * ausdrückliche Verknüpfung, sonst über die Firmen-E-Mail. Danach ist es
 * dieselbe Sitzung wie nach der Passwort-Anmeldung; ein Konto mit offener
 * Einrichtung landet im Assistenten wie sonst auch.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!googleKonfiguriert()) {
    return NextResponse.json({fehler: 'Die Google-Anbindung ist nicht konfiguriert.'}, {status: 503});
  }
  const body = (await request.json().catch(() => null)) as {credential?: unknown; weiter?: unknown} | null;
  const credential = typeof body?.credential === 'string' ? body.credential : '';
  // Rücksprung einer App-Anmeldung (`/login?weiter=…`): kommt aus dem Browser
  // und wird deshalb wie in loginAction gegen das feste Präfix geprüft.
  const weiter = typeof body?.weiter === 'string' ? body.weiter : null;
  if (!credential) return NextResponse.json({fehler: 'Es fehlt das Google-Token.'}, {status: 400});

  const geprueft = await pruefeIdToken(credential);
  if (typeof geprueft === 'string') {
    protokolliere({
      akteur: null,
      akteurName: 'Google-Anmeldung',
      aktion: 'anmelden.fehlgeschlagen',
      gegenstand: 'Anmeldung über Google',
      fehler: geprueft,
    });
    return NextResponse.json({fehler: geprueft}, {status: 401});
  }

  const userId = benutzerFuerGoogleLogin(geprueft.sub, geprueft.email);
  const user = userId
    ? getDb().query<User, [number]>('SELECT * FROM users WHERE id = ?').get(userId)
    : null;
  if (!user) {
    // Die versuchte Google-Adresse steht mit im Protokoll — wie bei der
    // Passwort-Anmeldung sagt eine Reihe von Fehlversuchen sonst nichts.
    protokolliere({
      akteur: null,
      akteurName: geprueft.email.slice(0, 120),
      aktion: 'anmelden.fehlgeschlagen',
      gegenstand: 'Anmeldung über Google',
      fehler: 'Zu diesem Google-Konto gehört kein Mitarbeiterkonto.',
    });
    return NextResponse.json(
      {fehler: 'Zu diesem Google-Konto gehört kein Mitarbeiterkonto. Bitte melde dich mit E-Mail und Passwort an.'},
      {status: 403},
    );
  }

  await createSession(user.id);
  protokolliere({
    akteur: user,
    aktion: 'anmelden.google',
    gegenstand: 'Anmeldung an MedArbeiter über Google',
  });
  // Wie in loginAction: eine offene Einrichtung geht vor, das `weiter`
  // verfällt dort — die anfragende App wiederholt ihre Weiterleitung danach.
  const ziel = !onboardingIstFertig(user.id)
    ? '/login'
    : weiterZielGueltig(weiter)
      ? weiter
      : startPfad(user.id);
  return NextResponse.json({ok: true, ziel});
}
