import {getSessionUser} from '@/lib/auth';
import {resonanzFuer} from '@/lib/resonanz';
import {neueEreignisse} from '@/lib/timeline-wecker';

/** „Was ist seit meinem letzten Blick in der Timeline passiert?" — siehe lib/timeline-wecker.ts. */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});
  const seit = Number(new URL(request.url).searchParams.get('seit'));
  const ab = Number.isFinite(seit) ? seit : Date.now();
  // Dazu, was **dieser** Person seither gesagt wurde — persönlich, darum nicht im geteilten Stand.
  return Response.json({...(await neueEreignisse(ab)), resonanz: resonanzFuer(user.id, new Date(ab))}, {headers: {'Cache-Control': 'no-store'}});
}
