// Die Zugangscodes — der Datensatz (DB-gebunden). Das Rechenwerk liegt in
// lib/totp.ts; hier steht, wie ein Zugang angelegt, geändert, gelöscht und
// abgelesen wird, und wer das jeweils darf.
//
// Die eine Regel dieses Moduls: **das Geheimnis verlässt den Server nie.**
// `aktuelleZugangscodes()` ist die einzige Leseform für die Seite, und sie
// gibt den fertigen Code samt Ablaufzeit heraus — nicht das, woraus er
// entsteht. Wer das Geheimnis noch einmal sehen will, kann es nicht: es wird
// beim Anlegen einmal entgegengenommen und danach nur noch gerechnet. Auch
// das Bearbeiten zeigt es nie wieder — ein leeres Schlüsselfeld heißt
// „behalten", ein gefülltes ersetzt es.
//
// Jeder Zugang trägt einen **Leserkreis**: alle Angemeldeten, ausgewählte
// Rollen (`totp_konto_rollen`) oder ausgewählte Personen
// (`totp_konto_personen`) — „nur für mich" ist der Personenkreis mit genau
// einem Eintrag. Wer `zugangscodes.erfassen` trägt, legt eigene Zugänge an
// (nur für sich oder mit Personen geteilt) und pflegt, was er angelegt hat;
// wer `zugangscodes.verwalten` trägt, sieht und pflegt jeden Zugang und darf
// auch für alle oder für Rollen freigeben.

import {personAngabe, type AvatarKey, type PersonAngabe} from './avatar';
import {getDb, type TotpKonto, type TotpPin, type User, type ZugangscodeLoeschung} from './db';
import {hatRecht} from './rechte';
import {istRolle, rolleLabel} from './rollen';
import {base32Dekodieren, periodeEnde, totpCode, type TotpVerfahren} from './totp';

/** 30 Minuten, den Bestätigungslink zu öffnen — lang genug fürs Postfach, kurz genug fürs Risiko. */
const LOESCHUNG_TTL_MS = 30 * 60_000;

function sha256Hex(text: string): string {
  return new Bun.CryptoHasher('sha256').update(text, 'utf8').digest('hex');
}

/** Opaker Wert nach dem Sitzungsmuster (lib/auth.ts): zweimal randomUUID. */
function opakerWert(): string {
  return crypto.randomUUID() + crypto.randomUUID();
}

export type ZugangSichtbarkeit = TotpKonto['sichtbarkeit'];

export interface ZugangskontoEingabe {
  dienst: string;
  konto: string | null;
  /** Beim Ändern darf er leer bleiben — dann bleibt das gespeicherte Geheimnis. */
  secret: string;
  verfahren: TotpVerfahren;
  sichtbarkeit: ZugangSichtbarkeit;
  rollen?: string[];
  personen?: number[];
}

/** Wer eine Zeile liest oder anfasst — nur die Identität, die die Sitzung ohnehin trägt. */
type Leser = Pick<User, 'id' | 'role' | 'rechte'>;

/** „Google (info@firma.de)" — der Name eines Zugangs im Protokoll und in Sätzen. */
export function zugangskontoName(k: Pick<TotpKonto, 'dienst' | 'konto'>): string {
  return k.konto ? `${k.dienst} (${k.konto})` : k.dienst;
}

export function alleZugangskonten(): TotpKonto[] {
  return getDb().query<TotpKonto, []>('SELECT * FROM totp_konten ORDER BY dienst, konto').all();
}

export function zugangskontoById(id: number): TotpKonto | null {
  return getDb().query<TotpKonto, [number]>('SELECT * FROM totp_konten WHERE id = ?').get(id) ?? null;
}

function kreisRollen(totpId: number): string[] {
  return getDb()
    .query<{rolle: string}, [number]>('SELECT rolle FROM totp_konto_rollen WHERE totp_id = ? ORDER BY rolle')
    .all(totpId)
    .map((r) => r.rolle);
}

