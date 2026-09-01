import {NextResponse, type NextRequest} from 'next/server';
import {oauthClientById} from '@/lib/oauth-apps';
import {KONKRETE_RECHTE} from '@/lib/rechte';
import {alleRollen} from '@/lib/rollen';
import {protokolliere} from '@/lib/protokoll';

/**
 * Der Rollen- und Rechte-Katalog für Hausanwendungen: welche Rollen es gibt
 * und welche konkreten Rechte in `rechte[]` einer userinfo-Antwort stehen
 * können. Die App weist sich mit ihren eigenen Zugangsdaten aus — per HTTP
 * Basic wie am Token-Endpunkt, ohne Nutzertoken: der Katalog gehört zur
 * Anbindung, nicht zu einer Person. Das wörtliche „*" steht nie darin
 * (KONKRETE_RECHTE) — es ist eine Vergabe-Abkürzung, kein Recht im Vertrag.
 */
export async function GET(request: NextRequest): Promise<Response> {
  let clientId = '';
  let secret = '';
  const basic = request.headers.get('authorization');
  if (basic?.startsWith('Basic ')) {
    try {
      const [kennung = '', geheim = ''] = Buffer.from(basic.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
      clientId = decodeURIComponent(kennung);
      secret = decodeURIComponent(geheim);
    } catch {
      // fällt auf invalid_client durch
    }
  }

  const client = oauthClientById(clientId);
  const geheimnisStimmt = client ? await Bun.password.verify(secret, client.secret_hash) : false;
  if (!client || !geheimnisStimmt) {
    protokolliere({
      akteur: null,
      akteurName: clientId.trim().slice(0, 120) || 'ohne Angabe',
      aktion: 'anmelden.fehlgeschlagen',
      gegenstand: 'App-Anmeldung am Rollen-Katalog',
      fehler: client ? 'Das App-Geheimnis ist falsch.' : 'Unbekannte oder gesperrte App-Anbindung.',
    });
    return NextResponse.json(
      {error: 'invalid_client'},
      {status: 401, headers: {'WWW-Authenticate': 'Basic realm="oauth"', 'Cache-Control': 'no-store'}},
    );
  }

  return NextResponse.json(
    {roles: alleRollen().map((rolle) => rolle.schluessel), rechte: KONKRETE_RECHTE},
    {headers: {'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'}},
  );
}
