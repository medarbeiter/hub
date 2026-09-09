import {getDb, type User} from './db';
import {addDays, addMonths, daysInMonth, fmtDate, fmtDateRange, hausZeit, mondayOf, monthOf, todayISO} from './format';
import {countablePauseMin, requiredBreakMin} from './arbzg';
import {dayRecord, getUser} from './time';
import {istRolle, rolleLabel} from './rollen';
import {aufgabenJeTag, clickupKonfiguriert, teamJeTag, zeitJeTag} from './clickup';
import {istEmoji, MESSUNGEN, TEAM_MESSUNGEN, zielRegel, zielSatz, type GoalInput, type Je, type Messung, type Vergleich, type Wiederholung} from './ziele-arten';

interface GoalRow {
  id: number; user_id: number; titel: string; messung: Messung; vergleich: Vergleich; je: Je; wert: number | null;
  von: string; bis: string; oeffentlich: number; created_at: string; done_at: string | null;
  wiederholung: Wiederholung; fortgesetzt: number; team: number; rollen: string | null;
}
export interface GoalView extends GoalRow {
  erreicht: boolean; fortschritt: number; ziel: number; einheit: 'Minuten' | 'Tage' | 'Wochen' | 'Aufgaben' | 'Ziel';
  erreichtAm: string | null;
  /** Die Regel in Worten — dieselbe Zeile, die das Team sieht. */
  regel: string;
  /** Bei einem Teamziel: wer es gesetzt hat. */
  ersteller?: string;
  /** Bei einem Teamziel: die Rollen, die mitzählen — leer heißt das ganze Haus. */
  rollenLabels?: string[];
}
/** Was von einem geteilten Ziel das Haus verlässt: Titel, Regel, Stand — nie erfasste Stunden. */
export type PublicGoal = Pick<GoalView, 'id' | 'titel' | 'regel' | 'von' | 'bis' | 'erreicht' | 'erreichtAm'> & {automatisch: boolean};
export type PublicPerson = Pick<User, 'id' | 'name' | 'eintritt' | 'avatar_key' | 'avatar_datei'>;
export interface TimelineEvent {
  id: string; date: string;
  art: 'eintritt' | 'registrierung' | 'jubilaeum' | 'geburtstag' | 'ziel_erstellt' | 'ziel_erreicht';
  person: PublicPerson;
  /** Die Überschrift des Ereignisses — bei einem Ziel dessen Titel. */
  titel: string;
  /** Der Satz darunter: wer, seit wann, welcher Zeitraum. */
  beschreibung: string;
  goalId?: number;
  /** Jünger als der letzte Besuch der Betrachterin — nur gesetzt, wenn `teamTimeline` einen Besuch kennt. */
  neu?: boolean;
}
export interface Reaktion {
  /** Das Emoji. */
  art: string;
  anzahl: number;
  eigene: boolean;
  personen: PublicPerson[];
}

