// Wer wann was erfährt — die Bedeutung des E-Mail-Versands.
//
// Die Teilung ist dieselbe wie überall im Haus: `lib/mail-arten.ts` ist das
// Vokabular (rein, Client-importierbar), `lib/mail.ts` der Versand (kennt nur
// Adresse und Betreff), und hier steht, welches Ereignis welchen Kreis
// erreicht und was in der Nachricht steht.
//
// Vier Regeln, die den Rest tragen:
//
//   1. **Wer entscheidet, wird benachrichtigt — nicht wer eine Rolle trägt.**
//      Der Empfängerkreis kommt aus `hatRecht(…, 'abwesenheit.pruefen')`, nie
//      aus `role === 'verwaltung'`. Ein Konto mit dem Zusatzrecht bekommt die
//      Post, ein Verwaltungskonto ohne es nicht.
//   2. **Niemand bekommt Post über sich selbst.** Reicht die Verwaltung ihren
//      eigenen Urlaub ein, wartet nichts auf sie — sie hat es gerade getan.
//   3. **Krank verlässt das Haus nur als „Abwesend".** Dieselbe Regel wie im
//      Google-Kalender, aus demselben Grund und aus derselben Funktion
//      (`ausserHausLabel`): ein Mailversender ist ein fremder Server, und eine
//      Gesundheitsangabe nach Art. 9 DSGVO hat dort nichts verloren. Wer die
//      Art wissen darf, sieht sie in der Anwendung.
//   4. **Nichts hier hält je eine Buchung auf.** Jede `melde…`-Funktion wirft
//      nicht (der Versand tut es schon nicht) und wird nach der Buchung
//      aufgerufen, nie davor.
//
// Und eine fünfte, die aus dem Betrieb kam: **der Prüfkreis bekommt keine
// Eingangspost.** Dass ein Antrag oder eine Abrechnung eingereicht wurde, steht
// in der Warteschlange der Anwendung, mit Zähler an der Seitenleiste; eine Mail
// darüber wiederholt nur, was ohnehin auf dem Bildschirm steht, und wer sie
// wegklickt, klickt die nächste gleich mit weg. Was die Anwendung *nicht* sagt,
// ist die verstrichene Zeit — deshalb gibt es statt `meldeReiseEingereicht()`
// nun `erinnereAnReise()`, ausgelöst von `lib/erinnerungen.ts`, wenn ein
// Vorgang wirklich liegen geblieben ist. Eine *Meldung* (Krank, Fortbildung)
// geht weiter sofort hinaus: sie ist keine Warteschlange, sondern die Tatsache,
// dass heute jemand fehlt.
//
// Die `inhalt…`-Bauer sind rein und einzeln geprüft (tests/mail.test.ts): sie
// bekommen Zahlen und geben eine Nutzlast zurück. Was gesagt wird, lässt sich
// so festhalten, ohne eine Datenbank oder ein Postfach zu brauchen.

import {getDb, type Abwesenheit, type Reise, type User} from './db';
import {ausserHausLabel, fmtTage, istAntrag, laengeInTagen} from './abwesenheit-arten';
import {fmtDate, fmtDateRange, fmtDuration, fmtDurationSigned, fmtEuro, fmtMonth} from './format';
import {MAIL_ARTEN, type MailArt, type MailInhalt} from './mail-arten';
import {sendeAnAlle, sendeMail, type VersandErgebnis} from './mail';
import {effektiveRechte, hatRecht, rolleLabel, type Recht} from './rechte';
// Die Abbestellung ist eine Spalte an `users` und liegt deshalb dort, wo der
// Personalstamm liegt — dieses Modul liest sie nur.
import {abbestellteAus} from './users';
import type {SpesenRechnung} from './pauschale';

// ---------------------------------------------------------------------------
// Empfänger
// ---------------------------------------------------------------------------

export interface Empfaenger {
  id: number;
  name: string;
  email: string;
  abbestellt: MailArt[];
}

