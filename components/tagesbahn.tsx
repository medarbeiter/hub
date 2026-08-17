'use client';

import {Text} from '@astryxdesign/core';
import {useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent} from 'react';
import {fmtDuration, fmtTime, hourTicks, type Span, type TimelineSegment} from '@/lib/format';
import {Sinnbild} from './sinnbilder';

/**
 * One day as a horizontal lane, at three scales:
 *
 * - `band`   a 10px sparkline for dense lists (team rows) — no axis, no interaction
 * - `zeile`  a 26px row in a stack of days — the whole row is the parent's target
 * - `buehne` the full editing surface — hour axis, now-marker, drag to correct
 *
 * One component, because a day is one thing. The surface used to draw it as a
 * horizontal strip on one screen and a 230px-tall vertical slab on the next,
 * which is why a week could never be compared at a glance.
 *
 * Everything drawn over the track — the plan, the now-marker, the Feierabend
 * rule, the Abwesenheitsspange, the hour rules, the live preview — is scenery
 * and carries `pointerEvents: 'none'`. Only the track and the two resize grips
 * are targets. A painted layer that also catches the pointer is not a drawing,
 * it is a lid: the geplante Fläche used to cover 08:00–17:00 of an empty day
 * and swallow every attempt to draw the day it was asking for.
 */
export type BahnGroesse = 'band' | 'zeile' | 'buehne';

const SNAP = 5;
const MIN_NEU = 15;
const SPANGE_HOEHE = 8;
/** Below this the pointer was still standing still: a click, not a drag. */
const ZUG_SCHWELLE_PX = 3;
/** How long a finished drag keeps the click that follows it from opening the editor. */
const KLICK_SPERRE_MS = 400;

const MASSE: Record<BahnGroesse, {achse: number; spur: number; pille: number; radius: string}> = {
  band: {achse: 0, spur: 10, pille: 0, radius: 'var(--radius-full)'},
  zeile: {achse: 0, spur: 26, pille: 0, radius: 'var(--radius-inner)'},
  buehne: {achse: 20, spur: 52, pille: 24, radius: 'var(--radius-element)'},
};

/** Scenery: drawn over the track, never a target. */
const KULISSE: CSSProperties = {pointerEvents: 'none'};

interface TagesbahnProps {
  date: string;
  segments: TimelineSegment[];
  isToday: boolean;
  nowMin: number;
  /** The axis. Pass a shared one to make a stack of days comparable. */
  span: Span;
  groesse?: BahnGroesse;
  /**
   * `voll` draws hour labels above the track, `raster` only the hour rules —
   * a stack of days labels the axis once and lets every lane carry the rules,
   * so the grid runs through the whole week.
   */
  achse?: 'voll' | 'raster' | 'keine';
  /** What is expected here but not yet recorded: a plan, not a failure. */
  plan?: {startMin: number; endMin: number} | null;
  /**
   * Die Abwesenheitsspange einer Dienstreise: eine Klammer unter der Spur, von
   * der Abfahrt bis zur Rückkehr. Sie ist bewusst steingrau und nicht bronzen —
   * Gold heißt gearbeitete Zeit, und unterwegs sein ist nicht dasselbe.
   * `schwelleMin` zeichnet als gestrichelte Verlängerung, wie weit die
   * Abwesenheit für einen Anspruch noch hätte reichen müssen.
   */
  abwesenheit?: {vonMin: number; bisMin: number; erfuellt: boolean; schwelleMin?: number | null} | null;
  /** Projected Soll-reach while clocked in. */
  feierabendMin?: number | null;
  onSegmentClick?: (segment: TimelineSegment) => void;
  onSegmentResize?: (segment: TimelineSegment, startMin: number, endMin: number) => void;
  /** Drag across free track to record a stretch of time directly. */
  onCreate?: (startMin: number, endMin: number) => void;
}

