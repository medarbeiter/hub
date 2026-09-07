import {appBasis} from '@/lib/google';
import {erweiterungPaket, updateXml} from '@/lib/erweiterung';

/**
 * Das Update-Manifest der Browser-Erweiterung (Omaha), auf das die
 * Richtlinie ExtensionInstallForcelist zeigt. Öffentlich: Chrome fragt es
 * ohne Sitzung ab, und es nennt nur Kennung, Version und Paketadresse.
 */
export async function GET(request: Request): Promise<Response> {
  const basis = appBasis(new URL(request.url).origin);
  const paket = erweiterungPaket(basis);
  if (!paket) return new Response('Kein ERWEITERUNG_KEY gesetzt.', {status: 404});
  return new Response(updateXml(paket, basis), {
    headers: {'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=300'},
  });
}
