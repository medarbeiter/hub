import {getSessionUser} from '@/lib/auth';
import {kommentareFuer} from '@/lib/profil-kommentare';
import {hatRecht} from '@/lib/rechte';

/**
 * Die Kommentare an einer Personenkarte, beim Öffnen nachgeladen.
 *
 * Eigene Adresse statt eines Feldes in `api/person`, aus einem einzigen Grund:
 * **die Angaben dort dürfen fünf Minuten alt sein, ein gerade geschriebener
 * Kommentar nicht.** Wer etwas abschickt und es nicht erscheinen sieht,
 * schreibt es ein zweites Mal.
 *
 * Die Grenze ist dieselbe wie nebenan: angemeldet genügt. Was auf einer Karte
 * steht, die jedes Konto öffnen kann, ist im Haus ohnehin öffentlich — und wer
 * löschen darf, entscheidet der Server je Zeile (`darfLoeschen`), nicht der
 * Browser.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{userId: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

  const {userId} = await params;
  return Response.json(
    {
      // Ob dieses Konto überhaupt schreiben darf, entscheidet der Server —
      // sonst stünde ein Feld da, dessen Absenden abgewiesen wird.
      darfSchreiben: hatRecht(user, 'profil.kommentieren'),
      eintraege: kommentareFuer(Number(userId), user),
    },
    {
      headers: {'Cache-Control': 'no-store'},
    },
  );
}
