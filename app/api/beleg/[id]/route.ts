import {getSessionUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {BELEG_TYPEN, belegById, belegDateiPfad} from '@/lib/spesen';

/**
 * Liefert die Datei eines Belegs aus. Sie liegt außerhalb von public/, damit sie
 * nur über diesen Handler erreichbar ist: sehen darf sie die reisende Person
 * selbst und die Verwaltung, sonst niemand.
 *
 * Wie beim CSV-Export wird hier mit einem 403 geantwortet statt mit dem Redirect
 * aus requireRecht() — ein Route Handler muss eine Response zurückgeben.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const {id} = await params;
  const beleg = belegById(Number(id));
  if (!beleg) return new Response('Beleg nicht gefunden.', {status: 404});
  if (!hatRecht(user, 'spesen.pruefen') && user.id !== beleg.user_id) {
    return new Response('Nicht berechtigt.', {status: 403});
  }
  if (!beleg.datei) return new Response('Zu diesem Beleg gibt es keine Datei.', {status: 404});

  // Der Typ kommt aus der Allowlist, nie aus dem, was der Browser beim Upload
  // behauptet hat; der Dateiname wird ebenfalls neu gebildet.
  const endung = beleg.datei_typ ? BELEG_TYPEN[beleg.datei_typ] : undefined;
  if (!endung) return new Response('Nicht berechtigt.', {status: 403});

  const datei = Bun.file(belegDateiPfad(beleg.datei));
  if (!(await datei.exists())) return new Response('Datei nicht gefunden.', {status: 404});

  return new Response(await datei.arrayBuffer(), {
    headers: {
      'Content-Type': beleg.datei_typ!,
      'Content-Disposition': `inline; filename="beleg-${beleg.id}.${endung}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