function kreisPersonen(totpId: number): Array<{id: number; name: string; avatar_key: AvatarKey; avatar_datei: string | null}> {
  return getDb()
    .query<{id: number; name: string; avatar_key: AvatarKey; avatar_datei: string | null}, [number]>(
      `SELECT u.id, u.name, u.avatar_key, u.avatar_datei
         FROM totp_konto_personen p JOIN users u ON u.id = p.user_id
       WHERE p.totp_id = ? ORDER BY u.name`,
    )
    .all(totpId);
}

/**
 * Prüft und normalisiert den Leserkreis gegen die Rechte der handelnden
 * Person. Wer nur erfasst, teilt mit Personen — und steht selbst immer im
 * Kreis, sonst verschwände der eigene Zugang aus dem eigenen Blick. Für alle
 * oder für Rollen gibt nur frei, wer Zugangscodes verwaltet.
 */
function pruefeKreis(
  actor: Leser,
  eingabe: Pick<ZugangskontoEingabe, 'sichtbarkeit' | 'rollen' | 'personen'>,
): {sichtbarkeit: ZugangSichtbarkeit; rollen: string[]; personen: number[]} | string {
  const verwaltet = hatRecht(actor, 'zugangscodes.verwalten');
  if (!verwaltet && !hatRecht(actor, 'zugangscodes.erfassen')) return 'Keine Berechtigung.';

  if (eingabe.sichtbarkeit === 'rolle') {
    if (!verwaltet) return 'Für Rollen freigeben kann nur, wer Zugangscodes verwaltet.';
    const rollen = [...new Set(eingabe.rollen ?? [])];
    if (rollen.length === 0 || rollen.some((r) => !istRolle(r))) {
      return 'Bitte mindestens eine Rolle wählen, die diesen Code sehen soll.';
    }
    return {sichtbarkeit: 'rolle', rollen, personen: []};
  }

  if (eingabe.sichtbarkeit === 'personen') {
    const personen = new Set(eingabe.personen ?? []);
    if (!verwaltet) personen.add(actor.id);
    if (personen.size === 0) return 'Bitte mindestens eine Person wählen, die diesen Code sehen soll.';
    return {sichtbarkeit: 'personen', rollen: [], personen: [...personen]};
  }

  if (!verwaltet) return 'Für alle freigeben kann nur, wer Zugangscodes verwaltet.';
  return {sichtbarkeit: 'alle', rollen: [], personen: []};
}

function schreibeKreis(
  totpId: number,
  kreis: {sichtbarkeit: ZugangSichtbarkeit; rollen: string[]; personen: number[]},
): void {
  const db = getDb();
  db.query('DELETE FROM totp_konto_rollen WHERE totp_id = ?').run(totpId);
  db.query('DELETE FROM totp_konto_personen WHERE totp_id = ?').run(totpId);
  for (const rolle of kreis.rollen) {
    db.query('INSERT INTO totp_konto_rollen (totp_id, rolle) VALUES (?, ?)').run(totpId, rolle);
  }
  for (const userId of kreis.personen) {
    db.query('INSERT INTO totp_konto_personen (totp_id, user_id) VALUES (?, ?)').run(totpId, userId);
  }
}

/** Pflegen darf, wer Zugangscodes verwaltet — oder den eigenen Zugang, wer erfassen darf. */
export function darfZugangBearbeiten(actor: Leser, konto: Pick<TotpKonto, 'erstellt_von'>): boolean {
  if (hatRecht(actor, 'zugangscodes.verwalten')) return true;
  return hatRecht(actor, 'zugangscodes.erfassen') && konto.erstellt_von === actor.id;
}

function doppeltVorhanden(dienst: string, konto: string | null, ausserId?: number): boolean {
  const row = getDb()
    .query<{n: number}, [string, string | null, number]>(
      'SELECT count(*) AS n FROM totp_konten WHERE dienst = ? AND konto IS ? AND id != ?',
    )
    .get(dienst, konto, ausserId ?? 0);
  return (row?.n ?? 0) > 0;
}

/**
 * Ein freier Name für einen neuen Zugang: ist „Dienst (Konto)" schon
 * vergeben, wird nummeriert — „info@firma.de (2)" bzw. ohne Konto
 * „Google (2)". Für den Import: ein neu eingerichteter Dienst bringt
 * denselben Namen mit einem **neuen** Geheimnis mit, und eine Abweisung
 * verwürfe dort gerade das lebende.
 */
