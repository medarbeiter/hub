import {ART_LABEL, ausserHausLabel, restanspruch, sichtbareArt} from './abwesenheit-arten';
import {abwesenheitAmTag, anspruchFor} from './abwesenheit';
import type {PersonAngabe} from './avatar';
import type {User} from './db';
import {addDays, todayISO} from './format';
import {kommentareFuer, type ProfilKommentar} from './profil-kommentare';
import {hatRecht} from './rechte';
import {clockState, getUser, stalePastOpenSegments, zeitkontoBalance, type ClockState} from './time';
import {personAngabeById} from './users';
import {publicGoals, type PublicGoal} from './ziele';

/**
 * Alles, was die Personenkarte zeigt — in **einer** Antwort, zugeschnitten auf
 * den, der fragt.
 *
 * Vorher holte die Karte drei Adressen nacheinander und hängte jeden Abschnitt,
 * sobald seine Antwort da war: drei Ankünfte, drei Sprünge. Jetzt kommt eine
 * Nutzlast, und die Karte wechselt einmal vom Gerüst zum Inhalt.
 *
 * **Der Zuschnitt liegt hier, nicht im Browser.** `einblick` fehlt als
 * Schlüssel ganz, wenn der Betrachter nichts davon sehen darf — ein Kollege
 * bekommt keinen leeren Kasten, den ein Schalter aufmachen könnte. Jede Zahl
 * und jeder Weg hängt an genau einem Recht (oder daran, dass es die eigene
 * Karte ist), dieselbe Haltung wie `suche()` und `sichtbarFuer`.
 *
 * Der heutige Tag folgt der Regel des Teamkalenders: wer `kalender.gruende`
 * trägt oder selbst gemeint ist, liest die Art, alle anderen nur „Abwesend"
 * (`sichtbareArt` → `ausserHausLabel`, eine Kopie der Regel).
 */
export interface Weg {
  art: 'zeitblatt' | 'konto' | 'protokoll' | 'bearbeiten' | 'profil' | 'ziele';
  href: string;
  text: string;
}

export interface Einblick {
  /** Läuft gerade ein Eintrag? (`zeit.team` oder selbst) */
  status?: ClockState;
  /** Zeitkonto bis gestern in Minuten (`zeit.team` oder selbst). */
  zeitkontoMin?: number;
  /** Vergangene Tage mit offenem Eintrag (`zeit.team` oder selbst). */
  offeneTage?: number;
  /** Resturlaub in Tagen für dieses Jahr (`abwesenheit.pruefen` oder selbst). */
  resturlaub?: number;
  wege: Weg[];
}

export interface PersonenKarte {
  person: PersonAngabe;
  eintritt: string | null;
  /** Was heute über diese Person zu sagen ist — „Urlaub", „Abwesend" — oder nichts. */
  heute: string | null;
  selbst: boolean;
  ziele: PublicGoal[];
  kommentare: {darfSchreiben: boolean; eintraege: ProfilKommentar[]};
  einblick?: Einblick;
}

export function personenKarte(viewer: User, personId: number, heute = todayISO()): PersonenKarte | null {
  const person = personAngabeById(personId);
  const user = getUser(personId);
  if (!person || !user) return null;
  const selbst = viewer.id === personId;

  const abwesenheit = abwesenheitAmTag(personId, heute);
  let heuteText: string | null = null;
  if (abwesenheit && (abwesenheit.status === 'genehmigt' || abwesenheit.status === 'gemeldet')) {
    const art = sichtbareArt(abwesenheit.art, hatRecht(viewer, 'kalender.gruende'), selbst);
    heuteText = art ? ART_LABEL[art] : ausserHausLabel('krank');
  }

  const darfZeit = selbst || hatRecht(viewer, 'zeit.team');
  const darfUrlaub = selbst || hatRecht(viewer, 'abwesenheit.pruefen');
  const wege: Weg[] = [];
  if (selbst) {
    wege.push({art: 'profil', href: '/profil', text: 'Profil bearbeiten'});
    wege.push({art: 'ziele', href: '/timeline?ansicht=ziele', text: 'Meine Ziele'});
  } else {
    if (hatRecht(viewer, 'zeit.team')) {
      wege.push({art: 'zeitblatt', href: `/team/${personId}`, text: 'Zeitblatt'});
      wege.push({art: 'konto', href: `/team/${personId}/konto`, text: 'Zeitkonto'});
    }
    if (hatRecht(viewer, 'protokoll.alle')) {
      wege.push({art: 'protokoll', href: `/protokoll?person=${personId}`, text: 'Protokoll'});
    }
    if (hatRecht(viewer, 'mitarbeiter.verwalten')) {
      wege.push({art: 'bearbeiten', href: `/mitarbeiter?bearbeiten=${personId}`, text: 'Bearbeiten'});
    }
  }

  const einblick: Einblick | undefined =
    darfZeit || darfUrlaub || wege.length > 0
      ? {
          ...(darfZeit
            ? {
                status: clockState(personId),
                zeitkontoMin: zeitkontoBalance(user, addDays(heute, -1)),
                offeneTage: stalePastOpenSegments(personId, heute).length,
              }
            : {}),
          ...(darfUrlaub ? {resturlaub: restanspruch(anspruchFor(user, heute.slice(0, 4)))} : {}),
          wege,
        }
      : undefined;

  return {
    person,
    eintritt: user.eintritt ?? null,
    heute: heuteText,
    selbst,
    ziele: publicGoals(personId, heute),
    kommentare: {
      darfSchreiben: hatRecht(viewer, 'profil.kommentieren'),
      eintraege: kommentareFuer(personId, viewer),
    },
    ...(einblick ? {einblick} : {}),
  };
}
