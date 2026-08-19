// Die Notizen an einer Personenkarte (DB-gebunden).
//
// Was hier steht, ist kein Datensatz *über* jemanden, sondern eine Äußerung
// *von* jemandem — deshalb trägt jede Zeile ihren Autor sichtbar mit, und
// deshalb ist Löschen keine Verwaltungshandlung, sondern das Zurücknehmen
// eines Wortes. Wer darf: wer es geschrieben hat, wer es abbekommen hat, und
// wer Konten verwaltet (`darfKommentarLoeschen`). Die Person, um die es geht,
// ist ausdrücklich dabei — es ist ihre Karte, und niemand muss sich melden,
// um eine Notiz an der eigenen loszuwerden.
//
// Der Text bleibt schlicht: eine Zeichenkette, keine Formatierung, keine
// Erwähnungen, keine Antworten. Ein Zeiterfassungssystem bekommt hier keinen
// Nachrichtendienst eingebaut.

import {personAngabe, type AvatarKey, type PersonAngabe} from './avatar';
import {getDb, type User} from './db';
import {fmtDate, hausZeit} from './format';
import {hatRecht} from './rechte';

export const KOMMENTAR_MAX_ZEICHEN = 500;

export interface ProfilKommentar {
  id: number;
  /** Wer geschrieben hat — `null`, wenn das Konto inzwischen fort ist. */
  autor: PersonAngabe | null;
  autorName: string;
  text: string;
  /** „19.8.2026, 14:32 Uhr" — fertig formatiert, die Karte rechnet nicht. */
  zeit: string;
  /** Darf der abrufende Mensch diese Zeile entfernen? */
  darfLoeschen: boolean;
}

type Zeile = {
  id: number;
  person_id: number;
  autor_id: number;
  text: string;
  erstellt_am: string;
  autor_name: string | null;
  autor_key: AvatarKey | null;
  autor_datei: string | null;
};

/** Hauszeit als „JJJJ-MM-TT HH:MM:SS" — dieselbe Schreibweise wie im Protokoll. */
function jetztStempel(): string {
  const {datum, stunde, minute, sekunde} = hausZeit();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${datum} ${p(stunde)}:${p(minute)}:${p(sekunde)}`;
}

function lesbar(stempel: string): string {
  const [datum, uhr] = stempel.split(' ');
  return `${fmtDate(datum ?? '')}, ${(uhr ?? '').slice(0, 5)} Uhr`;
}

/**
 * Wer eine Notiz wieder entfernen darf: ihr Autor, die Person, an deren Karte
 * sie hängt, und wer Konten verwaltet. Eine eigene Rechte-Vokabel braucht das
 * nicht — `mitarbeiter.verwalten` ist bereits das Recht, das über fremde
 * Konten entscheidet, und die beiden anderen Fälle sind kein Zugriff auf
 * Fremdes, sondern auf das eigene Wort und die eigene Karte.
 */
export function darfKommentarLoeschen(
  user: Pick<User, 'id' | 'role'> & {rechte?: readonly string[]},
  kommentar: {autor_id: number; person_id: number},
): boolean {
  return (
    kommentar.autor_id === user.id ||
    kommentar.person_id === user.id ||
    hatRecht(user, 'mitarbeiter.verwalten')
  );
}

export function kommentareFuer(
  personId: number,
  leser: Pick<User, 'id' | 'role'> & {rechte?: readonly string[]},
): ProfilKommentar[] {
  const rows = getDb()
    .query<Zeile, [number]>(
      `SELECT k.id, k.person_id, k.autor_id, k.text, k.erstellt_am,
              u.name AS autor_name, u.avatar_key AS autor_key, u.avatar_datei AS autor_datei
         FROM profil_kommentare k
         LEFT JOIN users u ON u.id = k.autor_id
        WHERE k.person_id = ?
        ORDER BY k.id DESC`,
    )
    .all(personId);

  return rows.map((r) => ({
    id: r.id,
    autor: r.autor_name
      ? personAngabe({
          id: r.autor_id,
          name: r.autor_name,
          avatar_key: r.autor_key ?? undefined,
          avatar_datei: r.autor_datei,
        })
      : null,
    autorName: r.autor_name ?? 'Ehemaliges Konto',
    text: r.text,
    zeit: lesbar(r.erstellt_am),
    darfLoeschen: darfKommentarLoeschen(leser, r),
  }));
}

/** Legt die Notiz an und gibt ihre Kennung zurück; `string` ist eine Absage. */
export function schreibeKommentar(personId: number, autorId: number, text: string): number | string {
  const sauber = text.trim();
  if (!sauber) return 'Bitte einen Kommentar eingeben.';
  if (sauber.length > KOMMENTAR_MAX_ZEICHEN) {
    return `Ein Kommentar darf höchstens ${KOMMENTAR_MAX_ZEICHEN} Zeichen lang sein.`;
  }
  const db = getDb();
  const ziel = db
    .query<{id: number}, [number]>('SELECT id FROM users WHERE id = ? AND active = 1')
    .get(personId);
  if (!ziel) return 'Diese Person gibt es nicht.';
  db.query('INSERT INTO profil_kommentare (person_id, autor_id, text, erstellt_am) VALUES (?, ?, ?, ?)').run(
    personId,
    autorId,
    sauber,
    jetztStempel(),
  );
  return db.query<{id: number}, []>('SELECT last_insert_rowid() AS id').get()!.id;
}

/** Die rohe Zeile — für die Rechteprüfung und den Protokolleintrag vor dem Löschen. */
export function kommentarById(
  id: number,
): {id: number; person_id: number; autor_id: number; text: string; person_name: string} | null {
  return (
    getDb()
      .query<{id: number; person_id: number; autor_id: number; text: string; person_name: string}, [number]>(
        `SELECT k.id, k.person_id, k.autor_id, k.text, u.name AS person_name
           FROM profil_kommentare k
           JOIN users u ON u.id = k.person_id
          WHERE k.id = ?`,
      )
      .get(id) ?? null
  );
}

export function loescheKommentar(id: number): void {
  getDb().query('DELETE FROM profil_kommentare WHERE id = ?').run(id);
}