interface ZiehStand {
  id: number;
  kante: 'start' | 'ende';
  ursprungMin: number;
  ursprungX: number;
  startMin: number;
  endeMin: number;
  /** Where the neighbouring entries stop this edge — clamped here, not by the server. */
  grenzeVon: number;
  grenzeBis: number;
  bewegt: boolean;
}

interface NeuStand {
  vonMin: number;
  bisMin: number;
  ursprungX: number;
  /** The free gap the drag started in; fixed for the whole gesture. */
  grenzeVon: number;
  grenzeBis: number;
  bewegt: boolean;
}

const beschriftung = (s: {kind: string; start_min: number; end_min: number | null}, ende: number) =>
  `${s.kind === 'arbeit' ? 'Arbeit' : 'Pause'} ${fmtTime(s.start_min)}–${
    s.end_min === null ? 'jetzt' : fmtTime(s.end_min)
  } (${fmtDuration(ende - s.start_min)} Std.)`;

export function Tagesbahn({
  date,
  segments,
  isToday,
  nowMin,
  span,
  groesse = 'buehne',
  achse = groesse === 'buehne' ? 'voll' : groesse === 'zeile' ? 'raster' : 'keine',
  plan = null,
  feierabendMin = null,
  abwesenheit = null,
  onSegmentClick,
  onSegmentResize,
  onCreate,
}: TagesbahnProps) {
  const mass = MASSE[groesse];
  const spurOben = achse === 'voll' ? mass.achse : 0;
  const spangeOben = spurOben + mass.spur + 4;
  const spangePlatz = abwesenheit ? SPANGE_HOEHE + 3 : 0;
  const pilleOben = spangeOben + spangePlatz;
  const hoehe = spurOben + mass.spur + spangePlatz + (mass.pille > 0 ? mass.pille + 4 : 0);
  const breite = span.to - span.from;

  const spurRef = useRef<HTMLSpanElement>(null);
  const [zieh, setZieh] = useState<ZiehStand | null>(null);
  const [neu, setNeu] = useState<NeuStand | null>(null);
  /** Timestamp of the last finished drag — a drag must not also count as a click. */
  const letzterZug = useRef(0);

  // A fresh server render supersedes any local preview.
  useEffect(() => {
    setZieh(null);
    setNeu(null);
  }, [segments]);

  /**
   * Ein Zug pro Bild. Ein Zeiger meldet sich auf einem 120-Hz-Gerät weit
   * häufiger, als React neu zeichnen kann; ohne Drosselung setzt jede Meldung
   * einen Zustand, den das nächste Bild schon wieder überschreibt — die Kante
   * läuft dem Finger hinterher, statt an ihm zu kleben. Es zählt immer die
   * jüngste Meldung: die ältere wäre eine Position, die der Finger längst
   * verlassen hat.
   */
  const rahmen = useRef<number | null>(null);
  const imBild = useCallback((fn: () => void) => {
    if (rahmen.current !== null) cancelAnimationFrame(rahmen.current);
    rahmen.current = requestAnimationFrame(() => {
      rahmen.current = null;
      fn();
    });
  }, []);
  useEffect(
    () => () => {
      if (rahmen.current !== null) cancelAnimationFrame(rahmen.current);
    },
    [],
  );

  const x = (min: number) => `${((Math.min(Math.max(min, span.from), span.to) - span.from) / breite) * 100}%`;
  const w = (a: number, b: number) =>
    `${(Math.max(Math.min(b, span.to) - Math.max(a, span.from), 3) / breite) * 100}%`;

  /** Pointer x → minute, snapped, clamped to the visible window. */
  const minuteAt = (clientX: number): number => {
    const box = spurRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return span.from;
    const anteil = (clientX - box.left) / box.width;
    const roh = span.from + anteil * breite;
    return Math.min(span.to, Math.max(span.from, Math.round(roh / SNAP) * SNAP));
  };

  /** Where a segment ends for the purpose of arithmetic on this day. */
  const endeVon = (s: TimelineSegment) => s.end_min ?? (isToday ? nowMin : 1440);

  /** Free track around a minute: an entry may never overlap an existing one. */
  const freiRaum = useCallback(
    (min: number, ausser?: number): {von: number; bis: number} => {
      let von = 0;
      let bis = isToday ? Math.min(1440, Math.max(nowMin, min)) : 1440;
      for (const s of segments) {
        if (s.id === ausser) continue;
        const ende = s.end_min ?? (isToday ? nowMin : 1440);
        if (ende <= min) von = Math.max(von, ende);
        if (s.start_min >= min) bis = Math.min(bis, s.start_min);
      }
      return {von, bis};
    },
    [segments, isToday, nowMin],
  );

  /** Is there anywhere left to draw at all? Decides whether the track offers itself. */
  const hatFreiraum =
    !!onCreate &&
    (() => {
      const kanten = [span.from, ...segments.flatMap((s) => [s.start_min, endeVon(s)])].sort((a, b) => a - b);
      const deckel = isToday ? Math.min(span.to, nowMin) : span.to;
      for (const kante of kanten) {
        if (kante >= deckel) continue;
        const {von, bis} = freiRaum(Math.max(kante, span.from));
        if (Math.min(bis, deckel) - Math.max(von, span.from) >= MIN_NEU) return true;
      }
      return false;
    })();

  /** A finished drag swallows the click the browser fires on top of it. */
  const zugEben = () => Date.now() - letzterZug.current < KLICK_SPERRE_MS;

  const fassen = (e: ReactPointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Ein Zeiger, der schon weg ist, braucht nicht gehalten zu werden.
    }
  };
  const loslassen = (e: ReactPointerEvent) => {
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // dito
    }
  };

  // --- correcting an existing entry ----------------------------------------

  const ziehStart = (s: TimelineSegment, kante: 'start' | 'ende') => (e: ReactPointerEvent) => {
    if (!onSegmentResize || s.end_min === null || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    fassen(e);
    // Die Nachbarn stehen fest, sobald der Finger die Kante fasst: eine Grenze,
    // die sich während des Zugs verschiebt, fühlt sich an wie ein Widerstand,
    // der nicht da ist. Und geklemmt wird hier, nicht erst im Server — eine
    // Kante, die stehen bleibt, sagt „bis hierher" schneller als jede
    // Fehlermeldung nach dem Loslassen.
    const {von, bis} = freiRaum(s.start_min, s.id);
    setZieh({
      id: s.id,
      kante,
      ursprungMin: kante === 'start' ? s.start_min : s.end_min,
      ursprungX: e.clientX,
      startMin: s.start_min,
      endeMin: s.end_min,
      grenzeVon: von,
      grenzeBis: bis,
      bewegt: false,
    });
  };

  const ziehBewegen = (s: TimelineSegment) => (e: ReactPointerEvent) => {
    if (!zieh || zieh.id !== s.id || s.end_min === null) return;
    const box = spurRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const roherX = e.clientX;
    imBild(() => {
      setZieh((stand) => {
        if (!stand || stand.id !== s.id || s.end_min === null) return stand;
        const weg = roherX - stand.ursprungX;
        if (!stand.bewegt && Math.abs(weg) < ZUG_SCHWELLE_PX) return stand;
        // Der Absolutwert rastet, nicht der Weg: sonst behielte eine Kante, die
        // auf 08:03 stand, für immer die :03 und das Raster wäre keins.
        const ziel = Math.round((stand.ursprungMin + (weg / box.width) * breite) / SNAP) * SNAP;
        if (stand.kante === 'start') {
          const startMin = Math.max(stand.grenzeVon, Math.min(ziel, s.end_min - SNAP));
          return {...stand, bewegt: true, startMin};
        }
        const deckel = Math.min(stand.grenzeBis, isToday ? Math.max(nowMin, s.start_min + SNAP) : 1440);
        const endeMin = Math.min(deckel, Math.max(ziel, s.start_min + SNAP));
        return {...stand, bewegt: true, endeMin};
      });
    });
  };

  const ziehEnde = (s: TimelineSegment) => (e: ReactPointerEvent) => {
    if (!zieh || zieh.id !== s.id) return;
    loslassen(e);
    if (rahmen.current !== null) {
      cancelAnimationFrame(rahmen.current);
      rahmen.current = null;
    }
    if (zieh.bewegt && (zieh.startMin !== s.start_min || zieh.endeMin !== s.end_min)) {
      letzterZug.current = Date.now();
      onSegmentResize?.(s, zieh.startMin, zieh.endeMin);
    } else {
      setZieh(null);
    }
  };

  const ziehAbbrechen = (e: ReactPointerEvent) => {
    loslassen(e);
    setZieh(null);
  };

  // --- recording a new entry by dragging across free track -------------------

  const neuStart = (e: ReactPointerEvent) => {
    if (!onCreate || e.button !== 0) return;
    const min = minuteAt(e.clientX);
    const {von, bis} = freiRaum(min);
    const deckel = isToday ? Math.min(bis, Math.max(nowMin, von)) : bis;
    if (deckel - von < MIN_NEU) return;
    fassen(e);
    const anker = Math.min(Math.max(min, von), deckel);
    setNeu({vonMin: anker, bisMin: anker, ursprungX: e.clientX, grenzeVon: von, grenzeBis: deckel, bewegt: false});
  };

  const neuBewegen = (e: ReactPointerEvent) => {
    if (!neu) return;
    const rohX = e.clientX;
    const ziel = minuteAt(rohX);
    imBild(() => {
      setNeu((stand) => {
        if (!stand) return stand;
        if (!stand.bewegt && Math.abs(rohX - stand.ursprungX) < ZUG_SCHWELLE_PX) return stand;
        return {...stand, bewegt: true, bisMin: Math.min(stand.grenzeBis, Math.max(stand.grenzeVon, ziel))};
      });
    });
  };

  const neuEnde = (e: ReactPointerEvent) => {
    if (!neu) return;
    loslassen(e);
    if (rahmen.current !== null) {
      cancelAnimationFrame(rahmen.current);
      rahmen.current = null;
    }
    const von = Math.min(neu.vonMin, neu.bisMin);
    const bis = Math.max(neu.vonMin, neu.bisMin);
    setNeu(null);
    // A stray click is not a time entry — only a deliberate stretch counts.
    if (neu.bewegt && bis - von >= MIN_NEU) {
      letzterZug.current = Date.now();
      onCreate?.(von, bis);
    }
  };

  const neuAbbrechen = (e: ReactPointerEvent) => {
    loslassen(e);
    setNeu(null);
  };

  // Escape lässt jeden laufenden Zug fallen, ohne etwas zu buchen — die Geste
  // ist damit rücknehmbar, solange der Finger noch unten ist. Eine Korrektur an
  // einem Zeitnachweis, die man nur noch loslassen kann, ist eine Falle.
  const ziehtEtwas = zieh !== null || neu !== null;
  useEffect(() => {
    if (!ziehtEtwas) return;
    const aufTaste = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setZieh(null);
      setNeu(null);
    };
    window.addEventListener('keydown', aufTaste);
    return () => window.removeEventListener('keydown', aufTaste);
  }, [ziehtEtwas]);

  const stunden = achse === 'keine' ? [] : hourTicks(span);
  const zeigtNun = isToday && nowMin >= span.from && nowMin <= span.to;

  const griff = (kante: 'start' | 'ende'): CSSProperties => ({
    position: 'absolute',
    insetBlock: 0,
    [kante === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: -3,
    // Ein 10px-Ziel trifft eine Maus, aber keinen Daumen. Auf der Bühne ist die
    // Fläche so breit, wie die Empfehlung für Zeigeflächen es verlangt; die
    // Kante selbst bleibt gezeichnet, wo sie ist.
    inlineSize: groesse === 'buehne' ? 14 : 10,
    cursor: 'ew-resize',
    touchAction: 'none',
    zIndex: 2,
  });

  const neuVon = neu ? Math.min(neu.vonMin, neu.bisMin) : 0;
  const neuBis = neu ? Math.max(neu.vonMin, neu.bisMin) : 0;
  const zeigtNeu = neu !== null && neu.bewegt && neuBis - neuVon >= SNAP;

  return (
    <figure
      aria-label={
        (segments.length === 0
          ? `Tagesverlauf ${date}: keine Zeiten erfasst`
          : `Tagesverlauf ${date}: ${segments
              .map((s) => beschriftung(s, s.end_min ?? (isToday ? nowMin : s.start_min + 1)))
              .join(', ')}`) +
        (abwesenheit
          ? `. Auswärts von ${fmtTime(abwesenheit.vonMin)} bis ${fmtTime(abwesenheit.bisMin)}`
          : '')
      }
      style={{position: 'relative', blockSize: hoehe, margin: 0}}
    >
      {stunden.map((h) => (
        <span key={h} aria-hidden style={KULISSE}>
          {achse === 'voll' && (
            <span style={{position: 'absolute', insetBlockStart: 0, insetInlineStart: x(h * 60), transform: 'translateX(-50%)'}}>
              <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                {String(h).padStart(2, '0')}
              </Text>
            </span>
          )}
          <span
            style={{
              position: 'absolute',
              insetBlockStart: spurOben,
              blockSize: mass.spur,
              insetInlineStart: x(h * 60),
              inlineSize: 1,
              background: 'var(--color-border-emphasized)',
            }}
          />
        </span>
      ))}

      {/* The track. Also the create surface: dragging across free time records it. */}
      <span
        ref={spurRef}
        aria-hidden
        onPointerDown={onCreate ? neuStart : undefined}
        onPointerMove={neu ? neuBewegen : undefined}
        onPointerUp={neu ? neuEnde : undefined}
        onPointerCancel={neu ? neuAbbrechen : undefined}
        style={{
          position: 'absolute',
          insetBlockStart: spurOben,
          blockSize: mass.spur,
          insetInline: 0,
          background: 'var(--color-background-muted)',
          borderRadius: 'var(--radius-full)',
          // Der Zeiger verspricht nur, was die Fläche halten kann: ist der Tag
          // voll, ist hier nichts mehr aufzuziehen.
          cursor: hatFreiraum ? 'copy' : undefined,
          // `pan-y`, nicht `none`: waagerecht zieht die Bahn, senkrecht scrollt
          // die Seite weiter. `none` nahm dem Telefon das Scrollen über der
          // halben Tafel.
          touchAction: onCreate ? 'pan-y' : undefined,
        }}
      />

      {/* What is expected here but not recorded yet — drawn, so an empty day
          reads as a plan waiting to be filled rather than six grey failures.
          Reine Zeichnung: sie liegt über der Spur, ist aber kein Ziel, sonst
          verdeckte ausgerechnet der Plan die Fläche, auf der man ihn erfüllt. */}
      {plan && segments.length === 0 && (
        <span
          aria-hidden
          style={{
            ...KULISSE,
            position: 'absolute',
            insetBlockStart: spurOben + 2,
            blockSize: mass.spur - 4,
            insetInlineStart: `calc(${x(plan.startMin)} + 1px)`,
            inlineSize: `calc(${w(plan.startMin, plan.endMin)} - 2px)`,
            borderRadius: mass.radius,
            // Dashed says "expected, not recorded"; the bronze edge stays at
            // full strength because it is the only thing carrying that meaning
            // (fading it to 70 % put it at 2.59:1 — see tests/kontrast).
            border: '1px dashed var(--color-icon-accent)',
            background: 'var(--color-accent-muted)',
            // Während gezogen wird, tritt der Plan einen Schritt zurück: was
            // gerade entsteht, ist die Aussage, nicht was erwartet wurde.
            opacity: zeigtNeu ? 0.45 : 1,
            transition: 'opacity var(--takt-tupf) var(--schwung-an)',
          }}
        />
      )}

      <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
        {segments.map((s) => {
          const vorschau = zieh?.id === s.id ? zieh : null;
          const offen = s.end_min === null;
          // An entry left open on a past day has no known end: it runs to the
          // edge of the window hatched, rather than lying with a fake width.
          const unbegrenzt = offen && !isToday;
          const start = vorschau?.startMin ?? s.start_min;
          const ende =
            vorschau?.endeMin ?? s.end_min ?? (isToday ? Math.max(nowMin, s.start_min + 1) : span.to);
          const dauer = ende - start;
          const arbeit = s.kind === 'arbeit';
          const ziehtGerade = zieh?.id === s.id && zieh.bewegt;
          const anteil = dauer / breite;
          const zeigtText = groesse !== 'band' && anteil >= (groesse === 'buehne' ? 0.13 : 0.2);
          const zeigtRaster = groesse !== 'band' && arbeit && dauer >= 90;
          const text = beschriftung({...s, start_min: start, end_min: offen ? null : ende}, ende);

          const inneres = (
            <span
              /* `bahn-block` zieht den Block beim Aufhängen von links nach
                 rechts auf — in der Richtung, in der die Zeit auf der Bahn
                 läuft. Beim Einstempeln wächst der neue goldene Block dadurch
                 aus dem Augenblick heraus, in dem er entstanden ist. Während
                 gezogen wird, bleibt sie aus: eine Kante, die man in der Hand
                 hat, darf sich nicht zusätzlich selbst bewegen. */
              className={ziehtGerade ? 'zeitleiste-block' : 'zeitleiste-block bahn-block'}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 'var(--spacing-2)',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                borderRadius: mass.radius,
                background: unbegrenzt
                  ? 'repeating-linear-gradient(135deg, var(--color-accent) 0 10px, var(--color-accent-muted) 10px 20px)'
                  : arbeit
                    ? offen
                      ? 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 68%, white))'
                      : 'var(--color-accent)'
                    : 'var(--farbe-pause)',
                border: unbegrenzt ? 'var(--border-width) dashed var(--color-icon-accent)' : 'none',
                boxShadow: ziehtGerade
                  ? 'var(--shadow-med)'
                  : arbeit
                    ? 'inset 0 0 0 1px var(--color-icon-accent), var(--shadow-low)'
                    : // Pause is a bite taken out of the day: it sinks in, it never lifts.
                      'inset 0 1px 2px rgb(0 0 0 / 22%)',
              }}
            >
              {/* The hour scale carried inside the fill: six hours of gold reads
                  as six hours, without anyone reading the label. */}
              {zeigtRaster &&
                Array.from({length: Math.floor((ende - 1) / 60) - Math.floor(start / 60)}, (_, i) => {
                  const stunde = (Math.floor(start / 60) + i + 1) * 60;
                  return (
                    <span
                      key={stunde}
                      aria-hidden
                      className="bahn-stundenstrich"
                      style={{insetInlineStart: `${((stunde - start) / dauer) * 100}%`}}
                    />
                  );
                })}
              {offen && isToday && <span aria-hidden className="zeitleiste-live-tip" />}
              {zeigtText && (
                /* `zeigtText` gates on the segment's share of the visible hour
                   window, not on the pixel width its own block ends up with —
                   those diverge whenever the same segment is redrawn narrower
                   (e.g. this day opened inside the Woche stack instead of at
                   full Tag width). When the label is a hair wider than its
                   block, the outer `overflow: hidden` clips it symmetrically
                   from both edges, which eats the leading digit — "15:59"
                   became "5:59", a different and wrong-looking time, not
                   obviously a truncation. Bounding this inner group to the
                   block's own width instead means whatever gets cut is cut
                   from the trailing end (the edit pencil first, then the end
                   time), so the start time — the one actually anchored to
                   where the block sits on the axis — is never corrupted. */
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-2)',
                    maxInlineSize: '100%',
                    overflow: 'hidden',
                  }}
                >
                  <Text type="label" size="sm" weight="semibold" hasTabularNumbers color="inherit">
                    {fmtTime(start)}–{unbegrenzt ? '?' : offen ? '…' : fmtTime(ende)}
                  </Text>
                  {groesse === 'buehne' && onSegmentClick && (
                    <Sinnbild sinn="bearbeiten" groesse="zeile" className="zeitleiste-stift" />
                  )}
                </span>
              )}
            </span>
          );

          return (
            <li
              key={s.id}
              style={{
                position: 'absolute',
                insetBlockStart: spurOben + 2,
                blockSize: mass.spur - 4,
                insetInlineStart: `calc(${x(start)} + 1px)`,
                inlineSize: `calc(${w(start, ende)} - 2px)`,
                color: arbeit ? 'var(--color-on-accent)' : 'var(--color-on-dark)',
                // Die Kanten eines Blocks wandern (Korrektur, laufende Minute)
                // im Zug-Takt: an beiden Enden weich, damit die Kante gleitet
                // statt zu zucken. Während gezogen wird, folgt sie dem Finger
                // ohne jede Verzögerung — ein Übergang wäre hier Gummiband.
                transition: ziehtGerade
                  ? 'none'
                  : 'inset-inline-start var(--takt-zug) var(--schwung-zug), inline-size var(--takt-zug) var(--schwung-zug)',
                zIndex: ziehtGerade ? 3 : undefined,
              }}
            >
              {onSegmentClick && s.id > 0 ? (
                <button
                  type="button"
                  className="zeitleiste-eintrag"
                  aria-label={`${text} bearbeiten`}
                  title={text}
                  onClick={() => {
                    // Ein Zug ist keine Auswahl. Zeitgesteuert und nicht über
                    // ein Merkzeichen, das nur der nächste Klick löscht: der
                    // Klick nach einem Zug landet je nach Zeigergerät auf dem
                    // Griff statt auf dem Knopf, und das Merkzeichen blieb dann
                    // liegen und verschluckte irgendwann einen echten Klick.
                    if (zugEben()) return;
                    onSegmentClick(s);
                  }}
                  style={{all: 'unset', position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: mass.radius}}
                >
                  {inneres}
                </button>
              ) : (
                <span title={groesse === 'band' ? undefined : text}>{inneres}</span>
              )}

              {onSegmentResize && !offen && s.id > 0 && (
                <>
                  <span
                    aria-hidden
                    style={griff('start')}
                    onPointerDown={ziehStart(s, 'start')}
                    onPointerMove={ziehBewegen(s)}
                    onPointerUp={ziehEnde(s)}
                    onPointerCancel={ziehAbbrechen}
                  />
                  <span
                    aria-hidden
                    style={griff('ende')}
                    onPointerDown={ziehStart(s, 'ende')}
                    onPointerMove={ziehBewegen(s)}
                    onPointerUp={ziehEnde(s)}
                    onPointerCancel={ziehAbbrechen}
                  />
                </>
              )}

              {ziehtGerade && (
                <span
                  aria-hidden
                  className="bahn-zeitchip"
                  style={{...KULISSE, [zieh!.kante === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: 0}}
                >
                  <Text type="label" size="sm" color="inherit" hasTabularNumbers>
                    {fmtTime(zieh!.kante === 'start' ? zieh!.startMin : zieh!.endeMin)}
                  </Text>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Live preview of the stretch being dragged onto the empty track. Sie
          trägt dieselbe Marke wie die gezogene Kante — man zieht eine Zeit auf,
          keine Fläche, und die Zeit muss dabei zu lesen sein. Die Deckkraft
          sitzt deshalb auf der Füllung und nicht auf der Gruppe: ein Chip mit
          55 % Deckkraft auf hellem Grund wäre nicht mehr lesbar, und die
          Uhrzeit ist hier die eigentliche Aussage. */}
      {zeigtNeu && (
        <span
          aria-hidden
          style={{
            ...KULISSE,
            position: 'absolute',
            insetBlockStart: spurOben + 2,
            blockSize: mass.spur - 4,
            insetInlineStart: x(neuVon),
            inlineSize: w(neuVon, neuBis),
          }}
        >
          <span
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: mass.radius,
              background: 'var(--color-accent)',
              opacity: 0.55,
              boxShadow: 'inset 0 0 0 1px var(--color-icon-accent)',
            }}
          />
          {groesse === 'buehne' && (
            <span
              className="bahn-zeitchip"
              style={{[neu!.bisMin >= neu!.vonMin ? 'insetInlineEnd' : 'insetInlineStart']: 0}}
            >
              <Text type="label" size="sm" color="inherit" hasTabularNumbers>
                {fmtTime(neuVon)}–{fmtTime(neuBis)} · {fmtDuration(neuBis - neuVon)} Std.
              </Text>
            </span>
          )}
        </span>
      )}

      {feierabendMin != null && feierabendMin > nowMin && feierabendMin <= span.to && (
        <span
          aria-hidden
          style={{
            ...KULISSE,
            position: 'absolute',
            insetBlockStart: spurOben - 4,
            blockSize: mass.spur + 8,
            insetInlineStart: x(feierabendMin),
            inlineSize: 0,
            borderInlineStart: '1px dashed var(--farbe-pause)',
          }}
        />
      )}

      {/* Die Abwesenheitsspange: eine Messklammer unter der Spur. Reicht die
          Abwesenheit nicht für einen Anspruch, verlängert eine gestrichelte
          Strecke sie bis zur Schwelle — so steht das Fehlende im Bild, statt
          nur als 0,00 € in der Zeile. */}
      {abwesenheit && (
        <span aria-hidden style={KULISSE}>
          {abwesenheit.schwelleMin != null && !abwesenheit.erfuellt && (
            <span
              style={{
                position: 'absolute',
                insetBlockStart: spangeOben + SPANGE_HOEHE - 2,
                blockSize: 0,
                insetInlineStart: x(abwesenheit.bisMin),
                inlineSize: w(abwesenheit.bisMin, abwesenheit.schwelleMin),
                borderBlockStart: '1px dashed var(--color-text-secondary)',
              }}
            />
          )}
          <span
            style={{
              position: 'absolute',
              insetBlockStart: spangeOben,
              blockSize: SPANGE_HOEHE,
              insetInlineStart: x(abwesenheit.vonMin),
              inlineSize: w(abwesenheit.vonMin, abwesenheit.bisMin),
              // Nur die untere Kante und die beiden Enden: eine Klammer, kein
              // zweiter Block — die Spur darüber bleibt die Aussage. Keine
              // Deckkraft unter 100 %: eine gedimmte Linie hat hier schon einmal
              // den Kontrastboden gerissen (siehe tests/kontrast.test.ts).
              borderBlockEnd: '2px solid var(--color-text-secondary)',
              borderInlineStart: '2px solid var(--color-text-secondary)',
              borderInlineEnd: '2px solid var(--color-text-secondary)',
            }}
          />
        </span>
      )}

      {zeigtNun && (
        <span aria-hidden style={KULISSE}>
          <span
            className="bahn-jetzt"
            style={{
              insetBlockStart: spurOben - 4,
              blockSize: mass.spur + 8,
              insetInlineStart: x(nowMin),
            }}
          />
          {mass.pille > 0 && (
            <span
              className="bahn-jetzt-pille"
              style={{insetBlockStart: pilleOben, insetInlineStart: x(nowMin)}}
            >
              <Text type="label" size="sm" color="inherit" hasTabularNumbers>
                {fmtTime(nowMin)}
              </Text>
            </span>
          )}
        </span>
      )}
    </figure>
  );
}