/** Der Vorname als Anrede — ein Haus mit einem Dutzend Leuten siezt sich nicht. */
export function anrede(name: string): string {
  return name.trim().split(/\s+/)[0] || name.trim();
}

/** Ob dieser Empfänger diese Art bekommen möchte. Zugangspost lässt sich nicht abbestellen. */
export function willEmpfangen(empfaenger: Empfaenger, art: MailArt): boolean {
  if (!MAIL_ARTEN[art].abwaehlbar) return true;
  return !empfaenger.abbestellt.includes(art);
}

interface KontoZeile {
  id: number;
  name: string;
  email: string;
  role: string;
  mail_abbestellt: string;
}

function konto(userId: number): Empfaenger | null {
  const row = getDb()
    .query<KontoZeile, [number]>(
      'SELECT id, name, email, role, mail_abbestellt FROM users WHERE id = ? AND active = 1',
    )
    .get(userId);
  return row ? {id: row.id, name: row.name, email: row.email, abbestellt: abbestellteAus(row.mail_abbestellt)} : null;
}

/**
 * Alle aktiven Konten, die ein Recht tragen — Rollenbündel *oder* Zusatzrecht.
 * Der Zuschnitt kann nicht ins SQL: welche Rolle welches Recht enthält, weiß
 * `lib/rechte.ts`, und genau darin liegt der Sinn des Vokabulars.
 */
export function empfaengerMitRecht(recht: Recht, ausserId?: number): Empfaenger[] {
  const db = getDb();
  const rows = db
    .query<KontoZeile, []>('SELECT id, name, email, role, mail_abbestellt FROM users WHERE active = 1 ORDER BY name')
    .all();
  return rows
    .filter((row) => {
      if (row.id === ausserId) return false;
      const extra = db
        .query<{recht: string}, [number]>('SELECT recht FROM benutzer_rechte WHERE user_id = ?')
        .all(row.id)
        .map((r) => r.recht);
      return hatRecht({role: row.role, rechte: effektiveRechte(row.role, extra)}, recht);
    })
    .map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      abbestellt: abbestellteAus(row.mail_abbestellt),
    }));
}

// ---------------------------------------------------------------------------
// Die Nutzlasten — rein, ohne Datenbank
// ---------------------------------------------------------------------------

export interface SpanneAngaben {
  /**
   * Wessen Abwesenheit. Nur für die Post an den Prüfkreis — in der Nachricht an
   * die betroffene Person selbst wäre eine Zeile „Mitarbeiter: du" Lärm, und
   * deshalb bleibt das Feld dort weg, statt leer gesetzt zu werden.
   */
  person?: string;
  art: Abwesenheit['art'];
  von: string;
  bis: string;
  /** Was der Antrag vom Jahresanspruch kostet; null, wo es nichts kostet. */
  anspruchstage?: number | null;
  notiz?: string | null;
}

/** Dieselbe Spanne, aber mit benanntem Träger — was der Prüfkreis bekommt. */
export type SpanneMitPerson = SpanneAngaben & {person: string};

function spanneAngabenListe(d: SpanneAngaben) {
  return [
    ...(d.person ? [{label: 'Mitarbeiter', wert: d.person}] : []),
    {label: 'Art', wert: ausserHausLabel(d.art)},
    {label: 'Zeitraum', wert: fmtDateRange(d.von, d.bis)},
    {label: 'Dauer', wert: fmtTage(laengeInTagen(d.von, d.bis))},
    ...(d.anspruchstage != null ? [{label: 'Anspruchstage', wert: fmtTage(d.anspruchstage)}] : []),
    /* Krank trägt kein Notizfeld — weder im Datensatz noch hier. Der Filter ist
       trotzdem da: eine Nutzlast, die sich auf „das Feld gibt es nicht" verlässt,
       verliert die Regel beim ersten Umbau. */
    ...(d.notiz && d.art !== 'krank' ? [{label: 'Notiz', wert: d.notiz}] : []),
  ];
}