export function freieBenennung(dienst: string, konto: string | null): {dienst: string; konto: string | null} {
  if (!doppeltVorhanden(dienst, konto)) return {dienst, konto};
  for (let n = 2; ; n++) {
    const kandidat = konto ? {dienst, konto: `${konto} (${n})`} : {dienst: `${dienst} (${n})`, konto};
    if (!doppeltVorhanden(kandidat.dienst, kandidat.konto)) return kandidat;
  }
}

/**
 * Einen Zugang anlegen. Gibt bei jedem Mangel einen deutschen Satz zurück —
 * derselbe Vertrag wie überall: der Satz ist die Fehlermeldung des Formulars.
 */
export function zugangskontoAnlegen(actor: Leser, eingabe: ZugangskontoEingabe): TotpKonto | string {
  const kreis = pruefeKreis(actor, eingabe);
  if (typeof kreis === 'string') return kreis;
  const dienst = eingabe.dienst.trim();
  if (dienst === '') return 'Bitte den Dienst benennen, zu dem der Code gehört.';
  const geheimnis = base32Dekodieren(eingabe.secret);
  if (geheimnis === null || geheimnis.length < 5) {
    return 'Das Geheimnis konnte nicht gelesen werden. Erwartet wird der Schlüssel, den der Dienst neben dem QR-Code zeigt (Base32), oder der otpauth-Link.';
  }
  const konto = eingabe.konto?.trim() || null;
  // Zwei Einträge mit demselben Namen wären zwei Codes, von denen einer der
  // falsche ist — genau die Verwirrung, die das Büro-Handy nie hatte.
  if (doppeltVorhanden(dienst, konto)) {
    return `Für ${zugangskontoName({dienst, konto})} ist bereits ein Code hinterlegt.`;
  }

  const db = getDb();
  const row = db.transaction(() => {
    const neu = db
      .query<TotpKonto, [string, string | null, string, string, number, number, number, string]>(
        `INSERT INTO totp_konten (dienst, konto, secret, algorithmus, stellen, periode, erstellt_von, sichtbarkeit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`,
      )
      .get(
        dienst,
        konto,
        eingabe.secret.trim(),
        eingabe.verfahren.algorithmus,
        eingabe.verfahren.stellen,
        eingabe.verfahren.periode,
        actor.id,
        kreis.sichtbarkeit,
      );
    if (neu) schreibeKreis(neu.id, kreis);
    return neu;
  })();
  return row ?? 'Der Zugang konnte nicht gespeichert werden.';
}

/**
 * Einen Zugang ändern: Name, Konto, Leserkreis — und auf Wunsch das Geheimnis
 * (leer gelassen bleibt das gespeicherte; das alte ist nie wieder ablesbar).
 */
export function zugangskontoAendern(actor: Leser, id: number, eingabe: ZugangskontoEingabe): string | null {
  const bestehend = zugangskontoById(id);
  if (!bestehend) return 'Diesen Zugang gibt es nicht mehr.';
  if (!darfZugangBearbeiten(actor, bestehend)) return 'Keine Berechtigung.';
  const kreis = pruefeKreis(actor, eingabe);
  if (typeof kreis === 'string') return kreis;
  const dienst = eingabe.dienst.trim();
  if (dienst === '') return 'Bitte den Dienst benennen, zu dem der Code gehört.';
  const konto = eingabe.konto?.trim() || null;
  if (doppeltVorhanden(dienst, konto, id)) {
    return `Für ${zugangskontoName({dienst, konto})} ist bereits ein Code hinterlegt.`;
  }

  const neuesSecret = eingabe.secret.trim();
  if (neuesSecret !== '') {
    const geheimnis = base32Dekodieren(neuesSecret);
    if (geheimnis === null || geheimnis.length < 5) {
      return 'Der neue Schlüssel konnte nicht gelesen werden. Leer lassen behält den gespeicherten.';
    }
  }

  const db = getDb();
  db.transaction(() => {
    if (neuesSecret !== '') {
      db.query(
        'UPDATE totp_konten SET dienst = ?, konto = ?, sichtbarkeit = ?, secret = ?, algorithmus = ?, stellen = ?, periode = ? WHERE id = ?',
      ).run(
        dienst,
        konto,
        kreis.sichtbarkeit,
        neuesSecret,
        eingabe.verfahren.algorithmus,
        eingabe.verfahren.stellen,
        eingabe.verfahren.periode,
        id,
      );
    } else {
      db.query('UPDATE totp_konten SET dienst = ?, konto = ?, sichtbarkeit = ? WHERE id = ?').run(
        dienst,
        konto,
        kreis.sichtbarkeit,
        id,
      );
    }
    schreibeKreis(id, kreis);
  })();
  return null;
}

