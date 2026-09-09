import {getDb} from './db';
import {hausZeit} from './format';

/**
 * ClickUp als Quelle für Timeline — erledigte Aufgaben.
 *
 * Der Schlüssel (`CLICKUP_API_KEY`) verlässt den Server nie: die Seite ruft
 * `clickupAktualisieren()` und liest danach synchron aus einem Zwischenstand,
 * der höchstens alle fünf Minuten erneuert wird — so bleibt `evaluate()` in
 * lib/ziele.ts eine reine Rechnung ohne Netz. Personen werden über die
 * E-Mail-Adresse zugeordnet; ein ClickUp-Mitglied ohne Hub-Konto erscheint nicht.
 * Wie der Kalender und die Post: ein ClickUp-Ausfall bricht nie eine Seite.
 */
export interface ClickupAufgabe {
  id: string; name: string; liste: string | null;
  erledigt: string; erledigtMoment: string;
  emails: string[]; url: string;
}
/** Gebuchte Zeit einer Person an einem Haus-Tag, in Minuten. */
export interface ClickupZeit { email: string; datum: string; minuten: number }
interface Stand { aufgaben: ClickupAufgabe[]; zeit: ClickupZeit[]; geladen: number }

const API = 'https://api.clickup.com/api/v2';
const TAKT_MS = 5 * 60 * 1000;
/** So weit reicht der Blick zurück — ein Ziel, das früher begann, zählt nur, was in dieser Spanne liegt. */
export const RUECKBLICK_TAGE = 120;
let stand: Stand = {aufgaben: [], zeit: [], geladen: 0};

export function clickupKonfiguriert(): boolean {
  return Boolean(process.env.CLICKUP_API_KEY);
}

function moment(ms: unknown): {datum: string; moment: string} | null {
  const zahl = Number(ms);
  if (!Number.isFinite(zahl) || zahl <= 0) return null;
  const z = hausZeit(new Date(zahl));
  const p = (n: number) => String(n).padStart(2, '0');
  return {datum: z.datum, moment: `${z.datum}T${p(z.stunde)}:${p(z.minute)}:${p(z.sekunde)}.000`};
}
function emailsAus(personen: unknown): string[] {
  return Array.isArray(personen) ? personen.map((p) => (typeof p?.email === 'string' ? p.email.toLowerCase() : '')).filter(Boolean) : [];
}

/** Reine Übersetzung einer Seite von GET /team/{id}/task — nur Erledigtes mit Datum. */
export function aufgabenAus(antwort: any): ClickupAufgabe[] {
  const aufgaben: ClickupAufgabe[] = [];
  for (const t of antwort?.tasks ?? []) {
    const m = moment(t?.date_done ?? t?.date_closed);
    if (typeof t?.id !== 'string' || typeof t?.name !== 'string' || !m) continue;
    aufgaben.push({
      id: t.id, name: t.name, liste: typeof t.list?.name === 'string' ? t.list.name : null,
      erledigt: m.datum, erledigtMoment: m.moment, emails: emailsAus(t.assignees),
      url: typeof t.url === 'string' ? t.url : `https://app.clickup.com/t/${t.id}`,
    });
  }
  return aufgaben;
}

/** Reine Übersetzung von GET /team/{id}/time_entries: je Person und Tag summiert; laufende Einträge (negative Dauer) zählen nicht. */
export function zeitAus(antwort: any): ClickupZeit[] {
  const summen = new Map<string, ClickupZeit>();
  for (const e of antwort?.data ?? []) {
    const email = typeof e?.user?.email === 'string' ? e.user.email.toLowerCase() : '';
    const dauer = Number(e?.duration);
    const m = moment(e?.start);
    if (!email || !m || !Number.isFinite(dauer) || dauer <= 0) continue;
    const key = `${email}|${m.datum}`;
    const z = summen.get(key) ?? {email, datum: m.datum, minuten: 0};
    z.minuten += Math.round(dauer / 60_000);
    summen.set(key, z);
  }
  return [...summen.values()];
}

async function hole<T>(pfad: string): Promise<T> {
  const antwort = await fetch(`${API}${pfad}`, {headers: {Authorization: process.env.CLICKUP_API_KEY!}, signal: AbortSignal.timeout(8000)});
  if (!antwort.ok) throw new Error(`ClickUp antwortet ${antwort.status} auf ${pfad}`);
  return (await antwort.json()) as T;
}

