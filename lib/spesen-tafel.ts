// Die Brücke vom Datensatz zur Tafel: eine Reise plus die gestempelten Tage,
// auf die sie sich beruft, als flaches Objekt für die Client-Komponente.
//
// Eigenes Modul, weil lib/time.ts bereits lib/spesen.ts benutzt (der
// Monatsabschluss fragt nach eingereichten Reisen) — ein Mapper, der beide
// braucht, muss darüber liegen und nicht dazwischen.

import type {ReiseAnsicht} from '@/components/reise-tafel';
import type {User} from './db';
import {hatRecht} from './rechte';
import {TAG_ART_LABEL} from './pauschale';
import {BELEG_ART_LABEL, REISE_STATUS_LABEL, istVorbei, type ReiseMitRechnung} from './spesen';
import {segmentsForDay} from './time';

export function reiseAnsicht(
  eintrag: ReiseMitRechnung,
  actor: User,
  userName: string | null = null,
): ReiseAnsicht {
  const {reise, rechnung, belege, locked} = eintrag;
  const darfAendern = hatRecht(actor, 'spesen.pruefen') || actor.id === reise.user_id;
  const genehmigtGesperrt = reise.status === 'genehmigt' && !hatRecht(actor, 'spesen.pruefen');

  return {
    id: reise.id,
    userName,
    startDate: reise.start_date,
    startMin: reise.start_min,
    endDate: reise.end_date,
    endMin: reise.end_min,
    zweck: reise.zweck,
    ziel: reise.ziel,
    status: reise.status,
    statusLabel: REISE_STATUS_LABEL[reise.status],
    entscheidungNotiz: reise.entscheidung_notiz,
    eingereichtAm: reise.eingereicht_at,
    abwesenheitMin: rechnung.abwesenheitMin,
    pauschaleCent: rechnung.pauschaleCent,
    belegeCent: rechnung.belegeCent,
    summeCent: rechnung.summeCent,
    locked,
    saetzeAktuell: eintrag.saetzeAktuell,
    tage: rechnung.tage.map((tag) => ({
      datum: tag.datum,
      art: tag.art,
      artLabel: TAG_ART_LABEL[tag.art],
      grund: tag.grund,
      abwesenheitMin: tag.abwesenheitMin,
      satzCent: tag.satzCent,
      vonMin: tag.vonMin,
      bisMin: tag.bisMin,
      erfuellt: tag.satzCent > 0,
      schwelleMin: tag.schwelleMin,
      // Der gestempelte Tag steht neben der Behauptung — genau das prüft die
      // Verwaltung, und der Mitarbeiter sieht dieselbe Grundlage.
      segments: segmentsForDay(reise.user_id, tag.datum),
    })),
    belege: belege.map((beleg) => ({
      id: beleg.id,
      artLabel: BELEG_ART_LABEL[beleg.art],
      datum: beleg.datum,
      betragCent: beleg.betrag_cent,
      beschreibung: beleg.beschreibung,
      hatDatei: beleg.datei !== null,
    })),
    darfBearbeiten: darfAendern && !locked && !genehmigtGesperrt,
    darfEinreichen:
      actor.id === reise.user_id &&
      !locked &&
      (reise.status === 'entwurf' || reise.status === 'abgelehnt') &&
      istVorbei(reise),
    darfZurueckziehen: actor.id === reise.user_id && reise.status === 'eingereicht',
    darfPruefen: hatRecht(actor, 'spesen.pruefen') && reise.status === 'eingereicht',
  };
}
