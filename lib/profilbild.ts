// Das eigene Profilbild — die Datei und ihre Ablage. DB- und
// dateisystemgebunden, deshalb getrennt von `lib/avatar.ts`: dort steht die
// Bildbogen-Vokabel, die auch der Browser importieren darf.
//
// Gebaut wie `speichereAuDatei` und `speichereBelegDatei`, aus denselben
// Gründen: die Datei liegt außerhalb von public/, ihr Name kommt nie vom
// Client, und die Endung stammt aus einer Allowlist statt aus dem, was der
// Browser beim Hochladen behauptet.
//
// Ein Unterschied zu jenen beiden: ein Profilbild ist keine Urkunde. Es wird
// von jedem angemeldeten Konto abgerufen (die Seitenleiste, die Teamblätter),
// nicht nur von der Verwaltung und der betroffenen Person — deshalb entscheidet
// `app/api/avatar/[userId]` anders als `app/api/au/[id]`.

import {mkdirSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {AVATAR_MAX_BYTES, AVATAR_TYPEN} from './avatar';
import {getDb, type User} from './db';

function avatarWurzel(): string {
  return join(process.cwd(), 'data', 'avatare');
}

/** Absoluter Pfad — nur für den Auslieferungs-Handler. */
export function avatarDateiPfad(datei: string): string {
  return join(avatarWurzel(), datei);
}

export async function speichereAvatarDatei(file: File): Promise<{datei: string; typ: string} | string> {
  const endung = AVATAR_TYPEN[file.type];
  if (!endung) return 'Erlaubt sind JPG, PNG und WEBP.';
  if (file.size > AVATAR_MAX_BYTES) return 'Das Bild darf höchstens 5 MB groß sein.';
  if (file.size === 0) return 'Die Datei ist leer.';
  mkdirSync(avatarWurzel(), {recursive: true});
  const datei = `${crypto.randomUUID()}.${endung}`;
  await Bun.write(avatarDateiPfad(datei), file);
  return {datei, typ: file.type};
}

function loescheAvatarDatei(datei: string | null | undefined): void {
  if (!datei) return;
  try {
    rmSync(avatarDateiPfad(datei), {force: true});
  } catch {
    // absichtlich still — eine fehlende Datei hält das Ersetzen nicht auf
  }
}

/**
 * Setzt oder entfernt das eigene Profilbild. `null` räumt die Datei ab und
 * lässt die Tierfigur zurück — deshalb kann ein Konto nie ohne Zeichen
 * dastehen. Das alte Bild wird in beiden Fällen gelöscht: eine verwaiste Datei
 * wäre ein Personenbezug, den niemand mehr sieht und niemand mehr aufräumt.
 */
export function setzeProfilbild(userId: number, datei: {datei: string; typ: string} | null): void {
  const db = getDb();
  const alt = db
    .query<{avatar_datei: string | null}, [number]>('SELECT avatar_datei FROM users WHERE id = ?')
    .get(userId);
  loescheAvatarDatei(alt?.avatar_datei);
  db.query('UPDATE users SET avatar_datei = ?, avatar_datei_typ = ? WHERE id = ?').run(
    datei?.datei ?? null,
    datei?.typ ?? null,
    userId,
  );
}

export function profilbildVon(userId: number): Pick<User, 'avatar_datei' | 'avatar_datei_typ'> | null {
  return (
    getDb()
      .query<
        Pick<User, 'avatar_datei' | 'avatar_datei_typ'>,
        [number]
      >('SELECT avatar_datei, avatar_datei_typ FROM users WHERE id = ? AND active = 1')
      .get(userId) ?? null
  );
}
