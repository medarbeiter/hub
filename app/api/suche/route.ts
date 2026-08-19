import {getSessionUser} from '@/lib/auth';
import {suche} from '@/lib/suche';

/**
 * Die Suche als Abruf, weil sie mit jedem Tastendruck eine andere Antwort hat.
 *
 * Der Zuschnitt liegt in `lib/suche.ts` und damit auf dem Server — was diese
 * Antwort nicht enthält, kann der Browser auch nicht ausplaudern (dieselbe
 * Haltung wie `api/person`). `getSessionUser()` statt `requireUser()`: eine
 * Umleitung ist keine sinnvolle Antwort auf einen Abruf.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const params = new URL(request.url).searchParams;
  const frage = params.get('q') ?? '';
  // Der Reiter der Palette. Ein unbekannter Name schneidet auf nichts zu und
  // liefert eine leere Antwort — geprüft werden muss er nicht: er filtert, was
  // der Rechteschnitt oben ohnehin schon übrig gelassen hat.
  const bereich = params.get('bereich') ?? undefined;
  return Response.json(suche(user, frage, bereich), {
    // Persönlich zugeschnitten und minutenaktuell — nichts davon gehört in
    // einen Zwischenspeicher.
    headers: {'Cache-Control': 'no-store'},
  });
}
