import {getDb, type User} from './db';
import {hatRecht, rolleLabel} from './rechte';
import {istAvatar, type AvatarKey} from './avatar';
import {BUNDESLAENDER, isBundesland, type Bundesland} from './feiertage';
import {googleKonfiguriert} from './google';
import {getSetting} from './settings';
import {abbestellteAus, mussPasswortAendern, setzeAbbestellteArten} from './users';
import {ABWAEHLBARE_ARTEN, type MailArt} from './mail-arten';

export const STARTANSICHTEN = ['tag', 'woche', 'monat', 'konto'] as const;
export type Startansicht = (typeof STARTANSICHTEN)[number];

interface OnboardingRow {
  name: string;
  email: string;
  weekly_minutes: number;
  urlaubstage_jahr: number;
  profile_version: number;
  profile_accepted_version: number;
  onboarding_completed_at: string | null;
  preferred_view: Startansicht;
  attention_reminders: number;
  avatar_key: string;
  google_einrichtung_abgeschlossen: number;
  mail_abbestellt: string;
}

export interface PersoenlicheEinstellungen {
  startansicht: Startansicht;
  hinweiseZuOffenenTagen: boolean;
  avatar: AvatarKey;
  /**
   * Die abbestellten Nachrichtenarten. Gespeichert wird die Abwahl, nicht die
   * Wahl — das Formular dreht es für die Anzeige wieder um. Warum herum, steht
   * bei `abbestellteAus` in lib/users.ts.
   */
  mailAbbestellt: MailArt[];
}

export interface OnboardingProfil {
  name: string;
  email: string;
  rolle: string;
  wochenMinuten: number;
  urlaubstageJahr: number;
  bundesland: string | null;
  bundeslandQuelle: 'Mitarbeiter' | 'Unternehmen' | null;
  profilVersion: number;
  bestaetigteVersion: number;
  stammdatenFehler: string | null;
}

export interface EinrichtungsDaten {
  profil: OnboardingProfil;
  initial: PersoenlicheEinstellungen;
  passwortwechselNoetig: boolean;
  googleOauthNoetig: boolean;
  /** Ob GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET hinterlegt sind — sonst kann der Schritt nur erklären, was fehlt. */
  googleKonfiguriert: boolean;
  /** Die öffentliche Client-ID für den eingebetteten Google-Knopf (kein Geheimnis — sie steht in jeder Auth-URL). */
  googleClientId: string | null;
  /** Nur wenn MOCK_GOOGLE_OAUTH=1 gesetzt ist: der simulierte Verbinden-Knopf für Entwicklung ohne Zugangsdaten. */
  googleMock: boolean;
}

function rowFor(userId: number): OnboardingRow | null {
  return getDb()
    .query<OnboardingRow, [number]>(
      `SELECT name, email, weekly_minutes, urlaubstage_jahr,
              profile_version, profile_accepted_version, onboarding_completed_at,
              preferred_view, attention_reminders, avatar_key
              , google_einrichtung_abgeschlossen, mail_abbestellt
       FROM users WHERE id = ? AND active = 1`,
    )
    .get(userId);
}

export function istStartansicht(value: string): value is Startansicht {
  return (STARTANSICHTEN as readonly string[]).includes(value);
}

function stammdatenFehler(row: Pick<OnboardingRow, 'name' | 'email' | 'weekly_minutes' | 'urlaubstage_jahr'>): string | null {
  if (!row.name.trim()) return 'Der Name fehlt.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) return 'Die E-Mail-Adresse ist ungültig.';
  if (row.weekly_minutes < 60 || row.weekly_minutes > 60 * 60) return 'Die Wochen-Sollzeit ist ungültig.';
  if (!Number.isInteger(row.urlaubstage_jahr) || row.urlaubstage_jahr < 0 || row.urlaubstage_jahr > 365) {
    return 'Der Urlaubsanspruch ist ungültig.';
  }
  return null;
}

export function onboardingIstFertig(userId: number): boolean {
  const row = rowFor(userId);
  return Boolean(
    row &&
    !mussPasswortAendern(userId) &&
    row.google_einrichtung_abgeschlossen === 1 &&
    !stammdatenFehler(row) &&
    row.onboarding_completed_at &&
    row.profile_accepted_version === row.profile_version,
  );
}

export function einrichtungsDaten(user: User): EinrichtungsDaten {
  return {
    profil: onboardingProfil(user),
    initial: persoenlicheEinstellungen(user.id),
    passwortwechselNoetig: mussPasswortAendern(user.id),
    googleOauthNoetig: rowFor(user.id)?.google_einrichtung_abgeschlossen !== 1,
    googleKonfiguriert: googleKonfiguriert(),
    googleClientId: googleKonfiguriert() ? (process.env.GOOGLE_CLIENT_ID ?? null) : null,
    googleMock: process.env.MOCK_GOOGLE_OAUTH === '1',
  };
}

export function persoenlicheEinstellungen(userId: number): PersoenlicheEinstellungen {
  const row = rowFor(userId);
  return {
    startansicht: row?.preferred_view ?? 'tag',
    hinweiseZuOffenenTagen: row?.attention_reminders !== 0,
    avatar: row && istAvatar(row.avatar_key) ? row.avatar_key : 'vertrieb-akquise',
    mailAbbestellt: row ? abbestellteAus(row.mail_abbestellt) : [],
  };
}