/** Ein Antrag liegt seit Tagen — an den Prüfkreis, als Erinnerung. */
export function inhaltAbwesenheitErinnerung(d: SpanneMitPerson & {tage: number}): MailInhalt {
  return {
    betreff: `Seit ${fmtTage(d.tage)} offen: ${ausserHausLabel(d.art)} ${fmtDateRange(d.von, d.bis)} – ${d.person}`,
    titel: 'Ein Antrag liegt noch',
    vorspann: `${d.person} hat vor ${fmtTage(d.tage)} ${ausserHausLabel(d.art)} vom ${fmtDate(d.von)} bis ${fmtDate(d.bis)} beantragt – entschieden ist noch nichts. Solange der Antrag offen ist, kann ${anrede(d.person)} nicht planen.`,
    ton: 'warnung',
    angaben: [...spanneAngabenListe(d), {label: 'Wartet seit', wert: fmtTage(d.tage)}],
    ziel: {label: 'Antrag prüfen', pfad: '/abwesenheit/pruefen'},
    nachsatz:
      'Diese Erinnerung kommt erst, wenn ein Antrag liegen bleibt – der Eingang selbst steht in der Anwendung.',
  };
}

/** Eine Meldung gilt sofort — an den Prüfkreis, zur Kenntnis, nicht zur Entscheidung. */
export function inhaltAbwesenheitGemeldet(d: SpanneMitPerson): MailInhalt {
  const draussen = ausserHausLabel(d.art);
  return {
    betreff: `${draussen}: ${d.person}, ${fmtDateRange(d.von, d.bis)}`,
    titel: `${d.person} ist abwesend`,
    vorspann: `Für ${d.person} wurde ${draussen} vom ${fmtDate(d.von)} bis ${fmtDate(d.bis)} erfasst. Eine Meldung gilt sofort und wartet auf keine Entscheidung.`,
    ton: 'hinweis',
    angaben: spanneAngabenListe(d),
    ziel: {label: 'Im Teamkalender ansehen', pfad: '/kalender'},
    /* Der Grund steht bewusst nicht in der Nachricht, wenn er eine
       Gesundheitsangabe wäre — siehe Regel 3 im Kopfkommentar. */
    nachsatz:
      d.art === 'krank'
        ? 'Die Art dieser Abwesenheit steht nur im Hub, nicht in dieser Nachricht.'
        : null,
  };
}

export interface EntscheidungAngaben extends SpanneAngaben {
  genehmigt: boolean;
  /** Die Begründung einer Zurückweisung. */
  grund?: string | null;
  entschiedenVon: string;
  selbstGenehmigt?: boolean;
  /** Was nach dieser Entscheidung noch frei ist; null, wo kein Anspruch berührt wird. */
  restanspruch?: number | null;
}

/** Die Entscheidung — an die betroffene Person. */
export function inhaltAbwesenheitEntschieden(d: EntscheidungAngaben): MailInhalt {
  const draussen = ausserHausLabel(d.art);
  const zeitraum = fmtDateRange(d.von, d.bis);
  return {
    betreff: d.genehmigt
      ? `Genehmigt: ${draussen} ${zeitraum}`
      : `Zurückgewiesen: ${draussen} ${zeitraum}`,
    titel: d.genehmigt ? 'Dein Antrag ist genehmigt' : 'Dein Antrag wurde zurückgewiesen',
    vorspann: d.genehmigt
      ? `${draussen} vom ${fmtDate(d.von)} bis ${fmtDate(d.bis)} ist genehmigt und steht ab sofort in deinem Kalender.`
      : `${draussen} vom ${fmtDate(d.von)} bis ${fmtDate(d.bis)} wurde nicht genehmigt. Der Antrag steht wieder als Entwurf bei dir – du kannst ihn ändern und erneut einreichen.`,
    ton: d.genehmigt ? 'erfolg' : 'warnung',
    angaben: [
      ...spanneAngabenListe(d),
      {label: 'Entschieden von', wert: d.entschiedenVon},
      ...(d.restanspruch != null ? [{label: 'Resturlaub', wert: fmtTage(d.restanspruch)}] : []),
    ],
    hinweis: d.grund?.trim() ? {titel: 'Begründung', text: d.grund.trim()} : null,
    ziel: {label: 'Abwesenheit öffnen', pfad: '/abwesenheit'},
    /* Es gibt keine Instanz über der Verwaltung. Dass sie sich selbst
       genehmigt hat, steht im Datensatz und gehört auch in die Nachricht —
       benannt statt still zugelassen, wie im Protokoll. */
    nachsatz: d.selbstGenehmigt ? 'Diese Abwesenheit wurde von der Verwaltung selbst genehmigt.' : null,
  };
}

