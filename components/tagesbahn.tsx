'use client';

import {Text} from '@astryxdesign/core';
import {useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent} from 'react';
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
 */
export type BahnGroesse = 'band' | 'zeile' | 'buehne';

const SNAP = 5;
const MIN_NEU = 15;
const SPANGE_HOEHE = 8;

const MASSE: Record<BahnGroesse, {achse: number; spur: number; pille: number; radius: string}> = {
  band: {achse: 0, spur: 10, pille: 0, radius: 'var(--radius-full)'},
  zeile: {achse: 0, spur: 26, pille: 0, radius: 'var(--radius-inner)'},
  buehne: {achse: 20, spur: 52, pille: 24, radius: 'var(--radius-element)'},
};

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
}

interface NeuStand {
  vonMin: number;
  bisMin: number;
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
  const unterdrueckeKlick = useRef(false);

  // A fresh server render supersedes any local preview.
  useEffect(() => {
    setZieh(null);
    setNeu(null);
  }, [segments]);

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

  // --- correcting an existing entry ----------------------------------------

  const ziehStart = (s: TimelineSegment, kante: 'start' | 'ende') => (e: ReactPointerEvent) => {
    if (!onSegmentResize || s.end_min === null) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setZieh({
      id: s.id,
      kante,
      ursprungMin: kante === 'start' ? s.start_min : s.end_min,
      ursprungX: e.clientX,
      startMin: s.start_min,
      endeMin: s.end_min,
    });
  };

  const ziehBewegen = (s: TimelineSegment) => (e: ReactPointerEvent) => {
    if (!zieh || zieh.id !== s.id || s.end_min === null) return;
    const box = spurRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return;
    const deltaMin = Math.round(((e.clientX - zieh.ursprungX) / box.width) * breite / SNAP) * SNAP;
    if (zieh.kante === 'start') {
      setZieh({...zieh, startMin: Math.max(0, Math.min(zieh.ursprungMin + deltaMin, s.end_min - SNAP))});
    } else {
      const deckel = isToday ? Math.min(1440, Math.max(nowMin, s.start_min + SNAP)) : 1440;
      setZieh({...zieh, endeMin: Math.min(deckel, Math.max(zieh.ursprungMin + deltaMin, s.start_min + SNAP))});
    }
  };

  const ziehEnde = (s: TimelineSegment) => (e: ReactPointerEvent) => {
    if (!zieh || zieh.id !== s.id) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (zieh.startMin !== s.start_min || zieh.endeMin !== s.end_min) {
      unterdrueckeKlick.current = true;
      onSegmentResize?.(s, zieh.startMin, zieh.endeMin);
    } else {
      setZieh(null);
    }
  };

  // --- recording a new entry by dragging across free track -------------------

  /** Free track around a minute: a new entry may never overlap an existing one. */
  const freiRaum = (min: number): {von: number; bis: number} => {
    let von = span.from;
    let bis = isToday ? Math.min(span.to, nowMin) : span.to;
    for (const s of segments) {
      const ende = s.end_min ?? (isToday ? nowMin : 1440);
      if (ende <= min) von = Math.max(von, ende);
      if (s.start_min >= min) bis = Math.min(bis, s.start_min);
    }
    return {von, bis};
  };

  const neuStart = (e: ReactPointerEvent) => {
    if (!onCreate || e.button !== 0) return;
    const min = minuteAt(e.clientX);
    const {von, bis} = freiRaum(min);
    if (bis - von < MIN_NEU) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setNeu({vonMin: Math.min(Math.max(min, von), bis), bisMin: Math.min(Math.max(min, von), bis)});
  };

  const neuBewegen = (e: ReactPointerEvent) => {
    if (!neu) return;
    const {von, bis} = freiRaum(neu.vonMin);
    setNeu({...neu, bisMin: Math.min(bis, Math.max(von, minuteAt(e.clientX)))});
  };

  const neuEnde = (e: ReactPointerEvent) => {
    if (!neu) return;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    const von = Math.min(neu.vonMin, neu.bisMin);
    const bis = Math.max(neu.vonMin, neu.bisMin);
    setNeu(null);
    // A stray click is not a time entry — only a deliberate stretch counts.
    if (bis - von >= MIN_NEU) {
      unterdrueckeKlick.current = true;
      onCreate?.(von, bis);
    }
  };

  const stunden = achse === 'keine' ? [] : hourTicks(span);
  const zeigtNun = isToday && nowMin >= span.from && nowMin <= span.to;

  const griff = (kante: 'start' | 'ende'): CSSProperties => ({
    position: 'absolute',
    insetBlock: 0,
    [kante === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: -3,
    inlineSize: 10,
    cursor: 'ew-resize',
    touchAction: 'none',
    zIndex: 2,
  });

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
        <span key={h} aria-hidden>
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
        onPointerCancel={neu ? neuEnde : undefined}
        style={{
          position: 'absolute',
          insetBlockStart: spurOben,
          blockSize: mass.spur,
          insetInline: 0,
          background: 'var(--color-background-muted)',
          borderRadius: 'var(--radius-full)',
          cursor: onCreate ? 'copy' : undefined,
          touchAction: onCreate ? 'none' : undefined,
        }}
      />

      {/* What is expected here but not recorded yet — drawn, so an empty day
          reads as a plan waiting to be filled rather than six grey failures. */}
      {plan && segments.length === 0 && (
        <span
          aria-hidden
          style={{
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
          const ziehtGerade = zieh?.id === s.id;
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
                    if (unterdrueckeKlick.current) {
                      unterdrueckeKlick.current = false;
                      return;
                    }
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
                  />
                  <span
                    aria-hidden
                    style={griff('ende')}
                    onPointerDown={ziehStart(s, 'ende')}
                    onPointerMove={ziehBewegen(s)}
                    onPointerUp={ziehEnde(s)}
                  />
                </>
              )}

              {ziehtGerade && (
                <span aria-hidden className="bahn-zeitchip" style={{[zieh!.kante === 'start' ? 'insetInlineStart' : 'insetInlineEnd']: 0}}>
                  <Text type="label" size="sm" color="inherit" hasTabularNumbers>
                    {fmtTime(zieh!.kante === 'start' ? zieh!.startMin : zieh!.endeMin)}
                  </Text>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Live preview of the stretch being dragged onto the empty track. */}
      {neu && Math.abs(neu.bisMin - neu.vonMin) >= SNAP && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            insetBlockStart: spurOben + 2,
            blockSize: mass.spur - 4,
            insetInlineStart: x(Math.min(neu.vonMin, neu.bisMin)),
            inlineSize: w(Math.min(neu.vonMin, neu.bisMin), Math.max(neu.vonMin, neu.bisMin)),
            borderRadius: mass.radius,
            background: 'var(--color-accent)',
            opacity: 0.55,
            boxShadow: 'inset 0 0 0 1px var(--color-icon-accent)',
          }}
        />
      )}

      {feierabendMin != null && feierabendMin > nowMin && feierabendMin <= span.to && (
        <span
          aria-hidden
          style={{
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
        <span aria-hidden>
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
        <span aria-hidden>
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
