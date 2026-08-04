import {fmtDuration, fmtTime, type SegmentLike} from '@/lib/format';

interface MiniTimelineProps {
  segments: SegmentLike[];
  isToday: boolean;
  nowMin: number;
  /** Axis window in hours. */
  fromHour?: number;
  toHour?: number;
  height?: number;
}

/**
 * A day compressed into one horizontal band — the team view's scannable row.
 * Gold = Arbeit, hollow = Pause, a live tip marks a running segment.
 */
export function MiniTimeline({segments, isToday, nowMin, fromHour = 6, toHour = 20, height = 16}: MiniTimelineProps) {
  const startMin = fromHour * 60;
  const totalMin = (toHour - fromHour) * 60;
  const x = (min: number) => `${Math.min(Math.max(((min - startMin) / totalMin) * 100, 0), 100)}%`;
  const widthPct = (from: number, to: number) =>
    `${Math.max(((Math.min(to, toHour * 60) - Math.max(from, startMin)) / totalMin) * 100, 0.5)}%`;

  return (
    <span
      aria-label={
        segments.length === 0
          ? 'Keine Zeiten'
          : segments
              .map(
                (s) =>
                  `${s.kind === 'arbeit' ? 'Arbeit' : 'Pause'} ${fmtTime(s.start_min)}–${
                    s.end_min === null ? 'jetzt' : fmtTime(s.end_min)
                  }`,
              )
              .join(', ')
      }
      role="img"
      style={{
        position: 'relative',
        display: 'block',
        height,
        width: '100%',
        background: 'var(--color-background-muted)',
        borderRadius: 'var(--radius-full)',
        overflow: 'hidden',
      }}
    >
      {segments.map((s, i) => {
        const isOpen = s.end_min === null;
        const end = s.end_min ?? (isToday ? Math.max(nowMin, s.start_min + 1) : s.start_min + 30);
        return (
          <span
            key={i}
            aria-hidden
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              insetInlineStart: x(s.start_min),
              width: widthPct(s.start_min, end),
              background:
                s.kind === 'arbeit'
                  ? isOpen && isToday
                    ? 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 65%, white))'
                    : 'var(--color-accent)'
                  : '#8b8474', // warm stone ≥3:1 on the track — Pause must be findable at a glance
            }}
            title={`${s.kind === 'arbeit' ? 'Arbeit' : 'Pause'} ${fmtTime(s.start_min)}–${
              isOpen ? 'jetzt' : fmtTime(s.end_min!)
            } (${fmtDuration(end - s.start_min)})`}
          />
        );
      })}
      {isToday && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            insetInlineStart: x(nowMin),
            width: 2,
            background: 'var(--color-text-accent)',
          }}
        />
      )}
    </span>
  );
}