/**
 * Fordert die Löschung an: keine Zeile fällt hier schon, nur ein
 * Bestätigungslink entsteht (per E-Mail an den Anfragenden selbst — siehe
 * lib/benachrichtigungen.ts). Ältere offene Anfragen zu diesem Zugang
 * verfallen dabei, damit nur der zuletzt verschickte Link etwas löscht.
 */
export function zugangskontoLoeschungAnfordern(
  actor: Leser,
  id: number,
): {konto: TotpKonto; token: string} | string {
  const bestehend = zugangskontoById(id);
  if (!bestehend) return 'Diesen Zugang gibt es nicht mehr.';
  if (!darfZugangBearbeiten(actor, bestehend)) return 'Keine Berechtigung.';
  const token = opakerWert();
  const jetzt = Date.now();
  const db = getDb();
  db.query('DELETE FROM zugangscode_loeschungen WHERE totp_id = ? AND eingeloest_am IS NULL').run(id);
  db.query('DELETE FROM zugangscode_loeschungen WHERE ablauf_am < ?').run(jetzt);
  db.query(
    'INSERT INTO zugangscode_loeschungen (totp_id, angefordert_von, token_hash, erstellt_am, ablauf_am) VALUES (?, ?, ?, ?, ?)',
  ).run(id, actor.id, sha256Hex(token), jetzt, jetzt + LOESCHUNG_TTL_MS);
  return {konto: bestehend, token};
}

/**
 * Sammel-Löschung: ein Token für mehrere Zugänge, eine Bestätigungsmail, ein
 * Link — der löst dann alle Zeilen zugleich ein. Nur für Verwaltende: die
 * Auswahl über fremde Leserkreise hinweg ist genau ihr Blick auf die Liste.
 */
export function zugangskontoSammelLoeschungAnfordern(
  actor: Leser,
  ids: number[],
): {konten: TotpKonto[]; token: string} | string {
  if (!hatRecht(actor, 'zugangscodes.verwalten')) {
    return 'Mehrere Zugänge auf einmal entfernen kann nur, wer Zugangscodes verwaltet.';
  }
  const eindeutig = [...new Set(ids)].filter((n) => Number.isInteger(n) && n > 0);
  if (eindeutig.length === 0) return 'Bitte mindestens einen Zugang auswählen.';
  const konten: TotpKonto[] = [];
  for (const id of eindeutig) {
    const bestehend = zugangskontoById(id);
    if (!bestehend) return 'Einen der gewählten Zugänge gibt es nicht mehr.';
    konten.push(bestehend);
  }
  const token = opakerWert();
  const jetzt = Date.now();
  const db = getDb();
  db.transaction(() => {
    db.query('DELETE FROM zugangscode_loeschungen WHERE ablauf_am < ?').run(jetzt);
    for (const konto of konten) {
      db.query('DELETE FROM zugangscode_loeschungen WHERE totp_id = ? AND eingeloest_am IS NULL').run(konto.id);
      db.query(
        'INSERT INTO zugangscode_loeschungen (totp_id, angefordert_von, token_hash, erstellt_am, ablauf_am) VALUES (?, ?, ?, ?, ?)',
      ).run(konto.id, actor.id, sha256Hex(token), jetzt, jetzt + LOESCHUNG_TTL_MS);
    }
  })();
  return {konten, token};
}

/**
 * Löst den Bestätigungslink ein und löscht — nur wer die Anfrage selbst
 * gestellt hat und die Berechtigung noch trägt, darf so bestätigen; das
 * Recht kann sich zwischen Anfrage und Klick geändert haben. Ein Token kann
 * mehrere Zeilen tragen (Sammel-Löschung) — zurück kommen die gelöschten
 * Zeilen als Liste (fürs Protokoll) oder ein deutscher Satz.
 */
