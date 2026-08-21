import {AVATAR_TYPEN} from '@/lib/avatar';
import {getSessionUser} from '@/lib/auth';
import {oauthClientById} from '@/lib/oauth-apps';
import {avatarDateiPfad, profilbildVon} from '@/lib/profilbild';

/**
 * Prüft, ob die Anfrage von einer verbundenen Hausanwendung kommt (dasselbe
 * Basic-Verfahren wie am Token-Endpunkt, App-Geheimnis statt Nutzer-Token —
 * so kann die App das Bild für ihre eigene, längst laufende Sitzung
 * nachladen, ohne das einstündige, verbrauchte Zugriffstoken aufzuheben).
 */
async function alsVerbundeneAppErkannt(request: Request): Promise<boolean> {
  const basic = request.headers.get('authorization');
  if (!basic?.startsWith('Basic ')) return false;
  try {
    const [kennung = '', geheim = ''] = Buffer.from(basic.slice(6), 'base64').toString('utf8').split(/:(.*)/s);
    const client = oauthClientById(decodeURIComponent(kennung));
    return client ? await Bun.password.verify(decodeURIComponent(geheim), client.secret_hash) : false;
  } catch {
    return false;
  }
}

/**
 * Liefert das eigene Profilbild aus. Die Datei liegt außerhalb von public/ und
 * ist nur über diesen Handler erreichbar — sonst wäre sie schon durch ihren
 * Namen für das ganze Internet abrufbar.
 *
 * Der Zugang ist bewusst weiter als bei Beleg und Bescheinigung: dort darf nur
 * die betroffene Person und die Verwaltung sehen, hier jedes **angemeldete**
 * Konto. Ein Profilbild ist genau dafür da, im Team erkannt zu werden — es in
 * der Seitenleiste zu zeigen und im Teamblatt zu verbergen wäre keine Regel,
 * sondern ein Widerspruch. Angemeldet bleibt die Grenze: für einen nicht
 * angemeldeten Abruf ist es ein Bild einer Person, das niemandem gehört —
 * eine verbundene Hausanwendung zählt dafür wie ein eigener, angemeldeter
 * Abruf, weil sie das Bild nur für ihre eigene, bereits geprüfte Sitzung holt.
 */
export async function GET(
  request: Request,
  {params}: {params: Promise<{userId: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user && !(await alsVerbundeneAppErkannt(request))) return new Response('Nicht berechtigt.', {status: 403});

  const {userId} = await params;
  const person = profilbildVon(Number(userId));
  if (!person?.avatar_datei) return new Response('Kein Profilbild hinterlegt.', {status: 404});

  // Der Typ kommt aus der Allowlist, nie aus dem, was der Browser beim Upload
  // behauptet hat; der Dateiname wurde beim Speichern neu gebildet.
  const endung = person.avatar_datei_typ ? AVATAR_TYPEN[person.avatar_datei_typ] : undefined;
  if (!endung) return new Response('Nicht berechtigt.', {status: 403});

  const datei = Bun.file(avatarDateiPfad(person.avatar_datei));
  if (!(await datei.exists())) return new Response('Datei nicht gefunden.', {status: 404});

  return new Response(await datei.arrayBuffer(), {
    headers: {
      'Content-Type': person.avatar_datei_typ!,
      /* Privat, aber zwischenspeicherbar: das Bild steht in jeder Seitenleiste
         und in jedem Teamblatt, und ein `no-store` hieße, es bei jedem
         Seitenwechsel neu zu holen. `private` hält es aus fremden Zwischen-
         speichern heraus. Ein *ersetztes* Bild kommt nicht über diese Frist an,
         sondern über die Adresse: `avatarQuelle()` hängt die Dateikennung als
         `?v=` an, ein neues Bild ist also eine neue Adresse. */
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
