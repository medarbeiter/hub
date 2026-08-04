import {Badge, Button, Card, Divider, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireVerwaltung} from '@/lib/auth';
import {addDays, addMonths, daysInMonth, fmtDuration, fmtDurationSigned, monthOf, todayISO} from '@/lib/format';
import {activeUsers, monthRecord, zeitkontoBalance} from '@/lib/time';
import {MonthSwitcher} from '@/components/month-switcher';
import {SaldoTrend} from '@/components/saldo-trend';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{monat?: string}>;
}

export default async function BerichtePage({searchParams}: PageProps) {
  await requireVerwaltung();
  const params = await searchParams;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : monthOf(today);

  const monthEnd = daysInMonth(month).at(-1)!;
  const zeitkontoThrough = monthEnd < today ? monthEnd : addDays(today, -1);

  const currentMonth = monthOf(today);
  const trendMonths = Array.from({length: 6}, (_, i) => addMonths(month, i - 5));

  const rows = activeUsers().map((u) => ({
    user: u,
    record: monthRecord(u, month),
    zeitkonto: zeitkontoBalance(u, zeitkontoThrough),
    trend: trendMonths.map((m) => {
      const r = monthRecord(u, m);
      return {month: m, diffMin: r.workedMin - r.sollMin, isCurrent: m === currentMonth};
    }),
  }));
  const trendMaxAbs = Math.max(...rows.flatMap((r) => r.trend.map((p) => Math.abs(p.diffMin))), 0);

  const totalIst = rows.reduce((sum, r) => sum + r.record.workedMin, 0);
  const totalSoll = rows.reduce((sum, r) => sum + r.record.sollMin, 0);

  return (
    <VStack gap={5} padding={5}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Berichte</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            Gesamt {fmtDuration(totalIst)} Std. · Soll {fmtDuration(totalSoll)} Std.
          </Text>
        </VStack>
        <HStack gap={3} vAlign="center" wrap="wrap">
          <MonthSwitcher basePath="/berichte" month={month} />
          <a href={`/api/export?monat=${month}`} download style={{textDecoration: 'none'}}>
            <Button label="CSV für Lohnabrechnung" variant="secondary" size="sm" />
          </a>
          <Link href={`/druck/${month}`} target="_blank" style={{textDecoration: 'none'}}>
            <Button label="Druckansicht (PDF)" variant="secondary" size="sm" />
          </Link>
        </HStack>
      </HStack>

      <VStack className="tabelle-scroll">
        <Card padding={0}>
        <VStack gap={0}>
          <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
            <span style={{inlineSize: 200, flexShrink: 0}}>
              <Text type="label" color="secondary">
                Mitarbeiter
              </Text>
            </span>
            <span style={{inlineSize: 100, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Ist
              </Text>
            </span>
            <span style={{inlineSize: 100, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Soll
              </Text>
            </span>
            <span style={{inlineSize: 100, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Saldo Monat
              </Text>
            </span>
            <span style={{inlineSize: 120, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Zeitkonto gesamt
              </Text>
            </span>
            <span style={{inlineSize: 96, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Saldo-Trend
              </Text>
            </span>
            <StackItem size="fill">
              <span />
            </StackItem>
          </HStack>
          <Divider />
          {rows.map(({user, record, zeitkonto, trend}) => {
            const diff = record.workedMin - record.sollMin;
            return (
              <VStack key={user.id} gap={0}>
                <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
                  <span style={{inlineSize: 200, flexShrink: 0}}>
                    <Text type="label" weight="medium" maxLines={1}>
                      {user.name}
                    </Text>
                  </span>
                  <span style={{inlineSize: 100, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers>
                      {fmtDuration(record.workedMin)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 100, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers color="secondary">
                      {fmtDuration(record.sollMin)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 100, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers>
                      <span style={{color: diff >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
                        {diff >= 0 ? '+' : ''}
                        {fmtDuration(diff)}
                      </span>
                    </Text>
                  </span>
                  <span style={{inlineSize: 120, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers>
                      {fmtDurationSigned(zeitkonto)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 96, display: 'inline-flex', justifyContent: 'flex-end'}}>
                    <SaldoTrend points={trend} maxAbsMin={trendMaxAbs} />
                  </span>
                  <StackItem size="fill">
                    <span style={{display: 'inline-flex', gap: 'var(--spacing-2)'}}>
                      {record.locked && <Badge variant="info" label="Abgeschlossen" />}
                      {record.openSegments > 0 && <Badge variant="warning" label={`${record.openSegments} offen`} />}
                    </span>
                  </StackItem>
                </HStack>
                <Divider />
              </VStack>
            );
          })}
        </VStack>
        </Card>
      </VStack>

      <Text type="supporting" color="secondary">
        „Ist/Soll“ zählen nur erfasste Tage; das Zeitkonto läuft über alle erfassten Tage bis {month === monthOf(today) ? 'gestern' : 'Monatsende'}. Die CSV-Datei enthält alle Tageswerte je Mitarbeiter.
      </Text>
    </VStack>
  );
}