export interface ReiseAngaben {
  /** Wessen Reise — nur für die Post an den Prüfkreis, wie bei SpanneAngaben. */
  person?: string;
  zweck: string;
  ziel: string | null;
  von: string;
  bis: string;
  rechnung: Pick<SpesenRechnung, 'pauschaleCent' | 'belegeCent' | 'summeCent'>;
  belege: number;
}

export type ReiseMitPerson = ReiseAngaben & {person: string};

function reiseAngabenListe(d: ReiseAngaben) {
  return [
    ...(d.person ? [{label: 'Mitarbeiter', wert: d.person}] : []),
    {label: 'Zweck', wert: d.zweck},
    ...(d.ziel ? [{label: 'Ziel', wert: d.ziel}] : []),
    {label: 'Zeitraum', wert: fmtDateRange(d.von, d.bis)},
    {label: 'Verpflegungspauschale', wert: fmtEuro(d.rechnung.pauschaleCent)},
    {label: `Belege (${d.belege})`, wert: fmtEuro(d.rechnung.belegeCent)},
    {label: 'Summe', wert: fmtEuro(d.rechnung.summeCent), betont: true},
  ];
}

/** Eine Abrechnung liegt seit Tagen — an den Prüfkreis, als Erinnerung. */
export function inhaltReiseErinnerung(d: ReiseMitPerson & {tage: number}): MailInhalt {
  return {
    betreff: `Seit ${fmtTage(d.tage)} offen: ${d.zweck} – ${d.person}`,
    titel: 'Eine Abrechnung liegt noch',
    vorspann: `${d.person} hat die Reise „${d.zweck}" (${fmtDateRange(d.von, d.bis)}) vor ${fmtTage(d.tage)} eingereicht – geprüft ist sie noch nicht. Die Sätze sind eingefroren, der Betrag ändert sich also nicht mehr; es fehlt nur die Entscheidung.`,
    ton: 'warnung',
    angaben: [...reiseAngabenListe(d), {label: 'Wartet seit', wert: fmtTage(d.tage)}],
    ziel: {label: 'Abrechnung prüfen', pfad: '/spesen/pruefen'},
    nachsatz:
      'Diese Erinnerung kommt erst, wenn eine Abrechnung liegen bleibt – der Eingang selbst steht in der Anwendung.',
  };
}

export interface ReiseEntscheidungAngaben extends ReiseAngaben {
  genehmigt: boolean;
  grund?: string | null;
  entschiedenVon: string;
}

export function inhaltReiseEntschieden(d: ReiseEntscheidungAngaben): MailInhalt {
  return {
    betreff: d.genehmigt
      ? `Genehmigt: ${d.zweck} – ${fmtEuro(d.rechnung.summeCent)}`
      : `Zurückgewiesen: ${d.zweck}`,
    titel: d.genehmigt ? 'Deine Abrechnung ist genehmigt' : 'Deine Abrechnung kommt zurück',
    vorspann: d.genehmigt
      ? `Die Reise „${d.zweck}" (${fmtDateRange(d.von, d.bis)}) ist genehmigt. Die Auszahlung läuft über die Lohnabrechnung.`
      : `Die Reise „${d.zweck}" (${fmtDateRange(d.von, d.bis)}) wurde zurückgewiesen und steht wieder als Entwurf bei dir. Nach der Änderung lässt sie sich erneut einreichen.`,
    ton: d.genehmigt ? 'erfolg' : 'warnung',
    angaben: [...reiseAngabenListe(d), {label: 'Entschieden von', wert: d.entschiedenVon}],
    hinweis: d.grund?.trim() ? {titel: 'Begründung', text: d.grund.trim()} : null,
    ziel: {label: 'Reisen & Spesen öffnen', pfad: '/spesen'},
  };
}

