import {getDb} from '@/lib/db';

export function healthResponse(check = () => {
  getDb().query('SELECT 1').get();
}): Response {
  try {
    check();
    return Response.json({status: 'ok'}, {headers: {'Cache-Control': 'no-store'}});
  } catch (error) {
    console.error('Healthcheck fehlgeschlagen:', error);
    return Response.json(
      {status: 'nicht_bereit'},
      {status: 503, headers: {'Cache-Control': 'no-store'}},
    );
  }
}

export function GET(): Response {
  return healthResponse();
}
