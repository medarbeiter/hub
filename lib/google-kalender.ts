// Der Kalender-Abgleich — was das verbundene Google-Konto zu sehen bekommt.
//
// Kein Ereignis wird einzeln nachgeführt. Nach jeder Änderung an Abwesenheiten
// wird der ganze Bestand einer Person abgeglichen: Soll sind die wirksamen
// Spannen (gemeldet oder genehmigt), Ist ist die Zuordnungstabelle
// google_kalender_eintraege. Der Grund ist §9 BUrlG — `paragraf9Anwenden`
// löscht Urlaubszeilen und legt neue an, und eine Fortschreibung je Zeile
// liefe dabei unweigerlich auseinander, genau wie es die Projektion auf
// day_types täte (deshalb baut auch `neuProjizieren` stets neu).
//
// Zwei Regeln tragen den Rest:
//
//   1. **Der Abgleich bricht nie eine Buchung.** `syncGoogleAbwesenheiten`
//      wirft nicht — dieselbe Haltung wie `protokolliere()`: ein Kalender, der
//      eine Krankmeldung verhindert, richtet mehr Schaden an als ein fehlendes
//      Ereignis. Scheitert Google, steht es in der Konsole und der nächste
//      Abgleich holt es nach (der Fingerabdruck `stand` weiß, was fehlt).
//   2. **Krank verlässt das Haus nur als „Abwesend".** Der Titel einer
//      Krankmeldung im Google-Kalender nennt die Art nicht — sonst läge eine
//      Gesundheitsangabe nach Art. 9 DSGVO auf fremden Servern. Dieselbe
//      Abstufung, mit der der Teamkalender Kolleginnen nur das „dass" zeigt.
//      Das gilt für die Beschreibung genauso wie für den Titel: jede andere Art
//      trägt ihre Notiz mit hinüber, Krank trägt nichts (`ereignisBeschreibung`).

import {type Abwesenheit, getDb} from './db';
import {ausserHausLabel, istWirksam} from './abwesenheit-arten';
import {frischesAccessToken, googleKontoFuer} from './google';

const EREIGNIS_BASIS = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

export interface KalenderEreignis {
  summary: string;
  description: string;
  start: {date: string};
  end: {date: string};
  transparency: 'opaque';
  /** Eine Abwesenheit braucht keinen Wecker um acht — die Standard-Erinnerung bleibt aus. */
  reminders: {useDefault: false; overrides: []};
  colorId: string;
  extendedProperties: {private: {medarbeiterAbwesenheit: string}};
}