export interface AbschlussAngaben {
  monat: string;
  istMin: number;
  sollMin: number;
  saldoMin: number;
  abgeschlossenVon: string;
}

export function inhaltMonatAbgeschlossen(d: AbschlussAngaben): MailInhalt {
  return {
    betreff: `${fmtMonth(d.monat)} ist abgeschlossen`,
    titel: `${fmtMonth(d.monat)} ist abgeschlossen`,
    vorspann: `Dein ${fmtMonth(d.monat)} ist geprüft und abgeschlossen. Der Monat ist damit schreibgeschützt – wenn etwas fehlt, meldest du dich bitte bei der Verwaltung, die ihn wieder öffnen kann.`,
    ton: 'hinweis',
    angaben: [
      {label: 'Ist', wert: fmtDuration(d.istMin)},
      {label: 'Soll', wert: fmtDuration(d.sollMin)},
      {label: 'Saldo', wert: fmtDurationSigned(d.saldoMin)},
      {label: 'Abgeschlossen von', wert: d.abgeschlossenVon},
    ],
    ziel: {label: 'Monat ansehen', pfad: `/?ansicht=monat&tag=${d.monat}-01`},
  };
}

export interface ZugangAngaben {
  name: string;
  email: string;
  passwort: string;
  rolle: string;
  wochenstunden: number;
}

export function inhaltWillkommen(d: ZugangAngaben): MailInhalt {
  return {
    betreff: 'Dein Zugang zum MedArbeiter Hub',
    titel: 'Willkommen im MedArbeiter Hub',
    vorspann:
      'Für dich ist ein Konto in der Zeiterfassung des Hauses angelegt. Melde dich mit den Zugangsdaten unten an – beim ersten Anmelden wirst du gebeten, ein eigenes Passwort zu setzen, und der Assistent führt dich durch die restliche Einrichtung.',
    ton: 'hinweis',
    angaben: [
      {label: 'Anmeldename', wert: d.email},
      {label: 'Rolle', wert: d.rolle},
      {label: 'Wochenstunden', wert: `${(d.wochenstunden).toFixed(2).replace('.', ',')} h`},
    ],
    hinweis: {titel: 'Startpasswort', text: d.passwort},
    ziel: {label: 'Jetzt anmelden', pfad: '/login'},
    nachsatz:
      'Das Startpasswort gilt nur für die erste Anmeldung. Bewahre diese Nachricht nicht auf – nach dem Wechsel ist sie wertlos.',
  };
}

export function inhaltZugangscodeLoeschenBestaetigen(d: {name: string; pfad: string}): MailInhalt {
  return {
    betreff: `Löschung bestätigen: ${d.name}`,
    titel: 'Zugangscode löschen?',
    vorspann: `Du hast das Entfernen von „${d.name}" angestoßen. Der Code verschwindet erst, wenn du den Link unten öffnest – ohne Klick bleibt er bestehen.`,
    ton: 'warnung',
    angaben: [{label: 'Zugang', wert: d.name}],
    ziel: {label: 'Löschung bestätigen', pfad: d.pfad},
    nachsatz: 'Der Link ist 30 Minuten gültig. War das nicht du, ignoriere diese Nachricht einfach.',
  };
}

