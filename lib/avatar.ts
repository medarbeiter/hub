export const AVATAR_KEYS = [
  'vertrieb-akquise',
  'marketing',
  'geschaeftsfuehrer',
  'mercedes-amg-c-eo',
  'key-account-management',
  'pflegedienst',
  'krankenhaus',
  'headset-calling',
  'adler',
  'buchhaltung-controlling',
] as const;

export type AvatarKey = (typeof AVATAR_KEYS)[number];

export const AVATARE: ReadonlyArray<{key: AvatarKey; label: string; bild: string}> = [
  {key: 'vertrieb-akquise', label: 'Vertrieb & Akquise', bild: '/avatare/01-vertrieb-akquise-fuchs.png'},
  {key: 'marketing', label: 'Marketing', bild: '/avatare/02-marketing-pfau.png'},
  {key: 'geschaeftsfuehrer', label: 'Geschäftsführer', bild: '/avatare/03-geschaeftsfuehrer-loewe.png'},
  {key: 'mercedes-amg-c-eo', label: 'Mercedes AMG · C EO', bild: '/avatare/04-mercedes-amg-c-eo-panther.png'},
  {key: 'key-account-management', label: 'Key Account Management', bild: '/avatare/05-key-account-oktopus.png'},
  {key: 'pflegedienst', label: 'Pflegedienst', bild: '/avatare/06-pflegedienst-capybara.png'},
  {key: 'krankenhaus', label: 'Krankenhaus', bild: '/avatare/07-krankenhaus-pinguin.png'},
  {key: 'headset-calling', label: 'Headset & Calling', bild: '/avatare/08-headset-calling-papagei.png'},
  {key: 'adler', label: 'Adler', bild: '/avatare/09-adler.png'},
  {key: 'buchhaltung-controlling', label: 'Buchhaltung & Controlling', bild: '/avatare/10-buchhaltung-controlling-eule.png'},
];

export function istAvatar(value: string): value is AvatarKey {
  return (AVATAR_KEYS as readonly string[]).includes(value);
}

export function avatarLabel(key: AvatarKey): string {
  return AVATARE.find((avatar) => avatar.key === key)?.label ?? 'Vertrieb & Akquise';
}

export function avatarBild(key: AvatarKey): string {
  return AVATARE.find((avatar) => avatar.key === key)?.bild ?? AVATARE[0]!.bild;
}

/**
 * Was als eigenes Profilbild hochgeladen werden darf. Nur Rasterbilder — kein
 * SVG: eine Vektordatei kann Skripte tragen, und ein Profilbild wird von jedem
 * angemeldeten Konto abgerufen. Kein PDF, anders als beim Beleg: hier wird ein
 * Bild angezeigt, kein Dokument geöffnet.
 */
export const AVATAR_TYPEN: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * Die Quelle des Profilbildes: das eigene Foto, sonst die Tierfigur.
 *
 * Die Adresse trägt die Datei mit. Sie ist je Konto sonst immer dieselbe, und
 * das Bild darf zwischengespeichert werden (api/avatar) — ohne diese Kennung
 * zeigten Seitenleiste, Teamblatt, Prüfzeile und Personenkarte nach einem
 * Wechsel noch minutenlang das alte Bild, in jedem Browser im Haus. Der
 * Dateiname ist eine UUID und wird bei jedem Ersetzen neu vergeben; er *ist*
 * damit die Version. Der Handler liest ihn nicht — der Pfad kommt weiterhin
 * aus der Datenbank.
 */
export function avatarQuelle(user: {id: number; avatar_key?: AvatarKey; avatar_datei?: string | null}): string {
  return user.avatar_datei
    ? `/api/avatar/${user.id}?v=${user.avatar_datei.slice(0, 8)}`
    : avatarBild(user.avatar_key ?? AVATARE[0]!.key);
}

/**
 * Eine Person, so wie sie überall in der Anwendung gezeigt wird: eine Kennung,
 * ein Name und eine fertige Bildquelle.
 *
 * Der Grund für die fertige Quelle: die Regel „eigenes Foto, sonst Tierfigur"
 * ist genau eine Regel, und sie gehört auf den Server. Der Browser bekommt eine
 * URL und entscheidet nichts mehr — sonst müsste jede Zeile jeder Liste
 * `avatar_key` und `avatar_datei` mitschleppen und die Regel erneut anwenden.
 */
export interface PersonAngabe {
  id: number;
  name: string;
  /** Fertige Bildquelle — Foto oder Tierfigur, hier schon entschieden. */
  bild: string;
  /**
   * Die Rolle als fertiges deutsches Wort — der Server hat den Schlüssel
   * schon über lib/rollen.ts aufgelöst (die Bündel sind Datensätze, der
   * Browser kann sie nicht übersetzen). Nur für die Personenkarte gedacht.
   */
  rolle?: string;
  /**
   * Die dienstliche Adresse — dieselbe, die im Haus ohnehin auf jedem
   * Verteiler steht. Bewusst **nichts** darüber hinaus: Wochenstunden,
   * Urlaubstage und Zeitkonto sind Vertragsdaten und stehen nur dort, wo die
   * Seite ohnehin schon dafür berechtigt ist (/team, /mitarbeiter).
   */
  email?: string;
}

/**
 * Die eine Stelle, an der eine Benutzerzeile zur Personenangabe wird.
 *
 * Die Adresse kommt mit, wenn die Zeile sie trägt; die Rolle setzt nur, wer
 * ihr Etikett kennt (`personAngabeById` in lib/users.ts) — hier läge sonst
 * der rohe Schlüssel. Wo beides fehlt, holt die Personenkarte es beim Öffnen
 * über `/api/person/<id>` nach; es ist eine Zugabe, keine Voraussetzung.
 */
export function personAngabe(user: {
  id: number;
  name: string;
  email?: string;
  avatar_key?: AvatarKey;
  avatar_datei?: string | null;
}): PersonAngabe {
  return {
    id: user.id,
    name: user.name,
    bild: avatarQuelle(user),
    ...(user.email ? {email: user.email} : {}),
  };
}
