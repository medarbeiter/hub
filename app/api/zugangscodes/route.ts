import {getSessionUser} from '@/lib/auth';
import {protokolliere} from '@/lib/protokoll';
import {hatRecht} from '@/lib/rechte';
import {hostNormieren} from '@/lib/zugangscode-treffer';
import {codesFuerSeite, seiteMerken, zugangskontoById, zugangskontoName} from '@/lib/zugangscodes';

/**
 * Die Zugangscodes für die Browser-Erweiterung (extension/).
 *
 * Dieselbe Grenze wie die Seite /zugangscodes: die Sitzung, die der Browser
 * ohnehin trägt, und das Recht `zugangscodes.sehen`; der Zuschnitt auf den
 * Leserkreis liegt in `sichtbareZugangskonten()` und nirgends hier. Die
 * Erweiterung bekommt fertige Codes samt Ablauf — nie das Geheimnis, exakt
 * wie die Seite. Kein eigenes Token, kein OAuth: sie läuft im selben Browser,
 * in dem die Person am Hub angemeldet ist, und ein zweiter Schlüssel wäre ein
 * zweiter Ort, an dem einer verloren gehen kann.
 *
 * GET  ?host=login.example.com  → {jetztMs, codes: SeitenCode[]} — passendste zuerst.
 * POST {id, host}               → merkt: dieser Zugang gehört zu dieser Seite.
 *
 * Der POST verlangt JSON; ein fremdes Fenster kann das mit der Sitzung nicht
 * ohne Preflight schicken, und die Erweiterung ist keine fremde Seite.
 */
const KOPF = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'};

export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user || !hatRecht(user, 'zugangscodes.sehen')) return new Response('Nicht berechtigt.', {status: 403});
  const host = new URL(request.url).searchParams.get('host');
  const jetztMs = Date.now();
  return Response.json({jetztMs, codes: codesFuerSeite(user, host, jetztMs)}, {headers: KOPF});
}

export async function POST(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user || !hatRecht(user, 'zugangscodes.sehen')) return new Response('Nicht berechtigt.', {status: 403});
  if (!(request.headers.get('content-type') ?? '').includes('application/json')) {
    return new Response('Erwartet JSON.', {status: 415});
  }
  const body = (await request.json().catch(() => null)) as {id?: unknown; host?: unknown} | null;
  const id = Number(body?.id);
  const host = hostNormieren(String(body?.host ?? ''));
  if (!Number.isInteger(id) || id <= 0 || host === null) return new Response('Unvollständig.', {status: 400});

  const fehler = seiteMerken(user, id, host);
  const konto = zugangskontoById(id);
  protokolliere({
    akteur: user,
    aktion: 'zugangscode.seite',
    gegenstand: `Zugangscode ${konto ? zugangskontoName(konto) : `#${id}`}`,
    betroffen: null,
    nachher: {Seite: host},
    fehler,
  });
  if (fehler) return new Response(fehler, {status: 400, headers: KOPF});
  return Response.json({ok: true, host}, {headers: KOPF});
}
