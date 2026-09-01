import {NextResponse, type NextRequest} from 'next/server';
import {avatarQuelle} from '@/lib/avatar';
import {tokenPruefen} from '@/lib/oauth-apps';

/**
 * Wer bin ich? Die App legt ihr Token vor und bekommt die Identität samt
 * Rolle, wirksamen Rechten und Profilbild — mehr weiß MedArbeiter über
 * niemanden preiszugeben, und mehr braucht eine Hausanwendung nicht, um ihre
 * eigene Sitzung zu führen. `sub` ist als Zeichenkette zugesagt, damit der
 * Vertrag hält, falls die Kennungen je den Typ wechseln.
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
    {
      sub: String(user.id),
      name: user.name,
      email: user.email,
      role: user.role,
      // Immer voll entfaltet und ohne das wörtliche „*": die App prüft
      // `rechte.includes('…')`, und der Platzhalter träfe dort nichts.
      rechte: user.rechte.filter((recht) => recht !== '*'),
      // Relative Adresse, wie überall im Haus (avatarQuelle()) — die Hausanwendung
      // löst sie gegen den Hub auf, genau wie sie es mit Fotos aus /api/avatar tut.
      picture: avatarQuelle(user),
    },
    {headers: {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'}},
  );
}
