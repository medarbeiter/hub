'use client';

import {Text} from '@astryxdesign/core';
import {useEffect, useRef, useState} from 'react';
import {fmtDuration, fmtTime, type SegmentLike} from '@/lib/format';

export interface TimelineSegment extends SegmentLike {
  id: number;
  note?: string | null;
}

interface DayTimelineProps {
  segments: TimelineSegment[];
  date: string;
  isToday: boolean;
  nowMin: number;
  onSegmentClick?: (segment: TimelineSegment) => void;
  /** Enables drag-to-correct on closed segments (5-minute snap). */
  onSegmentResize?: (segment: TimelineSegment, startMin: number, endMin: number) => void;
  /** Projected Soll-reach while clocked in — the Feierabend marker. */
  feierabendMin?: number | null;
  /** Median recent first clock-in — ghost hint on an empty today. */
  usualStartMin?: number | null;
  /** Height of one hour in px. */
  hourPx?: number;
}

const AXIS_WIDTH = 56;
const SNAP = 5;

interface DragState {
  id: number;
  edge: 'start' | 'end';
  originMin: number;
  originY: number;
  startMin: number;
  endMin: number;
}

/**
 * The day as a vertical timeline: gold Arbeit blocks, quiet Pause gaps, a
 * live-growing open segment, a now line, and — while clocked in — the
 * projected Feierabend. Closed segments can be dragged at their edges to
 * correct times directly on the timeline; clicking still opens the editor.
 */
