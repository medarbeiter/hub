import {getSessionUser} from '@/lib/auth';
import {personenKarte} from '@/lib/personenkarte';

/**
 * Die Personenkarte, in einer Antwort nachgeladen.
 *
 * Die Grenze ist dieselbe wie beim Profilbild (`api/avatar`) und aus demselben
 * Grund: **angemeldet** genügt. Name, Rolle und dienstliche Adresse stehen im
 * Haus auf jedem Verteiler. Was darüber hinausgeht — Zeitkonto, Resturlaub, die
 * Wege in die Verwaltung — schneidet `personenKarte()` je Recht des Fragenden
 * zu; der Browser bekommt nur, was er zeigen darf, und lernt kein Recht.
 *
 * `no-store`, weil die Kommentare mitkommen: wer etwas abschickt und es nicht
 * erscheinen sieht, schreibt es ein zweites Mal.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{userId: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const {userId} = await params;
  if (!/^\d{1,9}$/.test(userId)) return new Response('Nicht gefunden.', {status: 404});
  const karte = personenKarte(user, Number(userId));
  if (!karte) return new Response('Nicht gefunden.', {status: 404});

  return Response.json(karte, {headers: {'Cache-Control': 'no-store'}});
}
