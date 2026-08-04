import {Card, Divider, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {fmtDate, fmtDuration, fmtDurationSigned, fmtMonth, fmtWeekdayShort, monthOf} from '@/lib/format';
import type {LedgerRow} from '@/lib/time';

interface KontoLedgerProps {
  rows: LedgerRow[];
  balanceMin: number;
}

/**
 * The Zeitkonto, opened up: every recorded day's ± and the running balance —
 * trust through transparency. Newest month first.
 */
export function KontoLedger({rows, balanceMin}: KontoLedgerProps) {
  const byMonth = new Map<string, LedgerRow[]>();
  for (const row of rows) {
    const month = monthOf(row.date);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(row);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <VStack gap={4}>
      <Card padding={4}>
        <HStack gap={3} vAlign="end" wrap="wrap">
          <Heading level={2} type="display-3" accessibilityLevel={2}>
            {fmtDurationSigned(balanceMin)} Std.
          </Heading>
          <Text type="supporting" color="secondary">
            Zeitkonto aus {rows.length} erfassten Tagen. Tage ohne Einträge (z. B. Urlaub) zählen nicht.
          </Text>
        </HStack>
      </Card>

      {months.map((month) => {
        const monthRows = [...byMonth.get(month)!].reverse();
        const monthSum = monthRows.reduce((sum, r) => sum + r.diffMin, 0);
        return (
          <VStack key={month} gap={2}>
            <HStack justify="between" vAlign="center">
              <Heading level={3}>{fmtMonth(month)}</Heading>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                Monatssaldo {fmtDurationSigned(monthSum)} Std.
              </Text>
            </HStack>
            <Card padding={0}>
              <VStack gap={0}>
                <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={1.5}>
                  <span style={{inlineSize: 110, flexShrink: 0}}>
                    <Text type="label" size="sm" color="secondary">
                      Tag
                    </Text>
                  </span>
                  <span style={{inlineSize: 70, textAlign: 'end'}}>
                    <Text type="label" size="sm" color="secondary">
                      Ist
                    </Text>
                  </span>
                  <span style={{inlineSize: 70, textAlign: 'end'}}>
                    <Text type="label" size="sm" color="secondary">
                      Soll
                    </Text>
                  </span>
                  <span style={{inlineSize: 80, textAlign: 'end'}}>
                    <Text type="label" size="sm" color="secondary">
                      +/−
                    </Text>
                  </span>
                  <StackItem size="fill">
                    <span />
                  </StackItem>
                  <span style={{inlineSize: 100, textAlign: 'end'}}>
                    <Text type="label" size="sm" color="secondary">
                      Kontostand
                    </Text>
                  </span>
                </HStack>
                <Divider />
                {monthRows.map((row) => (
                  <VStack key={row.date} gap={0}>
                    <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={1.5}>
                      <span style={{inlineSize: 110, flexShrink: 0}}>
                        <Text type="body" hasTabularNumbers>
                          {fmtWeekdayShort(row.date)}, {fmtDate(row.date)}
                        </Text>
                      </span>
                      <span style={{inlineSize: 70, textAlign: 'end'}}>
                        <Text type="body" hasTabularNumbers>
                          {fmtDuration(row.workedMin)}
                        </Text>
                      </span>
                      <span style={{inlineSize: 70, textAlign: 'end'}}>
                        <Text type="body" hasTabularNumbers color="secondary">
                          {fmtDuration(row.sollMin)}
                        </Text>
                      </span>
                      <span style={{inlineSize: 80, textAlign: 'end'}}>
                        <Text type="body" hasTabularNumbers>
                          <span
                            style={{
                              color: row.diffMin >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)',
                            }}
                          >
                            {fmtDurationSigned(row.diffMin)}
                          </span>
                        </Text>
                      </span>
                      <StackItem size="fill">
                        <span />
                      </StackItem>
                      <span style={{inlineSize: 100, textAlign: 'end'}}>
                        <Text type="body" hasTabularNumbers weight="medium">
                          {fmtDurationSigned(row.runningMin)}
                        </Text>
                      </span>
                    </HStack>
                    <Divider />
                  </VStack>
                ))}
              </VStack>
            </Card>
          </VStack>
        );
      })}

      {rows.length === 0 && (
        <Card padding={5}>
          <Text type="body" color="secondary">
            Noch keine erfassten Tage – das Zeitkonto beginnt mit dem ersten Eintrag.
          </Text>
        </Card>
      )}
    </VStack>
  );
}