function tagNach(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Googles feste Farbpalette, je Art eine: Urlaub trägt das Hausgold (Banana),
 * Krank bewusst das stumme Graphit — eine Farbe, die nichts verrät, zum Titel,
 * der nichts verrät.
 */
const EREIGNIS_FARBE: Record<Abwesenheit['art'], string> = {
  urlaub: '5',
  freizeitausgleich: '7',
  fortbildung: '9',
  krank: '8',
};

/**
 * Der Titel, den die Abwesenheit drüben trägt — Krank bewusst nur als
 * „Abwesend". Die Regel selbst steht in `ausserHausLabel`, weil sie auch für
 * den E-Mail-Versand gilt und es sie nur einmal geben darf.
 */
export function ereignisTitel(art: Abwesenheit['art'], name: string): string {
  return `${ausserHausLabel(art)} – ${name}`;
}

/** Was die Abwesenheit über sich selbst sagt — ohne den Herkunftshinweis. */
type EreignisQuelle = Pick<Abwesenheit, 'art' | 'von' | 'bis' | 'notiz' | 'minuten'>;

const HERKUNFT =
  'Automatisch übertragen aus dem MedArbeiter Hub. Änderungen bitte dort vornehmen – der nächste Abgleich stellt diesen Stand wieder her.';

/**
 * Der Text unter dem Ereignis: was die Person selbst zur Abwesenheit notiert
 * hat, und bei einem Teiltag der Umfang — ein ganztägiges Ereignis für 90
 * Minuten Freizeitausgleich wäre drüben sonst nicht von einem ganzen Tag zu
 * unterscheiden. Der Herkunftshinweis bleibt am Ende stehen.
 *
 * Bei Krank steht hier ausdrücklich nichts. Der Datensatz führt dort schon kein
 * Notizfeld (`notizFuer` in lib/abwesenheit.ts erzwingt NULL), aber dies ist
 * die Stelle, an der Daten das Haus verlassen — und eine von Hand gesetzte
 * Zeile darf hier keine Gesundheitsangabe nach Art. 9 DSGVO auf fremde Server
 * tragen. Dieselbe Abstufung wie beim Titel: das „dass", nie das „warum".
 */
export function ereignisBeschreibung(a: EreignisQuelle): string {
  if (a.art === 'krank') return HERKUNFT;
  const zeilen = [
    a.notiz?.trim() || null,
    a.minuten != null ? `Umfang: ${a.minuten} Minuten (Teiltag).` : null,
    HERKUNFT,
  ];
  return zeilen.filter(Boolean).join('\n\n');
}

/**
 * Ganztägige Ereignisse; das Ende ist bei Google exklusiv, also der Tag nach
 * dem letzten. Die Abwesenheits-ID steht als private Eigenschaft am Ereignis,
 * damit es auch drüben als unseres erkennbar bleibt.
 */
export function ereignisFuer(a: EreignisQuelle & Pick<Abwesenheit, 'id'>, name: string): KalenderEreignis {
  return {
    summary: ereignisTitel(a.art, name),
    description: ereignisBeschreibung(a),
    start: {date: a.von},
    end: {date: tagNach(a.bis)},
    transparency: 'opaque',
    reminders: {useDefault: false, overrides: []},
    colorId: EREIGNIS_FARBE[a.art],
    extendedProperties: {private: {medarbeiterAbwesenheit: String(a.id)}},
  };
}

/**
 * Der Fingerabdruck des Geschriebenen — weicht er ab, wird die API angefragt.
 * Name und Farbe stehen mit darin: ändert sich die Darstellung (oder wird eine
 * Person umbenannt), holt der nächste Abgleich jedes Ereignis von selbst auf
 * den neuen Stand. Die Beschreibung gehört mit dazu, seit sie die Notiz trägt:
 * sonst bliebe eine geänderte Notiz drüben für immer die alte.
 */
export function ereignisStand(a: EreignisQuelle, name: string): string {
  return `${ereignisTitel(a.art, name)}|${a.von}|${a.bis}|${EREIGNIS_FARBE[a.art]}|${ereignisBeschreibung(a)}`;
}

async function googleAufruf(token: string, pfad: string, methode: string, body?: KalenderEreignis): Promise<Response> {
  return fetch(`${EREIGNIS_BASIS}${pfad}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? {'Content-Type': 'application/json'} : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Gleicht den Google-Kalender einer Person mit ihren wirksamen Abwesenheiten
 * ab. Ohne verbundenes Konto ein No-op; ohne Abweichung kein einziger
 * API-Aufruf. Wirft nie — siehe Kopfkommentar.
 */
export async function syncGoogleAbwesenheiten(userId: number): Promise<void> {
  try {
    if (!googleKontoFuer(userId)) return;
    const db = getDb();
    const name = db.query<{name: string}, [number]>('SELECT name FROM users WHERE id = ?').get(userId)?.name;
    if (!name) return;
    const wirksame = db
      .query<Abwesenheit, [number]>('SELECT * FROM abwesenheiten WHERE user_id = ?')
      .all(userId)
      .filter((a) => istWirksam(a.status));
    const eintraege = db
      .query<{abwesenheit_id: number; event_id: string; stand: string}, [number]>(
        'SELECT abwesenheit_id, event_id, stand FROM google_kalender_eintraege WHERE user_id = ?',
      )
      .all(userId);
    const soll = new Map(wirksame.map((a) => [a.id, a]));
    const ist = new Map(eintraege.map((e) => [e.abwesenheit_id, e]));

    // Das Token erst holen, wenn wirklich etwas zu tun ist — der häufigste
    // Abgleich stellt fest, dass nichts abweicht, und soll nichts kosten.
    let token: string | null | undefined;
    const holeToken = async () => (token === undefined ? (token = await frischesAccessToken(userId)) : token);

    for (const eintrag of eintraege) {
      if (soll.has(eintrag.abwesenheit_id)) continue;
      const t = await holeToken();
      if (!t) return;
      const antwort = await googleAufruf(t, `/${encodeURIComponent(eintrag.event_id)}`, 'DELETE');
      // 404/410: drüben schon weg — das Ziel ist erreicht, die Zuordnung kann gehen.
      if (!antwort.ok && antwort.status !== 404 && antwort.status !== 410) {
        console.error('Google-Ereignis nicht gelöscht:', antwort.status, await antwort.text());
        continue;
      }
      db.query('DELETE FROM google_kalender_eintraege WHERE abwesenheit_id = ?').run(eintrag.abwesenheit_id);
    }

    for (const a of wirksame) {
      const vorhanden = ist.get(a.id);
      const stand = ereignisStand(a, name);
      if (vorhanden?.stand === stand) continue;
      const t = await holeToken();
      if (!t) return;
      if (vorhanden) {
        const antwort = await googleAufruf(t, `/${encodeURIComponent(vorhanden.event_id)}`, 'PATCH', ereignisFuer(a, name));
        if (antwort.status === 404 || antwort.status === 410) {
          // Von Hand drüben gelöscht — die Zuordnung ist Geschichte, neu anlegen.
          db.query('DELETE FROM google_kalender_eintraege WHERE abwesenheit_id = ?').run(a.id);
          ist.delete(a.id);
          await legeEreignisAn(db, t, a, name, stand);
          continue;
        }
        if (!antwort.ok) {
          console.error('Google-Ereignis nicht geändert:', antwort.status, await antwort.text());
          continue;
        }
        db.query('UPDATE google_kalender_eintraege SET stand = ?, updated_at = datetime(\'now\') WHERE abwesenheit_id = ?')
          .run(stand, a.id);
      } else {
        await legeEreignisAn(db, t, a, name, stand);
      }
    }
  } catch (fehler) {
    console.error('Google-Kalender-Abgleich fehlgeschlagen:', fehler);
  }
}

async function legeEreignisAn(
  db: ReturnType<typeof getDb>,
  token: string,
  a: Abwesenheit,
  name: string,
  stand: string,
): Promise<void> {
  const antwort = await googleAufruf(token, '', 'POST', ereignisFuer(a, name));
  if (!antwort.ok) {
    console.error('Google-Ereignis nicht angelegt:', antwort.status, await antwort.text());
    return;
  }
  const daten = (await antwort.json()) as {id?: string};
  if (!daten.id) return;
  db.query(
    `INSERT INTO google_kalender_eintraege (abwesenheit_id, user_id, event_id, stand)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(abwesenheit_id) DO UPDATE SET event_id = excluded.event_id, stand = excluded.stand,
       updated_at = datetime('now')`,
  ).run(a.id, a.user_id, daten.id, stand);
}

/**
 * Vor dem Trennen: alles, was diese Anwendung angelegt hat, wird drüben
 * abgeräumt. Nach bestem Bemühen — ein nicht erreichbares Ereignis hält die
 * Trennung nicht auf, die Zuordnung räumt `trenneGoogleKonto` ohnehin ab.
 */
export async function loescheAlleGoogleEreignisse(userId: number): Promise<void> {
  try {
    const token = await frischesAccessToken(userId);
    if (!token) return;
    const eintraege = getDb()
      .query<{event_id: string}, [number]>('SELECT event_id FROM google_kalender_eintraege WHERE user_id = ?')
      .all(userId);
    for (const eintrag of eintraege) {
      await googleAufruf(token, `/${encodeURIComponent(eintrag.event_id)}`, 'DELETE');
    }
  } catch (fehler) {
    console.error('Google-Ereignisse nicht abgeräumt:', fehler);
  }
}
