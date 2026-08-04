import {fmtDurationSigned, fmtMonth} from '@/lib/format';

export interface SaldoPoint {
  month: string;
  diffMin: number;
  /** The running month is provisional and rendered muted. */
  isCurrent?: boolean;
}

interface SaldoTrendProps {
  points: SaldoPoint[];
  /** Shared scale across all rows so trends are comparable. */
  maxAbsMin: number;
}

const BAR_W = 9;
const GAP = 2;
const HALF_H = 14;

// Diverging micro bars: position encodes the sign (above/below the zero
// hairline), color reinforces it. Poles validated: #8f6e06 / #a50c25 on white.
export function SaldoTrend({points, maxAbsMin}: SaldoTrendProps) {
  const scale = Math.max(maxAbsMin, 60);
  return (
    <span
      role="img"
      aria-label={`Saldo-Verlauf: ${points.map((p) => `${fmtMonth(p.month)} ${fmtDurationSigned(p.diffMin)} Std.`).join(', ')}`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: GAP,
        blockSize: HALF_H * 2 + 4,
        inlineSize: points.length * (BAR_W + GAP) - GAP,
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          insetInline: 0,
          insetBlockStart: '50%',
          borderBlockStart: 'var(--border-width) solid var(--color-border-emphasized)',
        }}
      />
      {points.map((p) => {
        const h = p.diffMin === 0 ? 0 : Math.max(Math.round((Math.abs(p.diffMin) / scale) * HALF_H), 2);
        const positive = p.diffMin >= 0;
        return (
          <span
            key={p.month}
            aria-hidden
            title={`${fmtMonth(p.month)}: ${fmtDurationSigned(p.diffMin)} Std.${p.isCurrent ? ' (laufend)' : ''}`}
            style={{position: 'relative', display: 'inline-block', inlineSize: BAR_W, blockSize: '100%'}}
          >
            {h > 0 && (
              <span
                style={{
                  position: 'absolute',
                  insetInline: 0,
                  blockSize: h,
                  [positive ? 'insetBlockEnd' : 'insetBlockStart']: '50%',
                  background: positive ? '#8f6e06' : '#a50c25',
                  opacity: p.isCurrent ? 0.45 : 1,
                  borderRadius: positive ? '2px 2px 0 0' : '0 0 2px 2px',
                }}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}