export function onboardingProfil(user: User): OnboardingProfil {
  const row = rowFor(user.id);
  const firmenland = getSetting('bundesland');
  const eigenesLand = user.bundesland && isBundesland(user.bundesland) ? user.bundesland : null;
  const geerbtesLand = isBundesland(firmenland) ? firmenland : null;
  const land = (eigenesLand ?? geerbtesLand) as Bundesland | null;

  return {
    name: user.name,
    email: user.email,
    rolle: rolleLabel(user.role),
    wochenMinuten: user.weekly_minutes,
    urlaubstageJahr: user.urlaubstage_jahr,
    bundesland: land ? BUNDESLAENDER[land] : null,
    bundeslandQuelle: eigenesLand ? 'Mitarbeiter' : geerbtesLand ? 'Unternehmen' : null,
    profilVersion: row?.profile_version ?? 1,
    bestaetigteVersion: row?.profile_accepted_version ?? 0,
    stammdatenFehler: row ? stammdatenFehler(row) : 'Das Mitarbeiterkonto wurde nicht gefunden.',
  };
}

export function startPfad(userId: number): string {
  const {startansicht} = persoenlicheEinstellungen(userId);
  return startansicht === 'tag' ? '/' : `/?ansicht=${startansicht}`;
}

export function onboardingAbschliessen(
  userId: number,
  einstellungen: PersoenlicheEinstellungen,
): string | null {
  if (mussPasswortAendern(userId)) return 'Bitte ersetze zuerst dein Startpasswort.';
  if (rowFor(userId)?.google_einrichtung_abgeschlossen !== 1) return 'Bitte verbinde zuerst dein Google-Konto.';
  if (!istStartansicht(einstellungen.startansicht)) return 'Bitte eine gültige Startansicht wählen.';
  if (!istAvatar(einstellungen.avatar)) return 'Bitte eine gültige Profilfigur wählen.';
  const row = rowFor(userId);
  const fehler = row ? stammdatenFehler(row) : 'Das Mitarbeiterkonto wurde nicht gefunden.';
  if (fehler) return `${fehler} Bitte wende dich an die Verwaltung.`;
  const result = getDb()
    .query(
      `UPDATE users
       SET preferred_view = ?, attention_reminders = ?, avatar_key = ?,
           profile_accepted_version = profile_version,
           onboarding_completed_at = datetime('now')
       WHERE id = ? AND active = 1`,
    )
    .run(
      einstellungen.startansicht,
      einstellungen.hinweiseZuOffenenTagen ? 1 : 0,
      einstellungen.avatar,
      userId,
    );
  if (result.changes === 1) setzeAbbestellteArten(userId, einstellungen.mailAbbestellt);
  return result.changes === 1 ? null : 'Das Mitarbeiterkonto wurde nicht gefunden.';
}

/**
 * Setzt die Einrichtung einer Person zurück: beim nächsten Aufruf steht wieder
 * der Assistent — Stammdaten bestätigen, Profilfigur, Startansicht. Ein
 * bereits verbundenes Google-Konto bleibt verbunden und sein Schritt erledigt
 * (der Schritt beschafft eine Verknüpfung; ist sie da, gibt es nichts zu tun);
 * nur wer keine hat, etwa nach einer Trennung oder aus der Mock-Zeit,
 * durchläuft ihn erneut. Das Passwort bleibt unberührt — dafür gibt es die
 * eigene Zurücksetzung.
 */
export function einrichtungNeuStarten(actor: User, userId: number): string | null {
  if (!hatRecht(actor, 'mitarbeiter.verwalten')) return 'Keine Berechtigung.';
  const result = getDb()
    .query(
      `UPDATE users SET
         onboarding_completed_at = NULL,
         profile_accepted_version = 0,
         google_einrichtung_abgeschlossen = EXISTS (SELECT 1 FROM google_konten WHERE user_id = users.id)
       WHERE id = ? AND active = 1`,
    )
    .run(userId);
  return result.changes === 1 ? null : 'Das Mitarbeiterkonto wurde nicht gefunden.';
}

export function persoenlicheEinstellungenSpeichern(
  userId: number,
  einstellungen: PersoenlicheEinstellungen,
): string | null {
  if (!istStartansicht(einstellungen.startansicht)) return 'Bitte eine gültige Startansicht wählen.';
  if (!istAvatar(einstellungen.avatar)) return 'Bitte eine gültige Profilfigur wählen.';
  if (einstellungen.mailAbbestellt.some((art) => !ABWAEHLBARE_ARTEN.includes(art))) {
    return 'Diese Nachricht lässt sich nicht abbestellen.';
  }
  const result = getDb()
    .query('UPDATE users SET preferred_view = ?, attention_reminders = ?, avatar_key = ? WHERE id = ? AND active = 1')
    .run(
      einstellungen.startansicht,
      einstellungen.hinweiseZuOffenenTagen ? 1 : 0,
      einstellungen.avatar,
      userId,
    );
  if (result.changes === 1) setzeAbbestellteArten(userId, einstellungen.mailAbbestellt);
  return result.changes === 1 ? null : 'Das Mitarbeiterkonto wurde nicht gefunden.';
}
