import {Card, Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {fmtDuration, fmtDurationSigned, fmtWeekdayShort} from '@/lib/format';

export interface WeekDay {
  date: string;
  workedMin: number;
  sollMin: number;
  hasSegments: boolean;
}

interface WeekStripProps {
  days: WeekDay[];
  today: string;
}

/** Mo–So of the current week: worked vs. Soll as quiet horizontal bars. */
export function WeekStrip({days, today}: WeekStripProps) {
  const scaleMax = Math.max(...days.map((d) => Math.max(d.workedMin, d.sollMin)), 480);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <Heading level={3}>Diese Woche</Heading>
        <VStack gap={2}>
          {days.map((d) => {
            const isToday = d.date === today;
            const pct = Math.min((d.workedMin / scaleMax) * 100, 100);
            const sollPct = Math.min((d.sollMin / scaleMax) * 100, 100);
            return (
              <HStack key={d.date} gap={3} vAlign="center">
                <span style={{inlineSize: 24, flexShrink: 0}}>
                  <Text
                    type="label"
                    size="sm"
                    color={isToday ? 'accent' : 'secondary'}
                    weight={isToday ? 'semibold' : 'normal'}
                  >
                    {fmtWeekdayShort(d.date)}
                  </Text>
                </span>
                <span
                  aria-hidden
                  style={{
                    position: 'relative',
                    flex: 1,
                    display: 'block',
                    blockSize: 10,
                    background: 'var(--color-background-muted)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  {d.sollMin > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        insetBlock: 0,
                        insetInlineStart: `${sollPct}%`,
                        inlineSize: 2,
                        background: '#8b8474',
                      }}
                    />
                  )}
                  <span
                    className={d.workedMin > 0 ? 'arbeit-flaeche' : undefined}
                    style={{
                      position: 'absolute',
                      insetBlock: 0,
                      insetInlineStart: 0,
                      inlineSize: `${pct}%`,
                      background: isToday
                        ? 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, white))'
                        : 'var(--color-accent)',
                      borderRadius: 'var(--radius-full)',
                    }}
                  />
                </span>
                <span style={{inlineSize: 76, flexShrink: 0, textAlign: 'end'}}>
                  <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                    {d.hasSegments || d.workedMin > 0 ? `${fmtDuration(d.workedMin)} Std.` : '–'}
                  </Text>
                </span>
              </HStack>
            );
          })}
        </VStack>
      </VStack>
    </Card>
  );
}

interface ZeitkontoCardProps {
  balanceMin: number;
}

/** Running Überstunden balance over recorded days, through yesterday. */
export function ZeitkontoCard({balanceMin}: ZeitkontoCardProps) {
  const positive = balanceMin >= 0;
  return (
    <Card padding={4}>
      <VStack gap={1}>
        <Heading level={3}>Zeitkonto</Heading>
        <Text type="display-3" hasTabularNumbers color="inherit">
          <span style={{color: positive ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
            {fmtDurationSigned(balanceMin)} Std.
          </span>
        </Text>
        {/* No footnote defending the number: the Zeitkonto page shows how it
            is made, day by day, including what was left out and why. */}
        <Text type="supporting" color="secondary">
          Überstunden bis gestern · Herleitung ansehen
        </Text>
      </VStack>
    </Card>
  );
}
