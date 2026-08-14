import {NextResponse, type NextRequest} from 'next/server';
import {codeEinloesen, oauthClientById, tokenAusstellen} from '@/lib/oauth-apps';
import {protokolliere} from '@/lib/protokoll';

/**
 * Der Token-Endpunkt (RFC 6749 §4.1.3): die App löst — von Server zu Server,
 * ohne Browser — ihren Code gegen ein Token ein. Er spricht deshalb das
 * RFC-Vokabular (`invalid_grant`, `invalid_client`) statt `{fehler: '…'}`:
 * gelesen wird das von Client-Bibliotheken, nicht von Menschen, und die
 * erwarten die genormten Namen.
 *
 * Die App weist sich mit ihrem Geheimnis aus — per HTTP Basic (das MUSS ein
 * Server können, §2.3.1) oder als Formularfelder. Ein falsches Geheimnis
 * wird protokolliert wie eine fehlgeschlagene Anmeldung.
 */
export async function POST(request: NextRequest): Promise<Response> {
  const antwort = (status: number, body: Record<string, unknown>, headers?: Record<string, string>): Response =>
    NextResponse.json(body, {
      status,
      headers: {'Cache-Control': 'no-store', Pragma: 'no-cache', ...headers},
    });

  const form = await request.formData().catch(() => null);
  if (!form) return antwort(400, {error: 'invalid_request'});

  // Basic zuerst; die Feldwerte sind nach §2.3.1 formularkodiert.
  let clientId = String(form.get('client_id') ?? '');
  let secret = String(form.get('client_secret') ?? '');
  const basic = request.headers.get('authorization');
  if (basic?.startsWith('Basic ')) {
    try {
      const [kennung = '', geheim = ''] = Buffer.from(basic.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
      clientId = decodeURIComponent(kennung);
      secret = decodeURIComponent(geheim);
    } catch {
      return antwort(400, {error: 'invalid_request'});
    }
  }

  const client = oauthClientById(clientId);
  const geheimnisStimmt = client ? await Bun.password.verify(secret, client.secret_hash) : false;
  if (!client || !geheimnisStimmt) {
    protokolliere({
      akteur: null,
      akteurName: clientId.trim().slice(0, 120) || 'ohne Angabe',
      aktion: 'anmelden.fehlgeschlagen',
      gegenstand: 'App-Anmeldung am Token-Endpunkt',
      fehler: client ? 'Das App-Geheimnis ist falsch.' : 'Unbekannte oder gesperrte App-Anbindung.',
    });
    return antwort(401, {error: 'invalid_client'}, {'WWW-Authenticate': 'Basic realm="oauth"'});
  }

  if (String(form.get('grant_type') ?? '') !== 'authorization_code') {
    return antwort(400, {error: 'unsupported_grant_type'});
  }
  const code = String(form.get('code') ?? '');
  const redirectUri = String(form.get('redirect_uri') ?? '');
  if (!code || !redirectUri) return antwort(400, {error: 'invalid_request'});

  const eingeloest = codeEinloesen(client, code, redirectUri);
  if (eingeloest === 'invalid_grant') return antwort(400, {error: 'invalid_grant'});

  const {token, expiresIn} = tokenAusstellen(client, eingeloest.userId);
  return antwort(200, {access_token: token, token_type: 'Bearer', expires_in: expiresIn});
}
