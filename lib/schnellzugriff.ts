import {getDb, type User} from './db';
import {addDays, addMonths, monthOf, todayISO} from './format';
import {hatRecht} from './rechte';
import {activeUsers, clockState, isMonthLocked, zeitkontoBalance} from './time';
import {reisenZurPruefung} from './spesen';
import {AU_AB_TAGEN} from './abwesenheit-arten';

/**
 * Die Zahlen, die in der Seitenleiste neben den Einträgen stehen.
 *
 * Alles an einer Stelle und einmal je Seitenaufbau: die Navigation soll sagen,
 * wo etwas liegt, das jemanden angeht — aber sie darf dafür nicht auf jeder
 * Route acht Abfragen kosten. Reine Daten, keine Funktionen: die Seitenleiste
 * ist eine Client-Komponente, und über diese Grenze geht nur, was sich
 * serialisieren lässt.
 *
 * Eine Zahl erscheint nur, wenn sie eine Handlung nach sich zieht. „0 offen"
 * ist keine Nachricht, sondern Lärm — deshalb steht überall 0 für „kein
 * Zeichen", nicht für „eine Null anzeigen".
 */
export interface NavZaehler {
  /** Eigene vergangene Tage, die eine Korrektur brauchen. */
  korrekturen: number;
  /** Eigene Reisen im Entwurf, die vorbei sind und eingereicht werden könnten. */
  entwuerfe: number;
  /** Verwaltung: eingereichte Reisen, die auf eine Entscheidung warten. */
  zuPruefen: number;
  /** Eigene Abwesenheitsanträge im Entwurf — gestellt, aber nicht abgeschickt. */
  abwesenheitEntwuerfe: number;
  /** Eigene Krankmeldungen ab drei Tagen ohne Bescheinigung (§ 5 EFZG). */
  auFehlt: number;
  /** Verwaltung: eingereichte Abwesenheitsanträge ohne Entscheidung. */
  abwesenheitZuPruefen: number;
  /** Verwaltung: Mitarbeitende ohne Abschluss im Vormonat. */
  offeneAbschluesse: number;
  /** Verwaltung: wie viele gerade eingestempelt sind. */
  teamAktiv: number;
  /**
   * Wie viele im Team heute abwesend sind — und wie viele in den nächsten zwei
   * Wochen. Für alle, nicht nur für die Verwaltung: „wer ist da" ist die Frage
   * eines Kollegen. Gezählt wird nur, was feststeht (genehmigt oder gemeldet);
   * ein Antrag bindet nichts, und die *Art* der Abwesenheit steht hier nie —
   * eine Zahl neben einem Navigationseintrag ist kein Ort für eine
   * Gesundheitsangabe.
   */
  heuteAbwesend: number;
  abwesendDemnaechst: number;
  /**
   * Der eigene Zeitkontostand — für den Tagesstand über der Kontozeile. Bis
   * *gestern* gerechnet, genau wie die Karte auf „Meine Zeit": der laufende Tag
   * gehört in die Bahn daneben und nicht in eine Bilanz, die sich bis zum
   * Feierabend noch ändert. Dieselbe Zahl an beiden Orten, aus derselben
   * Rechnung — sonst stünde in der Leiste eine zweite Wahrheit.
   */
  kontoSaldoMin: number;
}

export function navZaehler(user: User, korrekturen: number): NavZaehler {
  const heute = todayISO();

  const entwuerfe = getDb()
    .query<{c: number}, [number, string]>(
      "SELECT count(*) AS c FROM reisen WHERE user_id = ? AND status = 'entwurf' AND end_date < ?",
    )
    .get(user.id, heute)!.c;

  const abwesenheitEntwuerfe = getDb()
    .query<{c: number}, [number]>(
      "SELECT count(*) AS c FROM abwesenheiten WHERE user_id = ? AND status = 'entwurf'",
    )
    .get(user.id)!.c;

  // Die Zahl der Tage steht im Datensatz nicht; sie ist die Spanne selbst.
  // julianday statt einer Schleife, damit die Seitenleiste eine Abfrage bleibt.
  const auFehlt = getDb()
    .query<{c: number}, [number, number]>(
      `SELECT count(*) AS c FROM abwesenheiten WHERE user_id = ? AND art = 'krank'
       AND au_datei IS NULL AND julianday(bis) - julianday(von) + 1 >= ?`,
    )
    .get(user.id, AU_AB_TAGEN)!.c;

  // Eine Abfrage für beide Zahlen: die Spannen, die heute bzw. in den nächsten
  // vierzehn Tagen wirksam sind. `DISTINCT user_id`, weil zwei Spannen
  // derselben Person eine Person sind.
  const in14 = addDays(heute, 14);
  const abwesendeAm = (von: string, bis: string): number =>
    getDb()
      .query<{c: number}, [string, string]>(
        `SELECT count(DISTINCT a.user_id) AS c FROM abwesenheiten a
         JOIN users u ON u.id = a.user_id AND u.active = 1
         WHERE a.status IN ('genehmigt', 'gemeldet') AND a.von <= ? AND a.bis >= ?`,
      )
      .get(bis, von)!.c;

  const heuteAbwesend = abwesendeAm(heute, heute);
  const abwesendDemnaechst = abwesendeAm(addDays(heute, 1), in14);
  const kontoSaldoMin = zeitkontoBalance(user, addDays(heute, -1));

  // Jede Zahl folgt dem Recht, hinter dem ihr Eintrag liegt — nicht mehr der
  // Rolle als Ganzem: wer nur Spesen prüfen darf, sieht nur diese Warteschlange.
  const vormonat = addMonths(monthOf(heute), -1);
  let teamAktiv = 0;
  let offeneAbschluesse = 0;
  if (hatRecht(user, 'zeit.team') || hatRecht(user, 'abschluss.verwalten')) {
    for (const u of activeUsers()) {
      if (hatRecht(user, 'zeit.team') && clockState(u.id).status === 'arbeit') teamAktiv += 1;
      if (hatRecht(user, 'abschluss.verwalten') && !isMonthLocked(u.id, vormonat)) offeneAbschluesse += 1;
    }
  }

  return {
    korrekturen,
    entwuerfe,
    abwesenheitEntwuerfe,
    auFehlt,
    heuteAbwesend,
    abwesendDemnaechst,
    kontoSaldoMin,
    zuPruefen: hatRecht(user, 'spesen.pruefen') ? reisenZurPruefung('eingereicht').length : 0,
    abwesenheitZuPruefen: hatRecht(user, 'abwesenheit.pruefen')
      ? getDb()
          .query<{c: number}, []>("SELECT count(*) AS c FROM abwesenheiten WHERE status = 'eingereicht'")
          .get()!.c
      : 0,
    offeneAbschluesse,
    teamAktiv,
  };
}