export function zugangskontoLoeschungBestaetigen(actor: Leser, token: string): TotpKonto[] | string {
  const db = getDb();
  const jetzt = Date.now();
  const anfragen = db
    .query<ZugangscodeLoeschung, [string]>('SELECT * FROM zugangscode_loeschungen WHERE token_hash = ?')
    .all(sha256Hex(token));
  const offene = anfragen.filter((a) => a.eingeloest_am === null && a.ablauf_am >= jetzt);
  if (offene.length === 0) return 'Dieser Bestätigungslink ist ungültig oder abgelaufen.';
  if (offene.some((a) => a.angefordert_von !== actor.id)) return 'Keine Berechtigung.';
  const konten = offene.map((a) => zugangskontoById(a.totp_id)).filter((k): k is TotpKonto => k !== null);
  if (konten.length === 0) return 'Diesen Zugang gibt es nicht mehr.';
  if (konten.some((k) => !darfZugangBearbeiten(actor, k))) return 'Keine Berechtigung.';

  return db.transaction(() => {
    const geloescht: TotpKonto[] = [];
    for (const anfrage of offene) {
      db.query('UPDATE zugangscode_loeschungen SET eingeloest_am = ? WHERE id = ?').run(jetzt, anfrage.id);
      const zeile = db
        .query<TotpKonto, [number]>('DELETE FROM totp_konten WHERE id = ? RETURNING *')
        .get(anfrage.totp_id);
      if (zeile) geloescht.push(zeile);
    }
    return geloescht;
  })();
}

/**
 * Die Zeilen, die diese Person lesen darf. Der Zuschnitt liegt hier in der
 * Abfrage — dieselbe Haltung wie `sichtbarFuer` im Protokoll: eine
 * Sichtbarkeitsregel, die erst in der Anzeige greift, ist eine, an der man
 * vorbeikommt. Wer `zugangscodes.verwalten` trägt, sieht jede Zeile: sonst
 * ließe sich ein falsch zugeschnittener Zugang nicht mehr finden und
 * entfernen — dafür steht der Leserkreis sichtbar an der Zeile.
 */
export function sichtbareZugangskonten(fuer: Leser): TotpKonto[] {
  if (hatRecht(fuer, 'zugangscodes.verwalten')) return alleZugangskonten();
  return getDb()
    .query<TotpKonto, [string, number]>(
      `SELECT k.* FROM totp_konten k
       WHERE k.sichtbarkeit = 'alle'
          OR (k.sichtbarkeit = 'rolle' AND EXISTS (
                SELECT 1 FROM totp_konto_rollen r WHERE r.totp_id = k.id AND r.rolle = ?
              ))
          OR (k.sichtbarkeit = 'personen' AND EXISTS (
                SELECT 1 FROM totp_konto_personen p WHERE p.totp_id = k.id AND p.user_id = ?
              ))
       ORDER BY k.dienst, k.konto`,
    )
    .all(fuer.role, fuer.id);
}

/**
 * Der Leserkreis als deutscher Satzteil für die Zeile und das Protokoll —
 * `null`, wenn alle ihn sehen (die Vorgabe trägt kein Schild). Für den
 * einzigen Eingetragenen heißt der eigene Kreis „Nur für dich".
 */
export function sichtbarkeitText(konto: TotpKonto, fuer?: Leser): string | null {
  if (konto.sichtbarkeit === 'alle') return null;
  if (konto.sichtbarkeit === 'rolle') return `Nur ${kreisRollen(konto.id).map(rolleLabel).join(', ')}`;
  const personen = kreisPersonen(konto.id);
  if (personen.length === 1 && fuer && personen[0]!.id === fuer.id) return 'Nur für dich';
  return `Nur ${personen.map((p) => p.name).join(', ')}`;
}

