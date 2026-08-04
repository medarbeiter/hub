import {Card, Divider, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {fmtDate, fmtDuration, fmtDurationSigned, fmtMonth, fmtWeekdayShort, monthOf} from '@/lib/format';
import type {LedgerRow, ZeitkontoSummary} from '@/lib/time';

interface KontoLedgerProps {
  summary: ZeitkontoSummary;
}

/**
 * The Zeitkonto, opened up: what the balance is made of, what was left out and
 * why, then every counted day's ± and the running balance. The figure should
 * need no footnote to be trusted.
 */
export function KontoLedger({summary}: KontoLedgerProps) {
  const {rows, balanceMin} = summary;
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
        <VStack gap={3}>
          <HStack gap={3} vAlign="end" wrap="wrap">
            <Heading level={2} type="display-3" accessibilityLevel={2}>
              {fmtDurationSigned(balanceMin)} Std.
            </Heading>
            <Text type="supporting" color="secondary">
              Überstunden bis {fmtDate(summary.through)}
            </Text>
          </HStack>

          <Divider />

          <VStack gap={1}>
            <Text type="supporting" color="secondary">
              So entsteht diese Zahl: für jeden Tag unten wird die erfasste Arbeitszeit mit dem Soll verrechnet und
              aufaddiert.
            </Text>
            <Text type="supporting" color="secondary">
              Gezählt werden {summary.recordedDays} {summary.recordedDays === 1 ? 'Tag' : 'Tage'} mit erfassten Zeiten
              {summary.absenceDays > 0 && (
                <> und {summary.absenceDays} {summary.absenceDays === 1 ? 'Tag' : 'Tage'} mit Tagesart</>
              )}
              . Urlaub, Krankheit und Feiertage setzen das Soll auf null und verändern den Saldo daher nicht;
              Freizeitausgleich bucht das Soll ab; Fortbildung gilt als geleistete Arbeitszeit.
            </Text>
            {summary.uncountableDays.length > 0 && (
              <Text type="supporting" color="inherit">
                <span style={{color: 'var(--color-warning)'}}>
                  Nicht gezählt: {summary.uncountableDays.length}{' '}
                  {summary.uncountableDays.length === 1 ? 'Tag ohne Ende' : 'Tage ohne Ende'} (
                  {summary.uncountableDays.slice(0, 3).map(fmtDate).join(', ')}
                  {summary.uncountableDays.length > 3 && ' …'}). Ohne Endzeit lässt sich der Tag nicht verrechnen.
                </span>
              </Text>
            )}
            {summary.missingDays.length > 0 && (
              <Text type="supporting" color="inherit">
                <span style={{color: 'var(--color-warning)'}}>
                  Nicht gezählt: {summary.missingDays.length}{' '}
                  {summary.missingDays.length === 1 ? 'Arbeitstag ohne Eintrag' : 'Arbeitstage ohne Eintrag'} (
                  {summary.missingDays.slice(0, 3).map(fmtDate).join(', ')}
                  {summary.missingDays.length > 3 && ' …'}). Tragen Sie die Zeiten nach oder wählen Sie eine Tagesart,
                  damit der Saldo vollständig ist.
                </span>
              </Text>
            )}
          </VStack>
        </VStack>
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
            <VStack className="tabelle-scroll">
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
                        {row.dayTypeLabel && (
                          <Text type="supporting" size="sm" color="secondary">
                            {row.dayTypeLabel}
                          </Text>
                        )}
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
