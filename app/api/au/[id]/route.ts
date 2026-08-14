import {AU_TYPEN, abwesenheitById, auDateiPfad} from '@/lib/abwesenheit';
import {getSessionUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';

/**
 * Liefert die Arbeitsunfähigkeitsbescheinigung aus. Wie beim Beleg liegt die
 * Datei außerhalb von public/ und ist nur über diesen Handler erreichbar; sehen
 * darf sie die erkrankte Person selbst und die Verwaltung.
 *
 * Anders als ein Beleg ist das eine Gesundheitsangabe. Deshalb steht hier
 * zusätzlich `no-store` ohne Ausnahme, und die Antwort verrät auch dann nichts
 * über die Person, wenn jemand Kennungen durchprobiert: eine fremde Meldung
 * beantwortet sich mit 403, nicht mit einem Hinweis auf ihren Inhalt.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{id: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const {id} = await params;
  const abwesenheit = abwesenheitById(Number(id));
  if (!abwesenheit) return new Response('Nicht gefunden.', {status: 404});
  if (!hatRecht(user, 'abwesenheit.pruefen') && user.id !== abwesenheit.user_id) {
    return new Response('Nicht berechtigt.', {status: 403});
  }
  if (!abwesenheit.au_datei) return new Response('Keine Bescheinigung hinterlegt.', {status: 404});

  // Der Typ kommt aus der Allowlist, nie aus dem, was der Browser beim Upload
  // behauptet hat; der Dateiname wird ebenfalls neu gebildet.
  const endung = abwesenheit.au_datei_typ ? AU_TYPEN[abwesenheit.au_datei_typ] : undefined;
  if (!endung) return new Response('Nicht berechtigt.', {status: 403});

  const datei = Bun.file(auDateiPfad(abwesenheit.au_datei));
  if (!(await datei.exists())) return new Response('Datei nicht gefunden.', {status: 404});

  return new Response(await datei.arrayBuffer(), {
    headers: {
      'Content-Type': abwesenheit.au_datei_typ!,
      'Content-Disposition': `inline; filename="bescheinigung-${abwesenheit.id}.${endung}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
