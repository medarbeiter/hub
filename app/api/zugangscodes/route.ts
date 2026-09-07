import {getSessionUser} from '@/lib/auth';
import {protokolliere} from '@/lib/protokoll';
import {hatRecht} from '@/lib/rechte';
import {otpauthParsen, VERFAHREN_STANDARD} from '@/lib/totp';
import {hostNormieren} from '@/lib/zugangscode-treffer';
import {
  codesFuerSeite,
  seiteMerken,
  sichtbarkeitText,
  zugangskontoAnlegen,
  zugangskontoById,
  zugangskontoName,
  type ZugangskontoEingabe,
} from '@/lib/zugangscodes';
import type {User} from '@/lib/db';

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
 * POST {otpauth | secret, dienst?, konto?, host}
 *                               → legt einen Zugang an, den die Erweiterung auf einer
 *                                 Einrichtungsseite gelesen hat (QR-Code oder Schlüssel).
 *                                 „Nur für mich", Seite gleich gemerkt; Recht `zugangscodes.erfassen`.
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
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const host = hostNormieren(String(body?.host ?? ''));
  if (host === null) return new Response('Unvollständig.', {status: 400});
  if (typeof body?.otpauth === 'string' || typeof body?.secret === 'string') return anlegen(user, body, host);
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Unvollständig.', {status: 400});

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

/**
 * Ein von der Erweiterung gelesener Zugang. Der Browser ist keine Grenze: der
 * otpauth-Link wird hier noch einmal gelesen, ein nackter Schlüssel läuft
 * durch dieselbe Base32-Prüfung wie im Formular. Leserkreis ist „Nur für
 * mich" — erweitert wird im Hub, wo die Personen und Rollen stehen. Die Seite
 * wird sofort gemerkt, damit der nächste Anmeldeversuch dort Stufe 3 trifft.
 */
function anlegen(user: User, body: Record<string, unknown>, host: string): Response {
  if (!hatRecht(user, 'zugangscodes.erfassen')) return new Response('Dafür fehlt das Recht, Zugänge zu erfassen.', {status: 403});
  let dienst = String(body.dienst ?? '').trim();
  let konto = String(body.konto ?? '').trim();
  const kreis = {sichtbarkeit: 'personen' as const, personen: [user.id], seiten: host};
  let eingabe: ZugangskontoEingabe;
  if (typeof body.otpauth === 'string') {
    const geparst = otpauthParsen(body.otpauth);
    if (typeof geparst === 'string') return new Response(geparst, {status: 400, headers: KOPF});
    dienst = dienst || geparst.dienst;
    konto = konto || geparst.konto;
    eingabe = {dienst, konto: konto || null, secret: geparst.secret, verfahren: geparst.verfahren, ...kreis};
  } else {
    eingabe = {dienst, konto: konto || null, secret: String(body.secret ?? ''), verfahren: VERFAHREN_STANDARD, ...kreis};
  }

  const ergebnis = zugangskontoAnlegen(user, eingabe);
  const konto_ = typeof ergebnis === 'string' ? {dienst, konto: konto || null} : ergebnis;
  // Wie beim Passwort: die Tatsache ins Protokoll, das Geheimnis nie.
  protokolliere({
    akteur: user,
    aktion: 'zugangscode.anlegen',
    gegenstand: `Zugangscode ${zugangskontoName(konto_)}`,
    betroffen: null,
    nachher:
      typeof ergebnis === 'string'
        ? {Dienst: dienst, Konto: konto || null, Quelle: `Erweiterung auf ${host}`}
        : {
            Dienst: ergebnis.dienst,
            Konto: ergebnis.konto,
            Verfahren: `${ergebnis.algorithmus}, ${ergebnis.stellen} Stellen, alle ${ergebnis.periode} s`,
            'Sichtbar für': sichtbarkeitText(ergebnis) ?? 'Alle Angemeldeten',
            Seite: host,
          },
    fehler: typeof ergebnis === 'string' ? ergebnis : null,
  });
  if (typeof ergebnis === 'string') return new Response(ergebnis, {status: 400, headers: KOPF});
  return Response.json({ok: true, id: ergebnis.id, name: zugangskontoName(ergebnis)}, {headers: KOPF});
}
