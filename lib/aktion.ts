/**
 * Das Netz unter jeder Server-Aktion (rein, client-importierbar).
 *
 * Eine Server-Aktion kann auf zwei Wegen scheitern, und nur einer davon war
 * bedacht: sie kann *antworten* („Du bist bereits eingestempelt." — das ist
 * `ActionState.error`, den jede Aufrufstelle längst behandelt), und sie kann
 * den Server gar nicht erst erreichen. Der zweite Weg verwarf die Zusage
 * (`Promise`), React reichte die Verwerfung an die nächste Fehlergrenze weiter
 * — und aus einem misslungenen Klick wurde die ganze Schale in `error.tsx`.
 *
 * Der häufigste Anlass ist eine Seite, die lange offen lag: Next erkennt jede
 * Aktion an einer ID aus den Build-Artefakten und dreht diese IDs bei jedem
 * Deployment, spätestens aber alle 14 Tage. Der alte Reiter ruft dann eine ID
 * auf, die es nicht mehr gibt („Failed to find Server Action"). Dasselbe
 * geschieht einem Rechner, der aus dem Schlaf kommt, bevor das Netz wieder
 * steht.
 *
 * **Hier wird nicht unterschieden, was schiefging.** Next wirft die
 * veraltete-ID-Fehlermeldung serverseitig (`action-handler.js`), sie kommt
 * also mit `digest` beim Browser an — genau wie ein echter Programmfehler in
 * der Aktion. Eine Meldung, die „keine Verbindung" behauptet, wäre bei einem
 * echten Fehler eine Lüge, und eine, die „es wurde nichts gespeichert"
 * behauptet, wäre eine Lüge über einen Datensatz, auf dem die Lohnabrechnung
 * sitzt: ein Fehler *nach* dem Schreiben sähe von hier aus gleich aus. Gesagt
 * wird darum nur, was sicher stimmt — die Handlung ist nicht abgeschlossen —
 * und was hilft: neu laden und nachsehen. Der wirkliche Fehler geht auf die
 * Konsole, damit er auffindbar bleibt.
 */

/** Was die Aufrufstelle als `error` bekommt, wenn die Aktion nicht ankam. */
export const AKTION_FEHLGESCHLAGEN =
  'Die Handlung konnte nicht abgeschlossen werden. Die Seite ist möglicherweise veraltet; bitte neu laden und nachsehen, ob sie angekommen ist.';

function notieren(fehler: unknown): void {
  console.error('[MedArbeiter] Server-Aktion nicht abgeschlossen', fehler);
}

/**
 * Legt das Netz unter eine Aktion, die einen `{error}` zurückgibt: aus der
 * Verwerfung wird derselbe Fehler, den die Aufrufstelle ohnehin schon anzeigt.
 * Damit ändert sich an keiner Aufrufstelle die Behandlung — nur der Absturz
 * bleibt aus, und was der Mensch gerade getippt hat, steht noch da.
 *
 * Der Rückgabewert wird als `R` ausgegeben, obwohl im Fehlerfall nur `error`
 * darin steht. Das ist die eine Annahme dieses Moduls, und sie ist im Haus
 * überall erfüllt: **wer mehr als `error` aus einer Antwort liest, prüft
 * vorher `error`** (`lock-all-button.tsx` liest `locked`/`skipped` erst im
 * Erfolgszweig). Für Formularaktionen, wo diese Annahme nicht trägt, gibt es
 * `sicheresFormular()` weiter unten — das braucht den Kunstgriff nicht.
 */
export function sicher<A extends unknown[], R extends {error: string | null}>(
  aktion: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return async (...args: A) => {
    try {
      return await aktion(...args);
    } catch (fehler) {
      notieren(fehler);
      return {error: AKTION_FEHLGESCHLAGEN} as R;
    }
  };
}

/**
 * Dasselbe für `useActionState`: eine Formularaktion bekommt ihren vorigen
 * Zustand gereicht, und genau der ist im Fehlerfall die richtige Antwort —
 * mit gesetztem `error`. So bleibt alles stehen, was der Zustand sonst noch
 * trägt (das einmalig gezeigte Secret einer App-Anbindung, der
 * Einrichtungsschritt der Anmeldung), statt unter einer nackten
 * Fehlermeldung zu verschwinden.
 *
 * Auf Modulebene aufrufen, wo es geht: die umhüllte Aktion soll über
 * Renderdurchläufe hinweg dieselbe bleiben.
 */
export function sicheresFormular<S extends {error: string | null}, A extends unknown[]>(
  aktion: (zustand: S, ...args: A) => Promise<S>,
): (zustand: S, ...args: A) => Promise<S> {
  return async (zustand: S, ...args: A) => {
    try {
      return await aktion(zustand, ...args);
    } catch (fehler) {
      notieren(fehler);
      return {...zustand, error: AKTION_FEHLGESCHLAGEN};
    }
  };
}
