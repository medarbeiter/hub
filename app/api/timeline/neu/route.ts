import {getSessionUser} from '@/lib/auth';
import {neueEreignisse} from '@/lib/timeline-wecker';

/** „Was ist seit meinem letzten Blick in der Timeline passiert?" — siehe lib/timeline-wecker.ts. */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});
  const seit = Number(new URL(request.url).searchParams.get('seit'));
  return Response.json(await neueEreignisse(Number.isFinite(seit) ? seit : Date.now()), {headers: {'Cache-Control': 'no-store'}});
}
