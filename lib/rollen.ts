/**
 * Die Rollen — der Datensatz (DB-gebunden).
 *
 * Eine Rolle ist eine Zeile in `rollen` (Migration 27): Schlüssel, deutsches
 * Etikett, Rechtebündel (kommagetrennt wie `users.mail_abbestellt`). Gepflegt
 * wird sie auf /mitarbeiter unter dem Recht `rollen.verwalten`. Drei Regeln
 * halten das missbrauchssicher:
 *
 * 1. **Nur eigene Rechte sind verhandelbar.** Wer eine Rolle bearbeitet, kann
 *    nur Rechte vergeben oder entfernen, die er selbst trägt — fremde Rechte
 *    bleiben unangetastet (`mischeRechte` in lib/rechte.ts). Damit kann ein
 *    eingeschränktes Konto mit `rollen.verwalten` sich nichts erschleichen.
 * 2. **Keine Selbstaussperrung.** Eine Änderung darf der handelnden Person
 *    weder `rollen.verwalten` noch `mitarbeiter.verwalten` nehmen — dieselbe
 *    Sperre wie in der Benutzerverwaltung. Zusammen mit Regel 1 heißt das
 *    auch: kein erlaubter Umbau lässt das Haus ohne ein aktives Konto mit
 *    diesen Rechten zurück, denn entfernen kann sie nur, wer sie selbst
 *    (und zwar nicht nur aus der bearbeiteten Rolle) weiter trägt.
 * 3. **Eine Rolle in Gebrauch ist unlöschbar.** Erst alle Konten umziehen,
 *    dann löschen — so entsteht nie ein Konto mit einer Rolle, die es nicht
 *    mehr gibt. Fällt doch einmal ein unbekannter Schlüssel an (alte Zeile,
 *    Import), zählen nur die Zusatzrechte: kein Bündel, kein Recht.
 */
import {getDb, type User} from './db';
import {
  RECHTE,
  STANDARD_ROLLEN_LABEL,
  hatRecht,
  istRecht,
  mischeRechte,
  vereinigeRechte,
  type Recht,
  type RollenEintrag,
} from './rechte';

function rechteAus(roh: string): Recht[] {
  return roh.split(',').map((s) => s.trim()).filter(istRecht);
}

interface RollenZeile {
  schluessel: string;
  label: string;
  rechte: string;
}

export function alleRollen(): RollenEintrag[] {
  return getDb()
    .query<RollenZeile, []>('SELECT schluessel, label, rechte FROM rollen ORDER BY label COLLATE NOCASE')
    .all()
    .map((z) => ({schluessel: z.schluessel, label: z.label, rechte: rechteAus(z.rechte)}));
}

export function rolleByKey(schluessel: string): RollenEintrag | null {
  const z = getDb()
    .query<RollenZeile, [string]>('SELECT schluessel, label, rechte FROM rollen WHERE schluessel = ?')
    .get(schluessel);
  return z ? {schluessel: z.schluessel, label: z.label, rechte: rechteAus(z.rechte)} : null;
}

export function istRolle(schluessel: string): boolean {
  return rolleByKey(schluessel) !== null;
}

/** Das Bündel einer Rolle; eine unbekannte (gelöschte) Rolle bündelt nichts. */
export function rechteDerRolle(schluessel: string): Recht[] {
  return rolleByKey(schluessel)?.rechte ?? [];
}

/** Deutsches Etikett; für Schlüssel ohne Datensatz (alte Protokollzeilen) der mitgelieferte Name, sonst der Schlüssel selbst. */
export function rolleLabel(schluessel: string): string {
  return rolleByKey(schluessel)?.label ?? STANDARD_ROLLEN_LABEL[schluessel] ?? schluessel;
}

/** Rollenbündel ∪ Zusatzrechte — was `getSessionUser()` an die Sitzung hängt. */
export function wirksameRechte(role: string, extra: readonly string[] = []): Recht[] {
  return vereinigeRechte(rechteDerRolle(role), extra);
}

/** Wie viele Konten (auch stillgelegte) die Rolle tragen — die Löschsperre zählt alle. */
export function kontenMitRolle(schluessel: string): number {
  const row = getDb()
    .query<{n: number}, [string]>('SELECT COUNT(*) AS n FROM users WHERE role = ?')
    .get(schluessel);
  return row?.n ?? 0;
}

