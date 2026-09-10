import {getSessionUser} from '@/lib/auth';
import {fahrzeugBelegById} from '@/lib/fahrzeug';
import {hatRecht} from '@/lib/rechte';
import {BELEG_TYPEN, belegDateiPfad} from '@/lib/spesen';

/** Die Datei eines Fahrzeugbelegs — dieselbe Grenze wie /api/beleg: Person selbst und Verwaltung. */
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const {id} = await params;
  const beleg = fahrzeugBelegById(Number(id));
  if (!beleg) return new Response('Beleg nicht gefunden.', {status: 404});
  if (!hatRecht(user, 'spesen.pruefen') && user.id !== beleg.user_id) {
    return new Response('Nicht berechtigt.', {status: 403});
  }
  if (!beleg.datei) return new Response('Zu diesem Beleg gibt es keine Datei.', {status: 404});

  const endung = beleg.datei_typ ? BELEG_TYPEN[beleg.datei_typ] : undefined;
  if (!endung) return new Response('Nicht berechtigt.', {status: 403});

  const datei = Bun.file(belegDateiPfad(beleg.datei));
  if (!(await datei.exists())) return new Response('Datei nicht gefunden.', {status: 404});

  return new Response(await datei.arrayBuffer(), {
    headers: {
      'Content-Type': beleg.datei_typ!,
      'Content-Disposition': `inline; filename="fahrzeugbeleg-${beleg.id}.${endung}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
