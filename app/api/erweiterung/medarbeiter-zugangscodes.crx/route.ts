import {appBasis} from '@/lib/google';
import {ERWEITERUNG_DATEI, erweiterungPaket} from '@/lib/erweiterung';

/**
 * Das signierte Paket. Öffentlich wie das Manifest — es enthält nur den
 * Quelltext der Erweiterung, kein Geheimnis: die Codes holt sie erst zur
 * Laufzeit mit der Sitzung der angemeldeten Person.
 */
export async function GET(request: Request): Promise<Response> {
  const basis = appBasis(new URL(request.url).origin);
  const paket = erweiterungPaket(basis);
  if (!paket) return new Response('Kein ERWEITERUNG_KEY gesetzt.', {status: 404});
  return new Response(new Uint8Array(paket.crx), {
    headers: {
      'Content-Type': 'application/x-chrome-extension',
      'Content-Disposition': `attachment; filename="${ERWEITERUNG_DATEI}"`,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