export function inhaltPasswortZurueckgesetzt(d: {passwort: string; zurueckgesetztVon: string}): MailInhalt {
  return {
    betreff: 'Dein Passwort wurde zurückgesetzt',
    titel: 'Neues Startpasswort',
    vorspann:
      'Dein Passwort im MedArbeiter Hub wurde zurückgesetzt. Alle offenen Sitzungen sind beendet; melde dich mit dem Passwort unten neu an und setze anschließend ein eigenes.',
    ton: 'warnung',
    angaben: [{label: 'Zurückgesetzt von', wert: d.zurueckgesetztVon}],
    hinweis: {titel: 'Startpasswort', text: d.passwort},
    ziel: {label: 'Jetzt anmelden', pfad: '/login'},
    nachsatz:
      'Hast du das nicht veranlasst und wurdest auch nicht darauf angesprochen? Dann melde dich bitte bei der Verwaltung.',
  };
}

// ---------------------------------------------------------------------------
// Die Meldungen — datenbankgebunden, jede nach der Buchung aufgerufen
// ---------------------------------------------------------------------------

/**
 * Gibt zurück, an wie viele Postfächer die Nachricht ging — nicht ob sie
 * ankam (das steht im Versandbuch). Ein Kreis, der nach dem Abzug der
 * betroffenen Person und der Abbestellungen leer ist, ist keine verschickte
 * Nachricht, und ein Aufrufer, der mitzählt, darf sich nicht anders erinnern
 * als der Posteingang.
 */
async function anKreis(recht: Recht, art: MailArt, betrifftId: number, inhalt: MailInhalt): Promise<number> {
  const kreis = empfaengerMitRecht(recht, betrifftId).filter((e) => willEmpfangen(e, art));
  await sendeAnAlle(
    kreis.map((e) => ({art, an: e.email, anrede: anrede(e.name), betrifftId, inhalt})),
  );
  return kreis.length;
}

async function anPerson(userId: number, art: MailArt, inhalt: MailInhalt): Promise<void> {
  const empfaenger = konto(userId);
  if (!empfaenger || !willEmpfangen(empfaenger, art)) return;
  await sendeMail({art, an: empfaenger.email, anrede: anrede(empfaenger.name), betrifftId: userId, inhalt});
}

/**
 * Eine Abwesenheit wurde gemeldet — Krank oder Fortbildung, und damit eine
 * Tatsache über einen Tag, an dem jemand nicht da ist. Ein *Antrag* löst hier
 * nichts aus: dass er wartet, steht in der Warteschlange der Anwendung, und
 * Post gibt es erst, wenn er liegen bleibt (`lib/erinnerungen.ts`).
 */
export async function meldeAbwesenheitEingegangen(
  a: Abwesenheit,
  person: string,
  anspruchstage?: number | null,
): Promise<void> {
  if (istAntrag(a.art)) return;
  const angaben: SpanneMitPerson = {
    person,
    art: a.art,
    von: a.von,
    bis: a.bis,
    anspruchstage: anspruchstage ?? null,
    notiz: a.notiz,
  };
  await anKreis('abwesenheit.pruefen', 'abwesenheit.gemeldet', a.user_id, inhaltAbwesenheitGemeldet(angaben));
}

/**
 * Die Erinnerung an einen liegen gebliebenen Antrag — an den Prüfkreis. Gibt
 * zurück, wie viele Postfächer sie erreicht hat: bleibt nach dem Abzug der
 * betroffenen Person niemand übrig, hat auch niemand eine Mahnung bekommen.
 */
export async function erinnereAnAbwesenheit(
  a: Abwesenheit,
  person: string,
  tage: number,
  anspruchstage?: number | null,
): Promise<number> {
  return anKreis(
    'abwesenheit.pruefen',
    'abwesenheit.erinnerung',
    a.user_id,
    inhaltAbwesenheitErinnerung({
      person,
      art: a.art,
      von: a.von,
      bis: a.bis,
      anspruchstage: anspruchstage ?? null,
      notiz: a.notiz,
      tage,
    }),
  );
}

