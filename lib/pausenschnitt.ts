// Die nachgetragene Pause (rein, client-importierbar — die Anwendung auf die
// Datenbank liegt in lib/time.ts).
//
// Wer die Pause zu stempeln vergisst, hat den Tag längst am Stück erfasst: die
// vergessene Pause liegt damit zwangsläufig *in* der Arbeit. Das ist keine
// Überschneidung, die man abweisen könnte — es ist der einzige Weg, sie
// nachzutragen. Also gilt sie hier als Schnitt: die Arbeit zerfällt in den
// Teil davor und den danach.
//
// Umgekehrt bleibt es eine Überschneidung: Arbeit über Arbeit, Pause über
// Pause, Arbeit über Pause. Nur die Pause schneidet, und nur in die Arbeit.

import {fmtTime, type SegmentLike} from './format';

export interface Spanne {
  startMin: number;
  /** null = laufender Eintrag. */
  endMin: number | null;
}

export interface PausenSchnitt {
  /** Der getroffene Arbeitseintrag. */
  id: number;
  vorher: Spanne;
  note: string | null;
  /** Was von ihm bleibt: davor, danach, beides — oder nichts. */
  reste: Spanne[];
}

type Eintrag = SegmentLike & {id: number; note?: string | null};

/**
 * Welche Arbeitseinträge eine Pause zerschneidet und was von ihnen bleibt.
 *
 * `offenesEnde` sagt, bis wohin ein laufender Eintrag reicht (jetzt am
 * heutigen Tag, sonst Mitternacht) — der Aufrufer kennt seine Uhr, dieses
 * Modul rechnet nur.
 */
export function pausenSchnitte(
  segmente: Eintrag[],
  pause: {kind: 'arbeit' | 'pause'; startMin: number; endMin: number},
  offenesEnde: number,
  ausser?: number,
): PausenSchnitt[] {
  if (pause.kind !== 'pause') return [];
  const schnitte: PausenSchnitt[] = [];
  for (const s of segmente) {
    if (s.id === ausser || s.id < 0 || s.kind !== 'arbeit') continue;
    const ende = s.end_min ?? offenesEnde;
    if (pause.startMin >= ende || s.start_min >= pause.endMin) continue;
    const reste: Spanne[] = [];
    if (s.start_min < pause.startMin) reste.push({startMin: s.start_min, endMin: pause.startMin});
    // Ein laufender Eintrag läuft nach der Pause weiter — auch wenn die Pause
    // über sein (gedachtes) Ende hinausreicht.
    if (s.end_min === null) reste.push({startMin: pause.endMin, endMin: null});
    else if (pause.endMin < s.end_min) reste.push({startMin: pause.endMin, endMin: s.end_min});
    schnitte.push({
      id: s.id,
      vorher: {startMin: s.start_min, endMin: s.end_min},
      note: s.note ?? null,
      reste,
    });
  }
  return schnitte;
}

/** Wieviel Arbeitszeit der Schnitt kostet. */
export function schnittVerlust(schnitte: PausenSchnitt[], offenesEnde: number): number {
  const laenge = (sp: Spanne) => (sp.endMin ?? offenesEnde) - sp.startMin;
  return schnitte.reduce((sum, s) => sum + laenge(s.vorher) - s.reste.reduce((r, sp) => r + laenge(sp), 0), 0);
}

export function fmtSpanne(sp: Spanne): string {
  return `${fmtTime(sp.startMin)}–${sp.endMin === null ? 'offen' : fmtTime(sp.endMin)}`;
}

/** Ein Schnitt als Wert fürs Protokoll: `07:42–offen → 07:42–11:30 + 12:00–offen`. */
export function schnittText(schnitte: PausenSchnitt[]): string | null {
  if (schnitte.length === 0) return null;
  return schnitte
    .map((s) => `${fmtSpanne(s.vorher)} → ${s.reste.map(fmtSpanne).join(' + ') || 'entfällt'}`)
    .join('; ');
}