export function DayTimeline({
  segments,
  date,
  isToday,
  nowMin,
  onSegmentClick,
  onSegmentResize,
  feierabendMin,
  usualStartMin,
  hourPx = 48,
}: DayTimelineProps) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const suppressClick = useRef(false);

  // A fresh server render supersedes any local drag preview.
  useEffect(() => {
    setDrag(null);
  }, [segments]);

  const previewFor = (s: TimelineSegment) =>
    drag && drag.id === s.id ? {start: drag.startMin, end: drag.endMin} : null;

  const ends = segments.map((s) => s.end_min ?? (isToday ? nowMin : s.start_min + 30));
  const starts = segments.map((s) => s.start_min);
  const extra = [
    ...(isToday ? [nowMin] : []),
    ...(feierabendMin != null ? [feierabendMin] : []),
    ...(usualStartMin != null && segments.length === 0 && isToday ? [usualStartMin, usualStartMin + 60] : []),
  ];
  const minHour = Math.min(7, ...starts.map((m) => Math.floor(m / 60)), ...extra.map((m) => Math.floor(m / 60)));
  const maxHour = Math.max(18, ...ends.map((m) => Math.ceil(m / 60) + 1), ...extra.map((m) => Math.ceil(m / 60) + 1));
  const startMin = minHour * 60;
  const totalMin = (maxHour - minHour) * 60;
  const height = (maxHour - minHour) * hourPx;
  const pxPerMin = height / totalMin;

  const y = (min: number) => ((min - startMin) / totalMin) * height;

  const hours = Array.from({length: maxHour - minHour + 1}, (_, i) => minHour + i);

  const beginDrag = (s: TimelineSegment, edge: 'start' | 'end') => (e: React.PointerEvent) => {
    if (!onSegmentResize || s.end_min === null) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({
      id: s.id,
      edge,
      originMin: edge === 'start' ? s.start_min : s.end_min,
      originY: e.clientY,
      startMin: s.start_min,
      endMin: s.end_min,
    });
  };

  const moveDrag = (s: TimelineSegment) => (e: React.PointerEvent) => {
    if (!drag || drag.id !== s.id || s.end_min === null) return;
    const deltaMin = Math.round((e.clientY - drag.originY) / pxPerMin / SNAP) * SNAP;
    if (drag.edge === 'start') {
      const next = Math.max(0, Math.min(drag.originMin + deltaMin, s.end_min - SNAP));
      setDrag({...drag, startMin: next});
    } else {
      const cap = isToday ? Math.min(1440, Math.max(nowMin, s.start_min + SNAP)) : 1440;
      const next = Math.min(cap, Math.max(drag.originMin + deltaMin, s.start_min + SNAP));
      setDrag({...drag, endMin: next});
    }
  };

  const endDrag = (s: TimelineSegment) => (e: React.PointerEvent) => {
    if (!drag || drag.id !== s.id) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const changed = drag.startMin !== s.start_min || drag.endMin !== s.end_min;
    if (changed) {
      suppressClick.current = true;
      onSegmentResize?.(s, drag.startMin, drag.endMin);
    } else {
      setDrag(null);
    }
  };

  const handleStyle = (edge: 'start' | 'end'): React.CSSProperties => ({
    position: 'absolute',
    insetInline: 0,
    [edge === 'start' ? 'insetBlockStart' : 'insetBlockEnd']: -3,
    blockSize: 10,
    cursor: 'ns-resize',
    touchAction: 'none',
    zIndex: 2,
  });

  return (
    <figure aria-label={`Zeitleiste für ${date}`} style={{position: 'relative', height, margin: 0}}>
      {/* Hour grid + axis labels */}
      {hours.map((h) => (
        <span
          key={h}
          aria-hidden
          style={{position: 'absolute', top: y(h * 60), insetInlineStart: 0, insetInlineEnd: 0, display: 'block'}}
        >
          <span
            style={{
              position: 'absolute',
              insetInlineStart: AXIS_WIDTH,
              insetInlineEnd: 0,
              borderBlockStart: 'var(--border-width) solid var(--color-border)',
            }}
          />
          <span style={{position: 'absolute', insetInlineStart: 0, transform: 'translateY(-50%)'}}>
            <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
              {fmtTime(h * 60)}
            </Text>
          </span>
        </span>
      ))}

      {/* Segments */}
      <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
        {segments.map((s) => {
          const isOpen = s.end_min === null;
          const preview = previewFor(s);
          const segStart = preview?.start ?? s.start_min;
          const segEnd = preview?.end ?? s.end_min ?? (isToday ? Math.max(nowMin, s.start_min + 1) : s.start_min + 1);
          const top = y(segStart);
          const blockHeight = Math.max(y(segEnd) - top, 6);
          const dur = segEnd - segStart;
          const isArbeit = s.kind === 'arbeit';
          const isDragging = drag?.id === s.id;
          const showLabel = blockHeight >= 34;
          const label = `${isArbeit ? 'Arbeit' : 'Pause'} ${fmtTime(segStart)}–${isOpen ? 'jetzt' : fmtTime(segEnd)} (${fmtDuration(dur)})`;
          const canResize = Boolean(onSegmentResize) && !isOpen;
          const inner = (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: blockHeight >= 56 ? 'flex-start' : 'center',
                justifyContent: 'space-between',
                gap: 'var(--spacing-2)',
                padding: showLabel ? 'var(--spacing-1-5) var(--spacing-3)' : '0 var(--spacing-3)',
                borderRadius: 'var(--radius-element)',
                background: isArbeit
                  ? isOpen
                    ? 'linear-gradient(180deg, var(--color-accent) 0%, color-mix(in srgb, var(--color-accent) 78%, white) 100%)'
                    : 'var(--color-accent)'
                  : 'var(--color-background-muted)',
                border: isArbeit ? 'none' : 'var(--border-width) dashed var(--color-border-emphasized)',
                boxShadow: isDragging ? 'var(--shadow-med)' : isArbeit ? 'var(--shadow-low)' : 'none',
                overflow: 'hidden',
              }}
            >
              {isOpen && isToday && <span aria-hidden className="zeitleiste-live-tip" />}
              {showLabel && (
                <>
                  <Text type="label" size="sm" weight="semibold" hasTabularNumbers color="inherit">
                    {fmtTime(segStart)}–{isOpen ? '…' : fmtTime(segEnd)}
                  </Text>
                  <Text type="supporting" size="sm" color="inherit" hasTabularNumbers>
                    {isArbeit ? (isOpen ? `läuft · ${fmtDuration(dur)}` : fmtDuration(dur)) : `Pause ${fmtDuration(dur)}`}
                  </Text>
                </>
              )}
            </span>
          );
          return (
            <li
              key={s.id}
              style={{
                position: 'absolute',
                top,
                height: blockHeight,
                insetInlineStart: AXIS_WIDTH + 12,
                insetInlineEnd: 0,
                color: isArbeit ? 'var(--color-on-accent)' : 'var(--color-text-secondary)',
                transition: isDragging ? 'none' : 'height var(--duration-slow) var(--ease-standard), top var(--duration-slow) var(--ease-standard)',
                zIndex: isDragging ? 3 : undefined,
              }}
            >
              {onSegmentClick ? (
                <button
                  type="button"
                  aria-label={`${label} bearbeiten`}
                  onClick={() => {
                    if (suppressClick.current) {
                      suppressClick.current = false;
                      return;
                    }
                    onSegmentClick(s);
                  }}
                  style={{
                    all: 'unset',
                    position: 'absolute',
                    inset: 0,
                    cursor: 'pointer',
                    borderRadius: 'var(--radius-element)',
                  }}
                >
                  {inner}
                </button>
              ) : (
                inner
              )}
              {canResize && (
                <>
                  <span
                    aria-hidden
                    style={handleStyle('start')}
                    onPointerDown={beginDrag(s, 'start')}
                    onPointerMove={moveDrag(s)}
                    onPointerUp={endDrag(s)}
                  />
                  <span
                    aria-hidden
                    style={handleStyle('end')}
                    onPointerDown={beginDrag(s, 'end')}
                    onPointerMove={moveDrag(s)}
                    onPointerUp={endDrag(s)}
                  />
                </>
              )}
              {isDragging && (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    insetInlineStart: -8,
                    transform: 'translateX(-100%)',
                    [drag!.edge === 'start' ? 'insetBlockStart' : 'insetBlockEnd']: -10,
                    background: 'var(--color-background-inverted)',
                    color: 'var(--color-on-dark)',
                    borderRadius: 'var(--radius-inner)',
                    padding: '0 var(--spacing-2)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <Text type="label" size="sm" color="inherit" hasTabularNumbers>
                    {fmtTime(drag!.edge === 'start' ? drag!.startMin : drag!.endMin)}
                  </Text>
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Feierabend marker: where Soll will be reached at the current pace */}
      {feierabendMin != null && feierabendMin > nowMin && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: y(feierabendMin),
            insetInlineStart: AXIS_WIDTH,
            insetInlineEnd: 0,
            display: 'block',
            borderBlockStart: '1px dashed #8b8474',
          }}
        >
          <span style={{position: 'absolute', insetInlineEnd: 0, insetBlockStart: 2}}>
            <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
              Feierabend ~{fmtTime(feierabendMin)}
            </Text>
          </span>
        </span>
      )}

      {/* Now line */}
      {isToday && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: y(nowMin),
            insetInlineStart: AXIS_WIDTH,
            insetInlineEnd: 0,
            display: 'block',
            borderBlockStart: '2px solid var(--color-text-accent)',
            transition: 'top var(--duration-slow) var(--ease-standard)',
          }}
        >
          <span
            style={{
              position: 'absolute',
              insetInlineEnd: 0,
              transform: 'translateY(-50%)',
              background: 'var(--color-text-accent)',
              color: 'var(--color-background-surface)',
              borderRadius: 'var(--radius-full)',
              padding: '0 var(--spacing-2)',
              lineHeight: 1.6,
            }}
          >
            <Text type="label" size="sm" color="inherit" hasTabularNumbers>
              {fmtTime(nowMin)}
            </Text>
          </span>
        </span>
      )}

      {/* Empty state: ghost of the usual start, or plain hint */}
      {segments.length === 0 &&
        (isToday && usualStartMin != null ? (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              top: y(usualStartMin),
              height: y(usualStartMin + 60) - y(usualStartMin),
              insetInlineStart: AXIS_WIDTH + 12,
              insetInlineEnd: 0,
              display: 'flex',
              alignItems: 'center',
              paddingInline: 'var(--spacing-3)',
              borderRadius: 'var(--radius-element)',
              border: '1px dashed var(--color-icon-accent)',
              background: 'var(--color-accent-muted)',
              opacity: 0.75,
            }}
          >
            <Text type="supporting" color="secondary" hasTabularNumbers>
              Meistens starten Sie gegen {fmtTime(usualStartMin)} – stempeln Sie sich ein.
            </Text>
          </span>
        ) : (
          <span
            style={{
              position: 'absolute',
              top: '38%',
              insetInlineStart: AXIS_WIDTH + 12,
              insetInlineEnd: 0,
              textAlign: 'center',
            }}
          >
            <Text type="body" color="secondary">
              {isToday ? 'Noch keine Zeiten heute – stempeln Sie sich ein.' : 'Keine Zeiten an diesem Tag.'}
            </Text>
          </span>
        ))}
    </figure>
  );
}
