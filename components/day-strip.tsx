'use client';

import {Text} from '@astryxdesign/core';
import {fmtDuration, fmtTime, type SegmentLike} from '@/lib/format';
import type {TimelineSegment} from './day-timeline';

interface DayStripProps {
  segments: TimelineSegment[];
  isToday: boolean;
  nowMin: number;
  onSegmentClick?: (segment: TimelineSegment) => void;
  /** Projected Soll-reach while clocked in — a quiet dashed marker. */
  feierabendMin?: number | null;
  /** Median recent first clock-in — ghost hint on an empty today. */
  usualStartMin?: number | null;
}

const LABEL_ROW = 18;
const TRACK_TOP = 22;
const TRACK_HEIGHT = 28;
const PILL_ROW = TRACK_TOP + TRACK_HEIGHT + 4;
const TOTAL_HEIGHT = PILL_ROW + 22;

/**
 * The day as one compact horizontal band — the mini-timeline grammar at
 * entry-editing scale. The window derives from the day's actual entries plus
 * padding, so a 07:00 morning never renders seven empty afternoon hours.
 */
export function DayStrip({segments, isToday, nowMin, onSegmentClick, feierabendMin, usualStartMin}: DayStripProps) {
  const points = segments.flatMap((s) => [s.start_min, s.end_min ?? (isToday ? nowMin : s.start_min + 30)]);
  if (isToday) points.push(nowMin);
  if (feierabendMin != null) points.push(feierabendMin);
  if (segments.length === 0 && isToday && usualStartMin != null) points.push(usualStartMin, usualStartMin + 540);
  if (points.length === 0) points.push(8 * 60, 17 * 60);

  let from = Math.max(0, Math.floor((Math.min(...points) - 30) / 60) * 60);
  let to = Math.min(1440, Math.ceil((Math.max(...points) + 30) / 60) * 60);
  // A very short window reads as noise — keep at least six hours on screen.
  while (to - from < 6 * 60) {
    if (to < 1440) to += 60;
    else if (from > 0) from -= 60;
    else break;
  }

  const span = to - from;
  const x = (min: number) => `${((Math.min(Math.max(min, from), to) - from) / span) * 100}%`;
  const widthPct = (a: number, b: number) => `${(Math.max(Math.min(b, to) - Math.max(a, from), 4) / span) * 100}%`;

  const spanH = span / 60;
  const step = spanH > 14 ? 3 : spanH > 9 ? 2 : 1;
  const hours: number[] = [];
  for (let h = Math.ceil(from / 60); h * 60 <= to; h++) {
    if (h % step === 0) hours.push(h);
  }

  const label = (s: SegmentLike, end: number) =>
    `${s.kind === 'arbeit' ? 'Arbeit' : 'Pause'} ${fmtTime(s.start_min)}–${
      s.end_min === null ? 'jetzt' : fmtTime(s.end_min)
    } (${fmtDuration(end - s.start_min)})`;

  return (
    <figure
      aria-label={
        segments.length === 0
          ? 'Tagesverlauf: noch keine Zeiten erfasst'
          : `Tagesverlauf: ${segments
              .map((s) => label(s, s.end_min ?? (isToday ? nowMin : s.start_min + 1)))
              .join(', ')}`
      }
      style={{position: 'relative', height: TOTAL_HEIGHT, margin: 0}}
    >
      {/* Hour axis */}
      {hours.map((h) => (
        <span key={h} aria-hidden>
          <span style={{position: 'absolute', top: 0, insetInlineStart: x(h * 60), transform: 'translateX(-50%)'}}>
            <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
              {String(h).padStart(2, '0')}
            </Text>
          </span>
          <span
            style={{
              position: 'absolute',
              top: TRACK_TOP,
              height: TRACK_HEIGHT,
              insetInlineStart: x(h * 60),
              inlineSize: 1,
              background: 'var(--color-border-emphasized)',
            }}
          />
        </span>
      ))}

      {/* Track */}
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: TRACK_TOP,
          height: TRACK_HEIGHT,
          insetInline: 0,
          background: 'var(--color-background-muted)',
          borderRadius: 'var(--radius-full)',
        }}
      />

      {/* Entries */}
      <ol style={{listStyle: 'none', margin: 0, padding: 0}}>
        {segments.map((s) => {
          const isOpen = s.end_min === null;
          const end = s.end_min ?? (isToday ? Math.max(nowMin, s.start_min + 1) : s.start_min + 1);
          const isArbeit = s.kind === 'arbeit';
          const wide = (end - s.start_min) / span >= 0.14;
          const inner = (
            <span
              className="zeitleiste-block"
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                borderRadius: 'var(--radius-inner)',
                background: isArbeit
                  ? isOpen && isToday
                    ? 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 65%, white))'
                    : 'var(--color-accent)'
                  : // Warm stone ≥3:1 on the track — Pause must be findable at a glance.
                    '#8b8474',
                // Gold cannot carry 3:1 on its own; the bronze hairline does.
                boxShadow: isArbeit ? 'inset 0 0 0 1px var(--color-icon-accent), var(--shadow-low)' : 'none',
              }}
            >
              {isArbeit && wide && (
                <Text type="label" size="sm" weight="semibold" hasTabularNumbers color="inherit">
                  {fmtTime(s.start_min)}–{isOpen ? '…' : fmtTime(s.end_min!)}
                </Text>
              )}
            </span>
          );
          return (
            <li
              key={s.id}
              style={{
                position: 'absolute',
                top: TRACK_TOP + 2,
                height: TRACK_HEIGHT - 4,
                insetInlineStart: `calc(${x(s.start_min)} + 1px)`,
                width: `calc(${widthPct(s.start_min, end)} - 2px)`,
                color: isArbeit ? 'var(--color-on-accent)' : 'var(--color-on-dark)',
              }}
            >
              {onSegmentClick && s.id > 0 ? (
                <button
                  type="button"
                  className="zeitleiste-eintrag"
                  aria-label={`${label(s, end)} bearbeiten`}
                  title={label(s, end)}
                  onClick={() => onSegmentClick(s)}
                  style={{all: 'unset', position: 'absolute', inset: 0, cursor: 'pointer', borderRadius: 'var(--radius-inner)'}}
                >
                  {inner}
                </button>
              ) : (
                <span title={label(s, end)}>{inner}</span>
              )}
            </li>
          );
        })}
      </ol>

      {/* Ghost of the usual start on an empty today */}
      {segments.length === 0 && isToday && usualStartMin != null && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: TRACK_TOP + 2,
            height: TRACK_HEIGHT - 4,
            insetInlineStart: `calc(${x(usualStartMin)} + 1px)`,
            width: `calc(${widthPct(usualStartMin, usualStartMin + 60)} - 2px)`,
            borderRadius: 'var(--radius-inner)',
            border: '1px dashed var(--color-icon-accent)',
            background: 'var(--color-accent-muted)',
            opacity: 0.75,
          }}
        />
      )}

      {/* Feierabend marker — the concrete time lives in the hero line above */}
      {feierabendMin != null && feierabendMin > nowMin && feierabendMin <= to && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: TRACK_TOP - 4,
            height: TRACK_HEIGHT + 8,
            insetInlineStart: x(feierabendMin),
            inlineSize: 0,
            borderInlineStart: '1px dashed #8b8474',
          }}
        />
      )}

      {/* Now marker + pill in its own lane below the track */}
      {isToday && (
        <span aria-hidden>
          <span
            style={{
              position: 'absolute',
              top: TRACK_TOP - 4,
              height: TRACK_HEIGHT + 8,
              insetInlineStart: x(nowMin),
              inlineSize: 2,
              background: 'var(--color-text-accent)',
              transition: 'inset-inline-start var(--duration-slow) var(--ease-standard)',
            }}
          />
          <span
            style={{
              position: 'absolute',
              top: PILL_ROW,
              insetInlineStart: x(nowMin),
              transform: 'translateX(-50%)',
              background: 'var(--color-text-accent)',
              color: 'var(--color-background-surface)',
              borderRadius: 'var(--radius-full)',
              padding: '0 var(--spacing-2)',
              lineHeight: 1.6,
              whiteSpace: 'nowrap',
            }}
          >
            <Text type="label" size="sm" color="inherit" hasTabularNumbers>
              {fmtTime(nowMin)}
            </Text>
          </span>
        </span>
      )}
    </figure>
  );
}
