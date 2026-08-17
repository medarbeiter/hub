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

import {getDb, type TotpKonto, type User, type ZugangscodeLoeschung} from './db';
import {hatRecht, istRolle, rolleLabel} from './rechte';
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

function kreisPersonen(totpId: number): Array<{id: number; name: string}> {
  return getDb()
    .query<{id: number; name: string}, [number]>(
      `SELECT u.id, u.name FROM totp_konto_personen p JOIN users u ON u.id = p.user_id
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
 * Löst den Bestätigungslink ein und löscht — nur wer die Anfrage selbst
 * gestellt hat und die Berechtigung noch trägt, darf so bestätigen; das
 * Recht kann sich zwischen Anfrage und Klick geändert haben. Gibt die
 * gelöschte Zeile zurück (fürs Protokoll) oder einen deutschen Satz.
 */
export function zugangskontoLoeschungBestaetigen(actor: Leser, token: string): TotpKonto | string {
  const db = getDb();
  const anfrage = db
    .query<ZugangscodeLoeschung, [string]>('SELECT * FROM zugangscode_loeschungen WHERE token_hash = ?')
    .get(sha256Hex(token));
  if (!anfrage || anfrage.eingeloest_am !== null || anfrage.ablauf_am < Date.now()) {
    return 'Dieser Bestätigungslink ist ungültig oder abgelaufen.';
  }
  if (anfrage.angefordert_von !== actor.id) return 'Keine Berechtigung.';
  const bestehend = zugangskontoById(anfrage.totp_id);
  if (!bestehend) return 'Diesen Zugang gibt es nicht mehr.';
  if (!darfZugangBearbeiten(actor, bestehend)) return 'Keine Berechtigung.';

  return (
    db.transaction(() => {
      db.query('UPDATE zugangscode_loeschungen SET eingeloest_am = ? WHERE id = ?').run(Date.now(), anfrage.id);
      return db.query<TotpKonto, [number]>('DELETE FROM totp_konten WHERE id = ? RETURNING *').get(anfrage.totp_id);
    })() ?? 'Diesen Zugang gibt es nicht mehr.'
  );
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
  /** Wonach die Seite gruppiert: eigene, geteilte, für alle. */
  gruppe: 'selbst' | 'geteilt' | 'alle';
  darfBearbeiten: boolean;
  /** Der rohe Kreis fürs Bearbeiten-Formular — nur, wenn Bearbeiten erlaubt ist. */
  kreis: {sichtbarkeit: ZugangSichtbarkeit; rollen: string[]; personen: number[]} | null;
}

export function aktuelleZugangscodes(fuer: Leser, beiMs: number = Date.now()): Zugangscode[] {
  return sichtbareZugangskonten(fuer).map((k) => {
    const geheimnis = base32Dekodieren(k.secret);
    const personen = k.sichtbarkeit === 'personen' ? kreisPersonen(k.id) : [];
    const nurIch = personen.length === 1 && personen[0]!.id === fuer.id;
    const darf = darfZugangBearbeiten(fuer, k);
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
      gruppe: k.sichtbarkeit === 'alle' ? 'alle' : nurIch ? 'selbst' : 'geteilt',
      darfBearbeiten: darf,
      kreis: darf
        ? {sichtbarkeit: k.sichtbarkeit, rollen: kreisRollen(k.id), personen: personen.map((p) => p.id)}
        : null,
    };
  });
}