/** Was die Seite zeigt: der fertige Code, nie das Geheimnis. */
export interface Zugangscode {
  id: number;
  dienst: string;
  konto: string | null;
  /** `null`, wenn das gespeicherte Geheimnis nicht (mehr) lesbar ist. */
  code: string | null;
  /** Wann dieser Code abläuft (Millisekunden seit Epoche). */
  gueltigBisMs: number;
  periode: number;
  /** Der Leserkreis als Schild an der Zeile; `null`, wenn alle ihn sehen. */
  sichtbar: string | null;
  /**
   * Wer den Zugang lesen darf, als Gesichter — nur beim Personenkreis. Bei
   * „alle" oder einer Rolle steht keine Namensliste dahinter, die man zeigen
   * könnte, und das Schild sagt es kürzer.
   */
  kreisGesichter: PersonAngabe[];
  /** Wonach die Seite gruppiert: angepinnt zuoberst, dann eigene, geteilte, für alle. */
  gruppe: 'angepinnt' | 'selbst' | 'geteilt' | 'alle';
  /** Der Pin-Zustand: der eigene Pin fürs Umschalten, der ganze Kreis nur für Verwaltende. */
  pin: {selbst: boolean; breite: PinKreis | null};
  darfBearbeiten: boolean;
  /** Der rohe Kreis fürs Bearbeiten-Formular — nur, wenn Bearbeiten erlaubt ist. */
  kreis: {sichtbarkeit: ZugangSichtbarkeit; rollen: string[]; personen: number[]} | null;
}

export function aktuelleZugangscodes(fuer: Leser, beiMs: number = Date.now()): Zugangscode[] {
  const pins = pinKreise();
  const verwaltet = hatRecht(fuer, 'zugangscodes.verwalten');
  return sichtbareZugangskonten(fuer).map((k) => {
    const geheimnis = base32Dekodieren(k.secret);
    const personen = k.sichtbarkeit === 'personen' ? kreisPersonen(k.id) : [];
    const nurIch = personen.length === 1 && personen[0]!.id === fuer.id;
    const darf = darfZugangBearbeiten(fuer, k);
    const pin = pins.get(k.id) ?? LEERER_PIN;
    const angepinnt = pin.alle || pin.rollen.includes(fuer.role) || pin.personen.includes(fuer.id);
    return {
      id: k.id,
      dienst: k.dienst,
      konto: k.konto,
      code:
        geheimnis === null
          ? null
          : totpCode(geheimnis, {algorithmus: k.algorithmus, stellen: k.stellen, periode: k.periode}, beiMs),
      gueltigBisMs: periodeEnde(k.periode, beiMs),
      periode: k.periode,
      sichtbar: sichtbarkeitText(k, fuer),
      kreisGesichter: personen.map(personAngabe),
      gruppe: angepinnt ? 'angepinnt' : k.sichtbarkeit === 'alle' ? 'alle' : nurIch ? 'selbst' : 'geteilt',
      pin: {selbst: pin.personen.includes(fuer.id), breite: verwaltet ? pin : null},
      darfBearbeiten: darf,
      kreis: darf
        ? {sichtbarkeit: k.sichtbarkeit, rollen: kreisRollen(k.id), personen: personen.map((p) => p.id)}
        : null,
    };
  });
}

// ── Angepinnte Zugänge ──────────────────────────────────────────────────────
// Ein Pin hebt einen Zugang in die Gruppe „Angepinnt" — für alle, für Rollen
// oder für einzelne Personen, als additive Zeilen (totp_pins, Migration 30).
// Er ändert nichts am Leserkreis: gerechnet wird er NACH dem Sichtbarkeits-
// zuschnitt, ein Pin auf einen unsichtbaren Zugang taucht also nie auf.

export interface PinKreis {
  alle: boolean;
  rollen: string[];
  personen: number[];
}

const LEERER_PIN: PinKreis = {alle: false, rollen: [], personen: []};

function pinsFalten(zeilen: TotpPin[]): Map<number, PinKreis> {
  const map = new Map<number, PinKreis>();
  for (const zeile of zeilen) {
    const kreis = map.get(zeile.totp_id) ?? {alle: false, rollen: [], personen: []};
    if (zeile.art === 'alle') kreis.alle = true;
    else if (zeile.art === 'rolle' && zeile.rolle !== null) kreis.rollen.push(zeile.rolle);
    else if (zeile.art === 'person' && zeile.user_id !== null) kreis.personen.push(zeile.user_id);
    map.set(zeile.totp_id, kreis);
  }
  return map;
}

