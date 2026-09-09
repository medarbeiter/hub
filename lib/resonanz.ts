import {getDb} from './db';
import {hausZeit} from './format';
import {ereignisInfo} from './ziele';

/**
 * Resonanz: was **andere** zu einer Person gesagt haben — ein Kommentar auf
 * ihrer Karte oder eine Reaktion auf eines ihrer Timeline-Ereignisse. Zwei
 * Abnehmer, eine Frage: „was kam seit dem Zeitpunkt X?" — die Meldung unten
 * rechts fragt je Minute für die angemeldete Person, die Sammelmail einmal am
 * Tag je Konto (lib/erinnerungen.ts). Die eigene Stimme zählt nie mit.
 */
export interface Resonanz {
  art: 'kommentar' | 'reaktion';
  id: number;
  /** Wer — der Name, nie mehr. */
  von: string;
  /** Der Wortlaut des Kommentars bzw. das Emoji. */
  text: string;
  /** Bei einer Reaktion: die Überschrift des Ereignisses, auf das sie antwortet. */
  ereignis?: string;
}

/** Hauszeit als 'JJJJ-MM-TT HH:MM:SS' — das Format von profil_kommentare.erstellt_am. */
function hausStempel(d: Date): string {
  const z = hausZeit(d);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${z.datum} ${p(z.stunde)}:${p(z.minute)}:${p(z.sekunde)}`;
}

export function resonanzFuer(userId: number, seit: Date): Resonanz[] {
  const db = getDb();
  const kommentare = db
    .query<{id: number; text: string; von: string}, [number, number, string]>(
      `SELECT k.id, k.text, u.name AS von FROM profil_kommentare k JOIN users u ON u.id = k.autor_id
       WHERE k.person_id = ? AND k.autor_id <> ? AND k.erstellt_am > ? ORDER BY k.id`,
    )
    .all(userId, userId, hausStempel(seit))
    .map((k): Resonanz => ({art: 'kommentar', ...k}));
  // ponytail: Reaktionen seit `seit` für alle, Besitzer erst in JS — die Kennung trägt ihn, aber nicht SQL-lesbar für Ziele.
  const reaktionen: Resonanz[] = [];
  for (const r of db
    .query<{id: number; ereignis: string; art: string; von: string}, [number, string]>(
      `SELECT r.id, r.ereignis, r.art, u.name AS von FROM reaktionen r JOIN users u ON u.id = r.user_id
       WHERE r.user_id <> ? AND r.created_at > ? AND u.active = 1 ORDER BY r.id`,
    )
    .all(userId, seit.toISOString())) {
    const info = ereignisInfo(r.ereignis);
    if (info?.besitzer === userId) reaktionen.push({art: 'reaktion', id: r.id, von: r.von, text: r.art, ereignis: info.titel});
  }
  return [...kommentare, ...reaktionen];
}
