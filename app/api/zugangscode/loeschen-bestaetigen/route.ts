import {NextResponse, type NextRequest} from 'next/server';
import {getSessionUser} from '@/lib/auth';
import {protokolliere} from '@/lib/protokoll';
import {zugangskontoLoeschungBestaetigen, zugangskontoName} from '@/lib/zugangscodes';

/**
 * Der Bestätigungslink aus der Löschungs-E-Mail (lib/benachrichtigungen.ts).
 * Erst dieser Klick löscht — die Anfrage aus der Anwendung heraus tut es
 * nicht mehr (app/actions.ts, zugangscodeLoeschungAnfordernAction). Ohne
 * Sitzung geht es über /login zurück, wie beim OAuth-Autorisierungsendpunkt.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const basis = process.env.APP_URL?.replace(/\/$/, '') || request.url;
  const token = request.nextUrl.searchParams.get('token') ?? '';
  const user = await getSessionUser();
  if (!user) {
    const weiter = request.nextUrl.pathname + request.nextUrl.search;
    return NextResponse.redirect(new URL(`/login?weiter=${encodeURIComponent(weiter)}`, basis), {
      headers: {'Cache-Control': 'no-store'},
    });
  }

  const geloescht = zugangskontoLoeschungBestaetigen(user, token);
  const ziel = new URL('/zugangscodes', basis);
  if (typeof geloescht === 'string') {
    ziel.searchParams.set('zugangscode_fehler', geloescht);
    return NextResponse.redirect(ziel, {status: 303, headers: {'Cache-Control': 'no-store'}});
  }

  // Ein Token kann mehrere Zugänge tragen (Sammel-Löschung) — je Zeile ein
  // eigener Protokolleintrag, denn jede Spur gehört an ihren Datensatz.
  for (const konto of geloescht) {
    protokolliere({
      akteur: user,
      aktion: 'zugangscode.loeschen',
      gegenstand: `Zugangscode ${zugangskontoName(konto)}`,
      betroffen: null,
    });
  }
  ziel.searchParams.set(
    'zugangscode_bestaetigt',
    geloescht.length === 1 ? zugangskontoName(geloescht[0]!) : `${geloescht.length} Zugänge`,
  );
  return NextResponse.redirect(ziel, {status: 303, headers: {'Cache-Control': 'no-store'}});
}