/** Alle Pin-Kreise auf einmal — die Liste ist klein, eine Abfrage genügt. */
function pinKreise(): Map<number, PinKreis> {
  return pinsFalten(getDb().query<TotpPin, []>('SELECT * FROM totp_pins').all());
}

export function pinKreisVon(totpId: number): PinKreis {
  const zeilen = getDb().query<TotpPin, [number]>('SELECT * FROM totp_pins WHERE totp_id = ?').all(totpId);
  return pinsFalten(zeilen).get(totpId) ?? {alle: false, rollen: [], personen: []};
}

/**
 * Den eigenen Pin setzen oder lösen. Wer erfasst, pinnt für sich — und nur
 * Zugänge, die er sieht; die Abweisung nennt einen unsichtbaren Zugang nicht
 * (dieselbe Auskunft wie bei einem, den es nicht gibt).
 */
export function eigenenPinSetzen(actor: Leser, totpId: number, an: boolean): string | null {
  if (!hatRecht(actor, 'zugangscodes.erfassen')) return 'Keine Berechtigung.';
  if (!sichtbareZugangskonten(actor).some((k) => k.id === totpId)) return 'Diesen Zugang gibt es nicht mehr.';
  const db = getDb();
  if (an) {
    db.query(`INSERT OR IGNORE INTO totp_pins (totp_id, art, user_id) VALUES (?, 'person', ?)`).run(totpId, actor.id);
  } else {
    db.query(`DELETE FROM totp_pins WHERE totp_id = ? AND art = 'person' AND user_id = ?`).run(totpId, actor.id);
  }
  return null;
}

/**
 * Den ganzen Pin-Kreis eines Zugangs zuschneiden — nur für Verwaltende, und
 * als Ganzes ersetzt wie `schreibeKreis()`: der Dialog zeigt den vollen Kreis
 * und schreibt den vollen Kreis, es gibt keinen halben Zustand.
 */
export function pinneZuschneiden(actor: Leser, totpId: number, ziel: PinKreis): string | null {
  if (!hatRecht(actor, 'zugangscodes.verwalten')) {
    return 'Für alle oder für Rollen anpinnen kann nur, wer Zugangscodes verwaltet.';
  }
  if (zugangskontoById(totpId) === null) return 'Diesen Zugang gibt es nicht mehr.';
  const rollen = [...new Set(ziel.rollen)];
  if (rollen.some((r) => !istRolle(r))) return 'Bitte nur bestehende Rollen anpinnen.';
  const personen = [...new Set(ziel.personen)].filter((n) => Number.isInteger(n) && n > 0);
  const db = getDb();
  db.transaction(() => {
    db.query('DELETE FROM totp_pins WHERE totp_id = ?').run(totpId);
    if (ziel.alle) db.query(`INSERT INTO totp_pins (totp_id, art) VALUES (?, 'alle')`).run(totpId);
    for (const rolle of rollen) {
      db.query(`INSERT INTO totp_pins (totp_id, art, rolle) VALUES (?, 'rolle', ?)`).run(totpId, rolle);
    }
    for (const userId of personen) {
      db.query(`INSERT INTO totp_pins (totp_id, art, user_id) VALUES (?, 'person', ?)`).run(totpId, userId);
    }
  })();
  return null;
}

/** Der Pin-Kreis als deutscher Satzteil fürs Protokoll — „niemand", wenn leer. */
export function pinText(kreis: PinKreis): string {
  const teile: string[] = [];
  if (kreis.alle) teile.push('alle Angemeldeten');
  if (kreis.rollen.length > 0) teile.push(kreis.rollen.map(rolleLabel).join(', '));
  if (kreis.personen.length > 0) {
    const namen = kreis.personen.map(
      (id) => getDb().query<{name: string}, [number]>('SELECT name FROM users WHERE id = ?').get(id)?.name ?? `#${id}`,
    );
    teile.push(namen.sort((a, b) => a.localeCompare(b, 'de')).join(', '));
  }
  return teile.length > 0 ? teile.join(' · ') : 'niemand';
}
