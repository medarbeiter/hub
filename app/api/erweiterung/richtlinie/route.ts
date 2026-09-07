import {appBasis} from '@/lib/google';
import {erweiterungPaket, mobileconfig, regDatei, richtlinieJson} from '@/lib/erweiterung';

/**
 * Die Richtlinie zum Doppelklick: `?fuer=mac` als Konfigurationsprofil,
 * `?fuer=windows` als Registrierungsdatei, `?fuer=linux` als JSON. Öffentlich
 * wie das Paket — der Inhalt ist die Kennung und eine Adresse.
 */
const FORMEN = {
  mac: {bau: mobileconfig, datei: 'MedArbeiter-Zugangscodes.mobileconfig', typ: 'application/x-apple-aspen-config'},
  windows: {bau: regDatei, datei: 'MedArbeiter-Zugangscodes.reg', typ: 'text/plain; charset=utf-8'},
  linux: {bau: richtlinieJson, datei: 'medarbeiter.json', typ: 'application/json'},
} as const;

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const basis = appBasis(url.origin);
  const paket = erweiterungPaket(basis);
  if (!paket) return new Response('Kein ERWEITERUNG_KEY gesetzt.', {status: 404});
  const fuer = url.searchParams.get('fuer') as keyof typeof FORMEN | null;
  const form = fuer && FORMEN[fuer];
  if (!form) return new Response('Unbekannte Form.', {status: 400});
  return new Response(form.bau(paket, basis), {
    headers: {
      'Content-Type': form.typ,
      'Content-Disposition': `attachment; filename="${form.datei}"`,
      'Cache-Control': 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