/**
 * Holt die erledigten Aufgaben, höchstens alle fünf Minuten. Wirft nie —
 * ein alter Stand ist besser als eine kaputte Seite, und ein Fehler bremst
 * genauso wie ein Erfolg, damit ein toter Dienst nicht jede Anfrage aufhält.
 */
export async function clickupAktualisieren(jetzt = Date.now()): Promise<void> {
  if (!clickupKonfiguriert() || jetzt - stand.geladen < TAKT_MS) return;
  stand.geladen = jetzt;
  try {
    const teams = (await hole<{teams?: {id: string; members?: {user?: {id?: number}}[]}[]}>('/team')).teams ?? [];
    const team = process.env.CLICKUP_TEAM_ID ? teams.find((t) => t.id === process.env.CLICKUP_TEAM_ID) : teams[0];
    if (!team) return;
    const teamId = team.id;
    const aufgaben: ClickupAufgabe[] = [];
    // ponytail: zwanzig Seiten à 100 sind die Decke; wer mehr in 120 Tagen erledigt, sieht die ältesten nicht.
    for (let seite = 0; seite < 20; seite++) {
      const antwort = await hole<{tasks?: unknown[]; last_page?: boolean}>(`/team/${teamId}/task?include_closed=true&subtasks=true&order_by=updated&date_done_gt=${jetzt - RUECKBLICK_TAGE * 86_400_000}&page=${seite}`);
      aufgaben.push(...aufgabenAus(antwort));
      if (antwort.last_page !== false) break;
    }
    // Ohne `assignee` liefert ClickUp nur die Zeit des Schlüsselinhabers — also alle Mitglieder benennen.
    const mitglieder = (team.members ?? []).map((m) => m.user?.id).filter((id): id is number => Number.isInteger(id));
    const zeit = zeitAus(await hole(`/team/${teamId}/time_entries?start_date=${jetzt - RUECKBLICK_TAGE * 86_400_000}&end_date=${jetzt}&assignee=${mitglieder.join(',')}`));
    stand = {aufgaben, zeit, geladen: jetzt};
  } catch (fehler) {
    console.error('[MedArbeiter] ClickUp nicht erreichbar:', fehler);
  }
}

/** Erledigte Aufgaben einer Person je Tag (Hauszeit), über die E-Mail zugeordnet. */
export function aufgabenJeTag(email: string): Map<string, number> {
  const mail = email.toLowerCase();
  const zaehler = new Map<string, number>();
  for (const a of stand.aufgaben) if (a.emails.includes(mail)) zaehler.set(a.erledigt, (zaehler.get(a.erledigt) ?? 0) + 1);
  return zaehler;
}

/** Gebuchte ClickUp-Zeit einer Person je Tag, in Minuten. */
export function zeitJeTag(email: string): Map<string, number> {
  const mail = email.toLowerCase();
  return new Map(stand.zeit.filter((z) => z.email === mail).map((z) => [z.datum, z.minuten]));
}

/**
 * Dasselbe für das ganze Haus: alle aktiven Konten zusammen, je Tag. Eine
 * Aufgabe mit zwei Zuständigen zählt einmal; wer kein Hub-Konto hat, zählt nicht.
 */
export function teamJeTag(was: 'aufgaben' | 'zeit', rollen: string[] = []): Map<string, number> {
  const zeilen = rollen.length
    ? getDb().query<{email: string}, string[]>(`SELECT lower(email) email FROM users WHERE active = 1 AND role IN (${rollen.map(() => '?').join(',')})`).all(...rollen)
    : getDb().query<{email: string}, []>('SELECT lower(email) email FROM users WHERE active = 1').all();
  const emails = new Set(zeilen.map((u) => u.email));
  const summe = new Map<string, number>();
  if (was === 'zeit') for (const z of stand.zeit) { if (emails.has(z.email)) summe.set(z.datum, (summe.get(z.datum) ?? 0) + z.minuten); }
  else for (const a of stand.aufgaben) { if (a.emails.some((e) => emails.has(e))) summe.set(a.erledigt, (summe.get(a.erledigt) ?? 0) + 1); }
  return summe;
}

export function setClickupForTesting(neu?: Partial<Stand>): void {
  stand = {aufgaben: [], zeit: [], geladen: 0, ...neu};
}
