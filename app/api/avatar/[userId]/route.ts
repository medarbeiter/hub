import {AVATAR_TYPEN} from '@/lib/avatar';
import {getSessionUser} from '@/lib/auth';
import {avatarDateiPfad, profilbildVon} from '@/lib/profilbild';

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
 * angemeldeten Abruf ist es ein Bild einer Person, das niemandem gehört.
 */
export async function GET(
  _request: Request,
  {params}: {params: Promise<{userId: string}>},
): Promise<Response> {
  const user = await getSessionUser();
  if (!user) return new Response('Nicht berechtigt.', {status: 403});

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
         speichern heraus, `must-revalidate` sorgt dafür, dass ein neues Bild
         nach kurzer Zeit auch ankommt. */
      'Cache-Control': 'private, max-age=300, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