function validDate(date: unknown): date is string {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

/** Date-only goal rows are supported; SQLite registration timestamps are UTC. */
function houseMoment(value: string): string {
  if (value.length === 10) return `${value}T00:00:00.000`;
  const instant = new Date(value.endsWith('Z') ? value : `${value.replace(' ', 'T')}Z`);
  const {datum,stunde,minute,sekunde} = hausZeit(instant);
  return `${datum}T${String(stunde).padStart(2,'0')}:${String(minute).padStart(2,'0')}:${String(sekunde).padStart(2,'0')}.${String(instant.getUTCMilliseconds()).padStart(3,'0')}`;
}

function houseDate(value: string): string { return houseMoment(value).slice(0,10); }

export function createGoal(actorId: number, input: GoalInput): number {
  if (!getUser(actorId)?.active) throw new Error('Person nicht gefunden.');
  if (!Object.hasOwn(MESSUNGEN, input.messung)) throw new Error('Unbekannte Zielart.');
  const m = MESSUNGEN[input.messung];
  const team = input.team === true;
  if (team && !TEAM_MESSUNGEN.includes(input.messung)) throw new Error('Ein Teamziel kann Aufgaben, ClickUp-Zeit oder ein eigenes Vorhaben sein.');
  const vergleich: Vergleich = m.vergleiche.length ? input.vergleich : 'min';
  const je: Je = m.je.length ? input.je : 'tag';
  if (team && je === 'tag' && m.je.length) throw new Error('Ein Teamziel zählt pro Woche oder insgesamt.');
  const rollen = team && Array.isArray(input.rollen) ? [...new Set(input.rollen.filter((r) => typeof r === 'string'))] : [];
  if (rollen.some((r) => !istRolle(r))) throw new Error('Unbekannte Rolle.');
  const rollenText = rollen.length ? rollen.join(' ') : null;
  if (!(m.vergleiche as readonly string[]).includes(vergleich) && m.vergleiche.length) throw new Error('Dieser Vergleich passt nicht zu diesem Ziel.');
  if (!(m.je as readonly string[]).includes(je) && m.je.length) throw new Error('Diese Häufigkeit passt nicht zu diesem Ziel.');
  let wert: number | null = null;
  if (m.einheit === 'uhrzeit') {
    if (!Number.isInteger(input.wert) || input.wert! < 0 || input.wert! > 1439) throw new Error('Bitte eine gültige Uhrzeit eingeben.');
    wert = input.wert;
  } else if (m.einheit === 'anzahl') {
    if (!clickupKonfiguriert()) throw new Error('ClickUp ist nicht angebunden.');
    if (!Number.isInteger(input.wert) || input.wert! < 1 || input.wert! > 10000) throw new Error('Bitte eine Anzahl zwischen 1 und 10.000 eingeben.');
    wert = input.wert;
  } else if (m.einheit === 'dauer' && !(input.messung === 'pausen' && input.wert === null)) {
    if (input.messung === 'clickupzeit' && !clickupKonfiguriert()) throw new Error('ClickUp ist nicht angebunden.');
    const hoechstens = (je === 'tag' ? 1440 : 10080 * (je === 'zeitraum' ? 53 : 1)) * (team ? 50 : 1);
    if (!Number.isInteger(input.wert) || input.wert! < 1 || input.wert! > hoechstens) throw new Error('Bitte eine gültige Stundenzahl eingeben.');
    wert = input.wert;
  }
  const regel = {messung: input.messung, vergleich, je, wert};
  const titel = (typeof input.titel === 'string' ? input.titel.trim() : '') || zielSatz(regel);
  if (!titel || titel.length > 160) throw new Error(input.messung === 'frei' ? 'Bitte sag in höchstens 160 Zeichen, was du dir vornimmst.' : 'Bitte einen Titel mit höchstens 160 Zeichen eingeben.');
  if (!validDate(input.von) || !validDate(input.bis) || input.bis < input.von || input.bis > addDays(input.von, 365)) throw new Error('Bitte einen gültigen Zeitraum von höchstens 366 Tagen wählen.');
  if (typeof input.oeffentlich !== 'boolean') throw new Error('Bitte die Sichtbarkeit auswählen.');
  if (je === 'woche' && (mondayOf(input.von) !== input.von || mondayOf(input.bis) !== addDays(input.bis, -6))) throw new Error('Ein Wochenziel läuft von Montag bis Sonntag.');
  const wiederholung = input.wiederholung ?? 'keine';
  if (!['keine', 'woche', 'monat'].includes(wiederholung)) throw new Error('Unbekannte Wiederholung.');
  if (wiederholung === 'woche' && input.bis > addDays(input.von, 6)) throw new Error('Ein wöchentliches Ziel darf höchstens sieben Tage umfassen.');
  if (wiederholung === 'monat' && (input.von !== daysInMonth(monthOf(input.von))[0] || input.bis !== daysInMonth(monthOf(input.von)).at(-1))) throw new Error('Ein monatliches Ziel läuft vom Ersten bis zum Letzten eines Monats.');
  const result = getDb().query('INSERT INTO ziele (user_id,titel,messung,vergleich,je,wert,von,bis,oeffentlich,team,rollen,created_at,wiederholung) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(actorId,titel,input.messung,vergleich,je,wert,input.von,input.bis,Number(input.oeffentlich || team),Number(team),rollenText,new Date().toISOString(),wiederholung);
  return Number(result.lastInsertRowid);
}

export function ownGoal(actorId: number, id: number): GoalRow | null {
  return getDb().query<GoalRow, [number, number]>('SELECT * FROM ziele WHERE id = ? AND user_id = ?').get(id, actorId);
}
function owned(actorId: number, id: number): GoalRow {
  const goal = ownGoal(actorId, id);
  if (!goal) throw new Error('Ziel nicht gefunden oder nicht dein eigenes Ziel.');
  return goal;
}
export function setGoalDone(actorId: number, id: number, done: boolean): void {
  const goal = owned(actorId, id);
  if (goal.messung !== 'frei') throw new Error('Dieses Ziel wird automatisch geprüft.');
  if (typeof done !== 'boolean') throw new Error('Ungültiger Zielstatus.');
  if (done === (goal.done_at !== null)) return;
  getDb().query('UPDATE ziele SET done_at = ? WHERE id = ? AND user_id = ?').run(done ? new Date().toISOString() : null, id, actorId);
}
export function setGoalVisibility(actorId: number, id: number, oeffentlich: boolean): void {
  if (owned(actorId, id).team) throw new Error('Ein Teamziel ist immer für alle sichtbar.');
  if (typeof oeffentlich !== 'boolean') throw new Error('Ungültige Sichtbarkeit.');
  getDb().query('UPDATE ziele SET oeffentlich = ? WHERE id = ? AND user_id = ?').run(Number(oeffentlich), id, actorId);
}
export function setGoalRecurring(actorId: number, id: number, wiederholung: Wiederholung): void {
  owned(actorId, id);
  if (!['keine', 'woche', 'monat'].includes(wiederholung)) throw new Error('Unbekannte Wiederholung.');
  getDb().query('UPDATE ziele SET wiederholung = ? WHERE id = ? AND user_id = ?').run(wiederholung, id, actorId);
}

/**
 * Schreibt abgelaufene, sich wiederholende Ziele in ihren nächsten Zeitraum
 * fort — so oft, bis der Zeitraum heute erreicht. Die Fahne wandert auf die
 * jüngste Zeile; die alte bleibt als Geschichte stehen. Gerufen vom stündlichen
 * Lauf und beim Lesen der eigenen Ziele, damit der Montag nicht auf die Stunde wartet.
 */
export function zieleFortsetzen(today = todayISO(), userId?: number): number {
  const db = getDb();
  const faellig = db.query<GoalRow, [string, number, number]>("SELECT z.* FROM ziele z JOIN users u ON u.id = z.user_id WHERE z.wiederholung != 'keine' AND z.bis < ? AND u.active = 1 AND (z.user_id = ? OR ?)").all(today, userId ?? 0, userId === undefined ? 1 : 0);
  let angelegt = 0;
  for (const goal of faellig) {
    db.transaction(() => {
      let {von, bis} = goal;
      db.query("UPDATE ziele SET wiederholung = 'keine' WHERE id = ?").run(goal.id);
      while (bis < today) {
        if (goal.wiederholung === 'woche') { von = addDays(von, 7); bis = addDays(bis, 7); }
        else { const tage = daysInMonth(addMonths(monthOf(von), 1)); von = tage[0]!; bis = tage.at(-1)!; }
        const letzte = bis >= today;
        db.query('INSERT INTO ziele (user_id,titel,messung,vergleich,je,wert,von,bis,oeffentlich,team,rollen,created_at,wiederholung,fortgesetzt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)')
          .run(goal.user_id, goal.titel, goal.messung, goal.vergleich, goal.je, goal.wert, von, bis, goal.oeffentlich, goal.team, goal.rollen, `${von}T00:00:00.000Z`, letzte ? goal.wiederholung : 'keine');
        angelegt++;
      }
    })();
  }
  return angelegt;
}

export function deleteGoal(actorId: number, id: number): void {
  owned(actorId, id);
  getDb().query('DELETE FROM ziele WHERE id = ? AND user_id = ?').run(id, actorId);
}

/** Ein zählbarer Tag: Soll > 0, keine ganztägige Abwesenheit; `fertig` = erfasst und abgeschlossen. */
interface ZielTag { date: string; fertig: boolean; worked: number; pause: number; start: number; ende: number; aufgaben: number; zeit: number }

function tagErfuellt(goal: GoalRow, tag: ZielTag): boolean {
  const cmp = (x: number, w: number) => (goal.vergleich === 'min' ? x >= w : x <= w);
  if (goal.messung === 'aufgaben') return tag.fertig && cmp(tag.aufgaben, goal.wert!);
  if (goal.messung === 'clickupzeit') return tag.fertig && cmp(tag.zeit, goal.wert!);
  if (!tag.fertig || tag.worked <= 0) return false;
  switch (goal.messung) {
    case 'arbeitszeit': return cmp(tag.worked, goal.wert!);
    case 'pausen': return tag.pause >= (goal.wert ?? requiredBreakMin(tag.worked));
    case 'erfassung': return true;
    case 'anfang': return cmp(tag.start, goal.wert!);
    case 'feierabend': return cmp(tag.ende, goal.wert!);
    default: return false;
  }
}

function evaluate(goal: GoalRow, user: User, today: string): GoalView {
  goal = {...goal,created_at: houseDate(goal.created_at),done_at: goal.done_at ? houseDate(goal.done_at) : null};
  const result: GoalView = {...goal, erreicht: false, fortschritt: 0, ziel: 1, einheit: 'Ziel', erreichtAm: null, regel: zielRegel(goal)};
  if (goal.messung === 'frei') {
    result.erreicht = goal.done_at !== null && goal.done_at <= today;
    result.fortschritt = Number(result.erreicht);
    result.erreichtAm = result.erreicht ? goal.done_at : null;
    return result;
  }
  const aufgaben = goal.messung === 'aufgaben';
  const zeit = goal.messung === 'clickupzeit';
  const extern = aufgaben || zeit;
  const rollen = goal.rollen ? goal.rollen.split(' ') : [];
  const erledigt = aufgaben ? (goal.team ? teamJeTag('aufgaben', rollen) : aufgabenJeTag(user.email)) : null;
  const gebucht = zeit ? (goal.team ? teamJeTag('zeit', rollen) : zeitJeTag(user.email)) : null;
  const tage: ZielTag[] = [];
  for (let date = goal.von; date <= goal.bis; date = addDays(date, 1)) {
    // Ein Teamziel läuft über Kalendertage — es gibt kein gemeinsames Soll und keine gemeinsame Abwesenheit.
    if (goal.team) { tage.push({date, fertig: date <= today, worked: 0, pause: 0, start: 1440, ende: 0, aufgaben: erledigt?.get(date) ?? 0, zeit: gebucht?.get(date) ?? 0}); continue; }
    if (user.eintritt && date < user.eintritt) continue;
    const day = dayRecord(user, date);
    const wholeDayAbsence = day.dayType !== null && !(day.dayType === 'freizeitausgleich' && day.dayTypeMinuten !== null);
    if (day.sollMin <= 0 || wholeDayAbsence) continue;
    const arbeit = day.segments.filter(s => s.kind === 'arbeit' && s.end_min !== null);
    tage.push({
      date,
      aufgaben: erledigt?.get(date) ?? 0,
      zeit: gebucht?.get(date) ?? 0,
      // Was aus ClickUp kommt, zählt sofort — der Tag muss dafür hier nicht abgeschlossen sein.
      fertig: extern ? date <= today : date <= today && day.segments.length > 0 && !day.segments.some(s => s.end_min === null || s.auto_closed),
      worked: arbeit.reduce((sum, s) => sum + s.end_min! - s.start_min, 0),
      pause: countablePauseMin(day.segments),
      start: Math.min(1440, ...arbeit.map(s => s.start_min)),
      ende: Math.max(0, ...arbeit.map(s => s.end_min!)),
    });
  }
  let latest: string | null = null;
  // Eine einzelne Woche ist eine Summe — „12:00 von 40:00 Std." sagt mehr als „0 von 1 Wochen".
  const wochen = new Map<string, ZielTag[]>();
  for (const tag of tage) (wochen.get(mondayOf(tag.date)) ?? wochen.set(mondayOf(tag.date), []).get(mondayOf(tag.date))!).push(tag);
  const je = goal.je === 'woche' && wochen.size <= 1 ? 'zeitraum' : goal.je;
  /** Summe (Arbeitszeit oder Aufgaben) über eine Tagesgruppe: erreicht, und an welchem Tag. */
  const summe = (gruppe: ZielTag[]): {summe: number; erreicht: boolean; am: string | null} => {
    let sum = 0; let am: string | null = null;
    for (const tag of gruppe) {
      if (!tag.fertig) continue;
      sum += aufgaben ? tag.aufgaben : zeit ? tag.zeit : tag.worked;
      if (goal.vergleich === 'min' && sum >= goal.wert! && am === null) am = tag.date;
    }
    const komplett = gruppe.length > 0 && gruppe.every(t => t.fertig);
    const erreicht = goal.vergleich === 'min' ? sum >= goal.wert! : komplett && sum <= goal.wert!;
    return {summe: sum, erreicht, am: erreicht ? (am ?? gruppe[gruppe.length - 1]!.date) : null};
  };
  if (je === 'tag') {
    result.einheit = 'Tage';
    result.ziel = tage.length;
    for (const tag of tage) if (tagErfuellt(goal, tag)) { result.fortschritt++; latest = tag.date; }
  } else if (je === 'zeitraum') {
    result.einheit = aufgaben ? 'Aufgaben' : 'Minuten';
    result.ziel = goal.wert!;
    const s = summe(tage);
    result.fortschritt = s.summe;
    latest = s.am;
    result.erreicht = s.erreicht;
    result.erreichtAm = latest;
    if (goal.created_at > today || tage.length === 0) { result.erreicht = false; result.erreichtAm = null; }
    else if (latest && latest < goal.created_at) result.erreichtAm = goal.created_at;
    return result;
  } else {
    result.einheit = 'Wochen';
    result.ziel = wochen.size;
    for (const gruppe of wochen.values()) { const s = summe(gruppe); if (s.erreicht) { result.fortschritt++; latest = s.am; } }
  }
  result.erreicht = result.ziel > 0 && result.fortschritt >= result.ziel;
  result.erreichtAm = result.erreicht && latest ? (latest < goal.created_at ? goal.created_at : latest) : null;
  if (goal.created_at > today) { result.erreicht = false; result.erreichtAm = null; }
  return result;
}

export function ownGoals(actorId: number, today = todayISO()): GoalView[] {
  const user = getUser(actorId);
  if (!user) return [];
  zieleFortsetzen(today, actorId);
  return getDb().query<GoalRow, [number]>('SELECT * FROM ziele WHERE user_id = ? AND team = 0 ORDER BY id DESC').all(actorId).map(goal => evaluate(goal, user, today));
}
/** Die Ziele des ganzen Hauses — jedes mit dem Namen, der es gesetzt hat. */
export function teamGoals(today = todayISO()): GoalView[] {
  zieleFortsetzen(today);
  const views: GoalView[] = [];
  for (const goal of getDb().query<GoalRow, []>('SELECT z.* FROM ziele z JOIN users u ON u.id = z.user_id WHERE z.team = 1 AND u.active = 1 ORDER BY z.id DESC').all()) {
    const user = getUser(goal.user_id);
    if (user) views.push({...evaluate(goal, user, today), ersteller: user.name, rollenLabels: (goal.rollen ? goal.rollen.split(' ') : []).map(rolleLabel)});
  }
  return views;
}
export function publicGoals(userId: number, today = todayISO()): PublicGoal[] {
  const user = getUser(userId);
  if (!user) return [];
  return getDb().query<GoalRow, [number]>('SELECT * FROM ziele WHERE user_id = ? AND oeffentlich = 1 AND team = 0 ORDER BY id DESC').all(userId).map(goal => {
    const {id,titel,regel,von,bis,erreicht,erreichtAm,messung} = evaluate(goal,user,today);
    return {id,titel,regel,von,bis,erreicht,erreichtAm,automatisch: messung !== 'frei'};
  });
}
export function publicPerson(id: number): PublicPerson | null {
  return getDb().query<PublicPerson, [number]>('SELECT id,name,eintritt,avatar_key,avatar_datei FROM users WHERE id = ? AND active = 1').get(id);
}

export interface Jahrestag {
  date: string;
  art: 'jubilaeum' | 'geburtstag';
  person: PublicPerson;
  /** „3 Jahre im Team" / „Geburtstag" — nie ein Alter. */
  titel: string;
}

/** Jubiläen und Geburtstage in den nächsten `tage` Tagen (heute ausgeschlossen: das steht schon im Strang), nach Datum. */
export function kommendeJahrestage(today = todayISO(), tage = 60): Jahrestag[] {
  const bis = addDays(today, tage);
  const aus: Jahrestag[] = [];
  const people = getDb().query<PublicPerson & {geburtstag: string | null}, []>('SELECT id,name,eintritt,geburtstag,avatar_key,avatar_datei FROM users WHERE active = 1').all();
  for (const {geburtstag, ...person} of people) {
    if (person.eintritt) {
      // ponytail: Monate 6, 12, 24, … bis über das Fenster hinaus — so viele Jahre hat niemand, dass die Schleife zählt.
      for (let monate = 6; anniversary(person.eintritt, monate) <= bis; monate = monate < 12 ? 12 : monate + 12) {
        const date = anniversary(person.eintritt, monate);
        if (date > today) aus.push({date, art: 'jubilaeum', person, titel: monate === 6 ? 'Ein halbes Jahr im Team' : `${monate / 12} ${monate === 12 ? 'Jahr' : 'Jahre'} im Team`});
      }
    }
    if (geburtstag) {
      for (let year = Number(today.slice(0, 4)); year <= Number(bis.slice(0, 4)); year++) {
        const date = anniversary(geburtstag, (year - Number(geburtstag.slice(0, 4))) * 12);
        if (date > today && date <= bis) aus.push({date, art: 'geburtstag', person, titel: 'Geburtstag'});
      }
    }
  }
  return aus.sort((a, b) => a.date.localeCompare(b.date) || a.person.name.localeCompare(b.person.name));
}

function anniversary(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const first = new Date(Date.UTC(year!, month! - 1 + months, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day!, last));
  return first.toISOString().slice(0, 10);
}

/** Ein Besuch der Timeline: führt `timeline_besuch_at` nach und gibt zurück, bis wann alles als gesehen gilt (null: erster Besuch). */
export function timelineBesuch(userId: number, jetzt = new Date()): string | null {
  const db = getDb();
  const row = db.query<{gesehen: string | null; besuch: string | null}, [number]>('SELECT timeline_gesehen_at AS gesehen, timeline_besuch_at AS besuch FROM users WHERE id = ?').get(userId);
  const neuerBesuch = !row?.besuch || jetzt.getTime() - new Date(row.besuch).getTime() > BESUCH_ABSTAND_MS;
  const gesehen = neuerBesuch ? (row?.besuch ?? null) : (row?.gesehen ?? null);
  db.query('UPDATE users SET timeline_gesehen_at = ?, timeline_besuch_at = ? WHERE id = ?').run(gesehen, jetzt.toISOString(), userId);
  return gesehen;
}
const BESUCH_ABSTAND_MS = 5 * 60_000;

export function teamTimeline(page = 1, today = todayISO(), besuch?: {viewerId: number; gesehenBis: string | null}): {events: TimelineEvent[]; hasMore: boolean} {
  const events: TimelineEvent[] = [];
  const moments = new Map<string,string>();
  // geburtstag bleibt hier: es verlässt das Haus nur als Ereignis ohne Jahr, nie als Teil von PublicPerson.
  const people = getDb().query<PublicPerson & {created_at: string; geburtstag: string | null}, []>('SELECT id,name,eintritt,geburtstag,avatar_key,avatar_datei,created_at FROM users WHERE active = 1').all();
  for (const {created_at, geburtstag, ...person} of people) {
    const start = person.eintritt ?? houseDate(created_at);
    const add = (id: string,date: string,art: TimelineEvent['art'],titel: string,beschreibung: string,goalId?: number,moment = houseMoment(date)) => {
      if (date <= today) {
        events.push({id,date,art,person,titel,beschreibung,...(goalId === undefined ? {} : {goalId})});
        moments.set(id,moment);
      }
    };
    if (person.eintritt) add(`person-${person.id}`,start,'eintritt','Neu im Team',`${person.name} hat am ${fmtDate(person.eintritt)} angefangen. Willkommen!`,undefined,houseMoment(person.eintritt));
    else add(`person-${person.id}`,start,'registrierung','Neu im Hub',`${person.name} ist jetzt im MedArbeiter Hub.`,undefined,houseMoment(created_at));
    if (person.eintritt) {
      add(`jubilaeum-${person.id}-6`,anniversary(start,6),'jubilaeum','Ein halbes Jahr im Team',`${person.name} ist seit sechs Monaten dabei – danke für die gemeinsame Zeit.`);
      for (let year = 1; anniversary(start,year * 12) <= today; year++) add(`jubilaeum-${person.id}-${year * 12}`,anniversary(start,year * 12),'jubilaeum',`${year} ${year === 1 ? 'Jahr' : 'Jahre'} im Team`,`${person.name} ist seit ${year === 1 ? 'einem Jahr' : `${year} Jahren`} dabei – angefangen am ${fmtDate(person.eintritt)}.`);
    }
    if (geburtstag) {
      // Erst ab dem Start im Haus, sonst stünden vierzig Geburtstage im Strang; ohne Alter, das Jahr bleibt im Datensatz.
      for (let year = Number(start.slice(0, 4)); year <= Number(today.slice(0, 4)); year++) {
        const tag = anniversary(geburtstag,(year - Number(geburtstag.slice(0, 4))) * 12);
        if (tag >= start) add(`geburtstag-${person.id}-${year}`,tag,'geburtstag','Geburtstag',`${person.name} hat Geburtstag – herzlichen Glückwunsch!`);
      }
    }
    const user = getUser(person.id)!;
    for (const goal of getDb().query<GoalRow, [number]>('SELECT * FROM ziele WHERE user_id = ? AND oeffentlich = 1').all(person.id)) {
      const createdMoment = houseMoment(goal.created_at);
      const rahmen = `${fmtDateRange(goal.von,goal.bis)} · ${zielRegel(goal)}${goal.rollen ? ` · ${goal.rollen.split(' ').map(rolleLabel).join(', ')}` : ''}`;
      if (!goal.fortgesetzt) add(`ziel-${goal.id}-erstellt`,houseDate(goal.created_at),'ziel_erstellt',goal.titel,goal.team ? `${person.name} hat ein Ziel für das ganze Team gesetzt · ${rahmen}` : `${person.name} hat sich ein neues Ziel gesetzt · ${rahmen}`,goal.id,createdMoment);
      const progress = evaluate(goal,user,today);
      if (progress.erreichtAm) {
        let reachedMoment: string;
        if (goal.done_at) reachedMoment = houseMoment(goal.done_at);
        else {
          const end = Math.max(0,...dayRecord(user,progress.erreichtAm).segments.filter(s => s.kind === 'arbeit' && s.end_min !== null).map(s => s.end_min!));
          reachedMoment = `${progress.erreichtAm}T${String(Math.floor(end / 60)).padStart(2,'0')}:${String(end % 60).padStart(2,'0')}:00.000`;
          if (reachedMoment < createdMoment) reachedMoment = createdMoment;
        }
        add(`ziel-${goal.id}-erreicht`,progress.erreichtAm,'ziel_erreicht',goal.titel,goal.team ? `Das Team hat sein Ziel erreicht – am ${fmtDate(progress.erreichtAm)} · ${rahmen}` : `${person.name} hat das Ziel erreicht – am ${fmtDate(progress.erreichtAm)} · ${rahmen}`,goal.id,`${reachedMoment}~`);
      }
    }
  }
  events.sort((a,b) => moments.get(b.id)!.localeCompare(moments.get(a.id)!) || (b.goalId ?? 0) - (a.goalId ?? 0) || b.id.localeCompare(a.id));
  if (besuch) {
    // ponytail: „neu" heißt jünger als der letzte Besuch; ein durch eine Korrektur nachträglich erreichtes Ziel trägt den Tag des Eintrags und fällt darunter durch.
    // Erster Besuch (nichts gesehen): keine Marken, kein Grau — es gibt nichts zu unterscheiden.
    if (besuch.gesehenBis !== null) {
      const grenze = houseMoment(besuch.gesehenBis);
      for (const e of events) e.neu = e.person.id !== besuch.viewerId && moments.get(e.id)! > grenze;
    }
  }
  const offset = (Math.max(1,Number.isSafeInteger(page) ? page : 1) - 1) * 30;
  // ponytail: the internal team's feed is derived in memory; query a materialized feed if team size makes this slow.
  return {events: events.slice(offset,offset + 30),hasMore: events.length > offset + 30};
}

/** Wem ein Ereignis gehört und wie es heißt — für die Resonanz (lib/resonanz.ts). Null, wenn die Kennung nichts benennt. */
export function ereignisInfo(ereignis: string): {besitzer: number; titel: string} | null {
  let m: RegExpMatchArray | null;
  if ((m = /^person-(\d{1,9})$/.exec(ereignis))) {
    const p = publicPerson(Number(m[1]));
    return p ? {besitzer: p.id, titel: p.eintritt ? 'Neu im Team' : 'Neu im Hub'} : null;
  }
  if ((m = /^jubilaeum-(\d{1,9})-(\d{1,4})$/.exec(ereignis))) {
    const monate = Number(m[2]);
    return {besitzer: Number(m[1]), titel: monate === 6 ? 'Ein halbes Jahr im Team' : `${monate / 12} ${monate === 12 ? 'Jahr' : 'Jahre'} im Team`};
  }
  if ((m = /^geburtstag-(\d{1,9})-(\d{4})$/.exec(ereignis))) return {besitzer: Number(m[1]), titel: 'Geburtstag'};
  if ((m = /^ziel-(\d{1,9})-(erstellt|erreicht)$/.exec(ereignis))) {
    const z = getDb().query<{user_id: number; titel: string}, [number]>('SELECT user_id, titel FROM ziele WHERE id = ?').get(Number(m[1]));
    return z ? {besitzer: z.user_id, titel: z.titel} : null;
  }
  return null;
}

/** Ob hinter einer Ereigniskennung etwas steht, worauf man reagieren kann. */
function ereignisGueltig(ereignis: string): boolean {
  const db = getDb();
  let m: RegExpMatchArray | null;
  if ((m = /^person-(\d{1,9})$/.exec(ereignis))) return publicPerson(Number(m[1])) !== null;
  if ((m = /^jubilaeum-(\d{1,9})-(\d{1,4})$/.exec(ereignis))) {
    const monate = Number(m[2]);
    return (monate === 6 || (monate > 0 && monate % 12 === 0)) && publicPerson(Number(m[1]))?.eintritt != null;
  }
  if ((m = /^geburtstag-(\d{1,9})-(\d{4})$/.exec(ereignis))) {
    return db.query<{n: number}, [number]>('SELECT COUNT(*) n FROM users WHERE id = ? AND active = 1 AND geburtstag IS NOT NULL').get(Number(m[1]))!.n > 0;
  }
  if ((m = /^ziel-(\d{1,9})-(erstellt|erreicht)$/.exec(ereignis))) {
    return db.query<{n: number}, [number]>('SELECT COUNT(*) n FROM ziele z JOIN users u ON u.id = z.user_id WHERE z.id = ? AND z.oeffentlich = 1 AND u.active = 1').get(Number(m[1]))!.n > 0;
  }
  return false;
}

/** Schaltet eine Reaktion um und sagt, ob sie danach gesetzt ist. */
export function reagieren(userId: number, ereignis: unknown, art: unknown): boolean {
  if (!getUser(userId)?.active) throw new Error('Person nicht gefunden.');
  if (!istEmoji(art)) throw new Error('Unbekannte Reaktion.');
  if (typeof ereignis !== 'string' || ereignis.length > 64 || !ereignisGueltig(ereignis)) throw new Error('Dieses Ereignis gibt es nicht.');
  const db = getDb();
  const bestehend = db.query<{id: number}, [string, number, string]>('SELECT id FROM reaktionen WHERE ereignis = ? AND user_id = ? AND art = ?').get(ereignis, userId, art);
  if (bestehend) { db.query('DELETE FROM reaktionen WHERE id = ?').run(bestehend.id); return false; }
  db.query('INSERT INTO reaktionen (ereignis,user_id,art,created_at) VALUES (?,?,?,?)').run(ereignis, userId, art, new Date().toISOString());
  return true;
}

/** Die Reaktionen zu einer Seite Ereignisse, mit der eigenen markiert. */
export function reaktionenFuer(ereignisse: string[], viewerId: number): Record<string, Reaktion[]> {
  const ergebnis: Record<string, Reaktion[]> = {};
  if (ereignisse.length === 0) return ergebnis;
  const zeilen = getDb().query<PublicPerson & {ereignis: string; art: string}, string[]>(
    `SELECT r.ereignis, r.art, u.id, u.name, u.eintritt, u.avatar_key, u.avatar_datei FROM reaktionen r JOIN users u ON u.id = r.user_id
     WHERE u.active = 1 AND r.ereignis IN (${ereignisse.map(() => '?').join(',')}) ORDER BY r.id`,
  ).all(...ereignisse);
  for (const {ereignis, art, ...person} of zeilen) {
    const liste = (ergebnis[ereignis] ??= []);
    let eintrag = liste.find((r) => r.art === art);
    if (!eintrag) { eintrag = {art, anzahl: 0, eigene: false, personen: []}; liste.push(eintrag); }
    eintrag.anzahl++;
    if (person.id === viewerId) eintrag.eigene = true;
    eintrag.personen.push(person);
  }
  return ergebnis;
}
