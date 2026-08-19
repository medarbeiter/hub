import {getSessionUser} from '@/lib/auth';
import {personAngabeById} from '@/lib/users';

/**
 * Die Angaben zu einer Person, für die Personenkarte nachgeladen.
 *
 * Die Grenze ist dieselbe wie beim Profilbild (`api/avatar`) und aus demselben
 * Grund: **angemeldet** genügt. Name, Rolle und dienstliche Adresse stehen im
 * Haus auf jedem Verteiler, und sie in der Mitarbeiterliste zu zeigen und in
 * der Karte daneben zu verschweigen wäre keine Regel, sondern ein Widerspruch.
 * Vertragsdaten kommen hier nicht vor — `personAngabe()` trägt sie gar nicht
 * erst, und was diese Antwort nicht kennt, kann sie auch nicht ausplaudern.
 *
 * Warum überhaupt ein Abruf: eine Zeile einer Liste schleppt Rolle und Adresse
 * sonst tausendfach mit, damit sie einmal gelesen werden.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{userId: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const {userId} = await params;
  const person = personAngabeById(Number(userId));
  if (!person) return new Response('Nicht gefunden.', {status: 404});

  return Response.json(person, {
    // Wie das Bild: privat, aber kurz zwischenspeicherbar — dieselbe Karte
    // wird beim Durchsehen einer Liste mehrmals hintereinander geöffnet.
    headers: {'Cache-Control': 'private, max-age=300, must-revalidate'},
  });
}
