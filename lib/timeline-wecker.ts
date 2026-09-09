import {clickupAktualisieren} from './clickup';
import {teamTimeline, type TimelineEvent} from './ziele';

/**
 * Was in der Timeline **neu** ist — für die Meldung unten rechts.
 *
 * „Neu" heißt: seit dem letzten Blick dieses Browsers erstmals **gesehen**,
 * nicht erst datiert. Ein ClickUp-Ereignis trägt den Moment, in dem es in
 * ClickUp geschah, kommt aber erst mit dem nächsten Abruf hier an; ein
 * erreichtes Ziel trägt den Tag des letzten Eintrags, nicht den der
 * Korrektur, die es erreicht machte. Beides würde ein Vergleich am Datum
 * verpassen. Darum merkt sich der Server je Kennung, wann er sie zum ersten
 * Mal sah, und der Browser fragt „was sahst du nach meinem letzten Blick?".
 * (Ein ClickUp-Ereignis: ein Ziel, das durch erledigte Aufgaben erreicht wird —
 * die Aufgaben selbst stehen nicht in der Timeline.)
 *
 * Nach einem Neustart ist die Merkliste leer — die erste Füllung zählt
 * nichts als neu, sonst meldete jeder Browser die ganze erste Seite.
 *
 * Sparsam: ein Abruf je Browser und Minute, und der rechnet die Seite
 * höchstens alle 20 Sekunden neu — zehn offene Fenster sind zehn Abrufe, aber
 * drei Rechnungen. ClickUp selbst wird darüber alle fünf Minuten geholt,
 * solange irgendwer angemeldet ist.
 */
const erstmals = new Map<string, number>();
let gefuellt = false;
let letzte: {zeit: number; events: TimelineEvent[]} = {zeit: 0, events: []};
const FRISCH_MS = 20_000;

export type NeuesEreignis = Pick<TimelineEvent, 'id' | 'art' | 'titel' | 'beschreibung' | 'goalId'> & {person: {id: number; name: string}};

export async function neueEreignisse(seit: number, jetzt = Date.now()): Promise<{jetzt: number; ereignisse: NeuesEreignis[]}> {
  await clickupAktualisieren(jetzt);
  if (letzte.zeit === 0 || jetzt - letzte.zeit > FRISCH_MS) letzte = {zeit: jetzt, events: teamTimeline(1).events};
  const neu: NeuesEreignis[] = [];
  for (const e of letzte.events) {
    if (!erstmals.has(e.id)) erstmals.set(e.id, gefuellt ? letzte.zeit : 0);
    if (erstmals.get(e.id)! > seit) neu.push({id: e.id, art: e.art, titel: e.titel, beschreibung: e.beschreibung, goalId: e.goalId, person: {id: e.person.id, name: e.person.name}});
  }
  gefuellt = true;
  // ponytail: nur die erste Seite (30) wird beobachtet — ein Schwall darüber hinaus kommt mit der Seite, nicht als Meldung.
  return {jetzt, ereignisse: neu.slice(0, 5)};
}

export function setWeckerForTesting(): void {
  erstmals.clear();
  gefuellt = false;
  letzte = {zeit: 0, events: []};
}