export async function meldeAbwesenheitEntschieden(
  a: Abwesenheit,
  entschiedenVon: string,
  genehmigt: boolean,
  restanspruch?: number | null,
): Promise<void> {
  await anPerson(
    a.user_id,
    'abwesenheit.entschieden',
    inhaltAbwesenheitEntschieden({
      art: a.art,
      von: a.von,
      bis: a.bis,
      notiz: a.notiz,
      genehmigt,
      grund: a.entscheidung_notiz,
      entschiedenVon,
      selbstGenehmigt: a.selbst_genehmigt === 1,
      restanspruch: restanspruch ?? null,
    }),
  );
}

function reiseAngaben(reise: Reise, rechnung: SpesenRechnung, belege: number): ReiseAngaben {
  return {
    zweck: reise.zweck,
    ziel: reise.ziel,
    von: reise.start_date,
    bis: reise.end_date,
    rechnung,
    belege,
  };
}

/** Die Erinnerung an eine liegen gebliebene Abrechnung — an den Prüfkreis. */
export async function erinnereAnReise(
  reise: Reise,
  person: string,
  rechnung: SpesenRechnung,
  belege: number,
  tage: number,
): Promise<number> {
  return anKreis(
    'spesen.pruefen',
    'reise.erinnerung',
    reise.user_id,
    inhaltReiseErinnerung({...reiseAngaben(reise, rechnung, belege), person, tage}),
  );
}

export async function meldeReiseEntschieden(
  reise: Reise,
  entschiedenVon: string,
  genehmigt: boolean,
  rechnung: SpesenRechnung,
  belege: number,
): Promise<void> {
  await anPerson(
    reise.user_id,
    'reise.entschieden',
    inhaltReiseEntschieden({
      ...reiseAngaben(reise, rechnung, belege),
      genehmigt,
      grund: reise.entscheidung_notiz,
      entschiedenVon,
    }),
  );
}

export async function meldeMonatAbgeschlossen(userId: number, d: AbschlussAngaben): Promise<void> {
  await anPerson(userId, 'monat.abgeschlossen', inhaltMonatAbgeschlossen(d));
}

/**
 * Die Zugangspost. Anders als alles andere hier geht sie an eine Adresse, hinter
 * der noch niemand angemeldet war — deshalb steht das Konto noch nicht in
 * `konto()`s Bedingungen und die Adresse kommt vom Aufrufer.
 */
export async function meldeWillkommen(
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'weekly_minutes'>,
  passwort: string,
): Promise<VersandErgebnis> {
  return sendeMail({
    art: 'zugang.willkommen',
    an: user.email,
    anrede: anrede(user.name),
    betrifftId: user.id,
    inhalt: inhaltWillkommen({
      name: user.name,
      email: user.email,
      passwort,
      rolle: rolleLabel(user.role),
      wochenstunden: user.weekly_minutes / 60,
    }),
  });
}

export async function meldeZugangscodeLoeschenBestaetigen(
  actor: Pick<User, 'id' | 'name' | 'email'>,
  name: string,
  token: string,
): Promise<VersandErgebnis> {
  return sendeMail({
    art: 'zugang.zugangscode-loeschen',
    an: actor.email,
    anrede: anrede(actor.name),
    betrifftId: actor.id,
    inhalt: inhaltZugangscodeLoeschenBestaetigen({
      name,
      pfad: `/api/zugangscode/loeschen-bestaetigen?token=${encodeURIComponent(token)}`,
    }),
  });
}

export async function meldePasswortZurueckgesetzt(
  user: Pick<User, 'id' | 'name' | 'email'>,
  passwort: string,
  zurueckgesetztVon: string,
): Promise<VersandErgebnis> {
  return sendeMail({
    art: 'zugang.passwort',
    an: user.email,
    anrede: anrede(user.name),
    betrifftId: user.id,
    inhalt: inhaltPasswortZurueckgesetzt({passwort, zurueckgesetztVon}),
  });
}