/** Der Schlüssel aus dem Etikett — einmal vergeben, dann unveränderlich (users.role und das Protokoll zeigen auf ihn). */
export function rollenSchluessel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function extraRechteVon(userId: number): string[] {
  return getDb()
    .query<{recht: string}, [number]>('SELECT recht FROM benutzer_rechte WHERE user_id = ?')
    .all(userId)
    .map((r) => r.recht);
}

function pruefeLabel(label: string, ausserSchluessel?: string): string | null {
  const name = label.trim();
  if (!name) return 'Bitte einen Namen für die Rolle angeben.';
  if (name.length > 60) return 'Der Name ist zu lang (höchstens 60 Zeichen).';
  const doppelt = getDb()
    .query<{schluessel: string}, [string]>('SELECT schluessel FROM rollen WHERE label = ? COLLATE NOCASE')
    .get(name);
  if (doppelt && doppelt.schluessel !== ausserSchluessel) return 'Eine Rolle mit diesem Namen gibt es bereits.';
  return null;
}

export interface RollenEingabe {
  label: string;
  rechte: Recht[];
}

export function rolleAnlegen(actor: User, eingabe: RollenEingabe): {error: string} | {schluessel: string} {
  if (!hatRecht(actor, 'rollen.verwalten')) return {error: 'Keine Berechtigung.'};
  const invalid = pruefeLabel(eingabe.label);
  if (invalid) return {error: invalid};
  const schluessel = rollenSchluessel(eingabe.label);
  if (!schluessel) return {error: 'Der Name braucht mindestens einen Buchstaben oder eine Zahl.'};
  if (istRolle(schluessel)) return {error: 'Eine Rolle mit diesem Namen gibt es bereits.'};
  const rechte = mischeRechte([], eingabe.rechte, actor.rechte ?? []);
  getDb()
    .query('INSERT INTO rollen (schluessel, label, rechte) VALUES (?, ?, ?)')
    .run(schluessel, eingabe.label.trim(), rechte.join(','));
  return {schluessel};
}

export function rolleAendern(actor: User, schluessel: string, eingabe: RollenEingabe): string | null {
  if (!hatRecht(actor, 'rollen.verwalten')) return 'Keine Berechtigung.';
  const alt = rolleByKey(schluessel);
  if (!alt) return 'Diese Rolle gibt es nicht.';
  const invalid = pruefeLabel(eingabe.label, schluessel);
  if (invalid) return invalid;
  const neu = mischeRechte(alt.rechte, eingabe.rechte, actor.rechte ?? []);
  // Keine Selbstaussperrung: wer die eigene Rolle beschneidet, darf sich
  // dabei weder die Rollen- noch die Benutzerverwaltung nehmen (Regel 2 oben).
  if (actor.role === schluessel) {
    const extra = extraRechteVon(actor.id);
    const vorher = new Set(vereinigeRechte(alt.rechte, extra));
    const nachher = new Set(vereinigeRechte(neu, extra));
    for (const recht of ['rollen.verwalten', 'mitarbeiter.verwalten'] as const) {
      if (vorher.has(recht) && !nachher.has(recht)) {
        return `Du kannst dir nicht selbst das Recht „${RECHTE[recht].label}" entziehen.`;
      }
    }
  }
  getDb()
    .query('UPDATE rollen SET label = ?, rechte = ? WHERE schluessel = ?')
    .run(eingabe.label.trim(), neu.join(','), schluessel);
  return null;
}

export function rolleLoeschen(actor: User, schluessel: string): string | null {
  if (!hatRecht(actor, 'rollen.verwalten')) return 'Keine Berechtigung.';
  if (!istRolle(schluessel)) return 'Diese Rolle gibt es nicht.';
  const konten = kontenMitRolle(schluessel);
  if (konten > 0) {
    return konten === 1
      ? 'Diese Rolle ist noch einem Konto zugewiesen. Bitte zuerst eine andere Rolle zuweisen.'
      : `Diese Rolle ist noch ${konten} Konten zugewiesen. Bitte zuerst eine andere Rolle zuweisen.`;
  }
  const db = getDb();
  const gesamt = db.query<{n: number}, []>('SELECT COUNT(*) AS n FROM rollen').get()?.n ?? 0;
  if (gesamt <= 1) return 'Die letzte Rolle kann nicht gelöscht werden.';
  db.query('DELETE FROM rollen WHERE schluessel = ?').run(schluessel);
  // Der Leserkreis eines Zugangscodes zeigt sonst auf einen toten Schlüssel.
  db.query('DELETE FROM totp_konto_rollen WHERE rolle = ?').run(schluessel);
  return null;
}
