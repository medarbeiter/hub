import {NextResponse, type NextRequest} from 'next/server';
import {tokenPruefen} from '@/lib/oauth-apps';

/**
 * Wer bin ich? Die App legt ihr Token vor und bekommt die Identität samt
 * Rolle und wirksamen Rechten — mehr weiß MedArbeiter über niemanden
 * preiszugeben, und mehr braucht eine Hausanwendung nicht, um ihre eigene
 * Sitzung zu führen. `sub` ist als Zeichenkette zugesagt, damit der Vertrag
 * hält, falls die Kennungen je den Typ wechseln.
 *
 * Ein deaktiviertes Konto ist hier sofort unbekannt, auch mit lebendem
 * Token — die Prüfung steckt im Join von tokenPruefen().
 */
export async function GET(request: NextRequest): Promise<Response> {
  const kopf = request.headers.get('authorization') ?? '';
  const token = kopf.startsWith('Bearer ') ? kopf.slice(7).trim() : '';
  const ergebnis = token ? tokenPruefen(token) : null;
  if (!ergebnis) {
    return NextResponse.json(
      {error: 'invalid_token'},
      {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Bearer error="invalid_token"',
          'Cache-Control': 'private, no-store',
        },
      },
    );
  }
  const {user} = ergebnis;
  return NextResponse.json(
    {sub: String(user.id), name: user.name, email: user.email, role: user.role, rechte: user.rechte},
    {headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}},
  );
}
