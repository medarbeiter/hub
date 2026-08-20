import {NextResponse, type NextRequest} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {codeAusstellen, oauthClientById} from '@/lib/oauth-apps';
import {onboardingIstFertig} from '@/lib/onboarding';
import {protokolliere} from '@/lib/protokoll';

/**
 * Der Autorisierungs-Endpunkt (RFC 6749 §4.1.1): eine Hausanwendung schickt
 * den Browser hierher, MedArbeiter fragt die angemeldete Person und schickt
 * sie mit einem einmaligen Code zurück. Wie beim Beleg-Handler wird mit
 * einer Response geantwortet, nie mit requireRecht() — und auf eine
 * *ungeprüfte* redirect_uri wird grundsätzlich nicht weitergeleitet
 * (RFC 6749 §4.1.2.1): wer client_id oder URI nicht kennt, bekommt eine
 * Fehlerseite, keine Weiterleitung.
 *
 * Still ist hier nichts: jede Anmeldung läuft über die schalenlose
 * Freigabeseite (app/freigeben), und erst deren Bestätigung stellt den Code
 * aus. GET prüft und verteilt, POST verarbeitet die Entscheidung als normalen
 * HTTP-Rundlauf, weil sein Ziel eine fremde App und keine RSC-Navigation ist.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const basis = process.env.APP_URL?.replace(/\/$/, '') || request.url;
  const suche = request.nextUrl.searchParams;
  const clientId = suche.get('client_id') ?? '';
  const redirectUri = suche.get('redirect_uri') ?? '';
  const responseType = suche.get('response_type') ?? '';
  const state = suche.get('state') ?? '';

  const client = oauthClientById(clientId);
  if (!client || !client.redirect_uris.includes(redirectUri)) {
    // Auf die ungeprüfte URI wird weiter nicht weitergeleitet (RFC 6749
    // §4.1.2.1) — aber der Mensch davor bekommt ein gestaltetes Blatt statt
    // eines nackten Browsertexts.
    return NextResponse.redirect(new URL('/freigeben/fehler', basis), {
      headers: {'Cache-Control': 'no-store'},
    });
  }

  // Ab hier ist die URI geprüft — Protokollfehler darf sie selbst erfahren.
  const zurueck = (params: Record<string, string>): Response => {
    const ziel = new URL(redirectUri);
    for (const [name, wert] of Object.entries(params)) ziel.searchParams.set(name, wert);
    if (state) ziel.searchParams.set('state', state);
    return NextResponse.redirect(ziel, {headers: {'Cache-Control': 'no-store'}});
  };
  if (responseType !== 'code') return zurueck({error: 'unsupported_response_type'});
  // `state` ist Pflicht: es ist der CSRF-Schutz der abholenden App, und eine
  // Hausanwendung, die ihn wegläßt, soll das beim ersten Versuch merken.
  if (!state) return zurueck({error: 'invalid_request'});

  const user = await getSessionUser();
  if (!user || !onboardingIstFertig(user.id)) {
    const weiter = request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(new URL(`/login?weiter=${encodeURIComponent(weiter)}`, basis), {
      headers: {'Cache-Control': 'no-store'},
    });
  }

  // Angemeldet — aber nicht durchgewinkt: die Entscheidung fällt auf der
  // Freigabeseite. Sie und die Aktion dahinter prüfen die Parameter erneut.
  const freigabe = new URL('/freigeben', basis);
  freigabe.searchParams.set('client_id', clientId);
  freigabe.searchParams.set('redirect_uri', redirectUri);
  freigabe.searchParams.set('state', state);
  return NextResponse.redirect(freigabe, {headers: {'Cache-Control': 'no-store'}});
}

export async function POST(request: NextRequest): Promise<Response> {
  const basis = process.env.APP_URL?.replace(/\/$/, '') || request.url;
  const form = await request.formData().catch(() => null);
  const clientId = String(form?.get('client_id') ?? '');
  const redirectUri = String(form?.get('redirect_uri') ?? '');
  const state = String(form?.get('state') ?? '');
  const entscheidung = String(form?.get('entscheidung') ?? '');
  const client = oauthClientById(clientId);
  const weiter = (ziel: string | URL): Response =>
    NextResponse.redirect(ziel, {status: 303, headers: {'Cache-Control': 'no-store'}});

  // Diese Werte stammen aus HTML und werden deshalb trotz der Prüfung beim
  // Anzeigen erneut geprüft. Auf eine ungeprüfte URI wird nie weitergeleitet.
  if (!client || !client.redirect_uris.includes(redirectUri) || !state) {
    // Wer hier landet, hat gerade „Weiter" geklickt — ein stiller Sprung auf
    // die Startseite hieße: keine Antwort. Das Fehlerblatt erklärt es.
    return weiter(new URL('/freigeben/fehler', basis));
  }

  const user = await getSessionUser();
  if (!user || !onboardingIstFertig(user.id)) {
    const autorisierung =
      `/api/oauth/authorize?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${encodeURIComponent(state)}`;
    // ?abgelaufen=1: die Person stand schon auf der Freigabeseite — die
    // Anmeldeseite erklärt, warum sie noch einmal gefragt wird.
    return weiter(new URL(`/login?weiter=${encodeURIComponent(autorisierung)}&abgelaufen=1`, basis));
  }

  const ziel = new URL(redirectUri);
  ziel.searchParams.set('state', state);
  if (entscheidung !== 'anmelden') {
    protokolliere({
      akteur: user,
      aktion: 'oauth.app-abgelehnt',
      gegenstand: `Anmeldung bei ${client.name} abgelehnt`,
    });
    ziel.searchParams.set('error', 'access_denied');
    return weiter(ziel);
  }

  const code = codeAusstellen(client, user.id, redirectUri);
  protokolliere({
    akteur: user,
    aktion: 'oauth.app-anmeldung',
    gegenstand: `Anmeldung bei ${client.name} über den Hub`,
  });
  ziel.searchParams.set('code', code);
  return weiter(ziel);
}
