import {Badge, Banner, Card, Divider, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireVerwaltung} from '@/lib/auth';
import {addMonths, fmtDuration, monthOf, todayISO} from '@/lib/format';
import {activeUsers, monthRecord} from '@/lib/time';
import {LockAllButton} from '@/components/lock-all-button';
import {LockButton} from '@/components/lock-button';
import {MonthSwitcher} from '@/components/month-switcher';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{monat?: string}>;
}

export default async function AbschlussPage({searchParams}: PageProps) {
  await requireVerwaltung();
  const params = await searchParams;
  const currentMonth = monthOf(todayISO());
  // Default to the previous month — that's the one being closed.
  const month = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : addMonths(currentMonth, -1);
  const isCurrentOrFuture = month >= currentMonth;

  const rows = activeUsers().map((u) => ({user: u, record: monthRecord(u, month)}));
  const lockedCount = rows.filter((r) => r.record.locked).length;
  const openCount = rows.reduce((sum, r) => sum + r.record.openSegments, 0);

  return (
    <VStack gap={5} padding={5}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Monatsabschluss</Heading>
          <Text type="supporting" color="secondary">
            {lockedCount} von {rows.length} Mitarbeitern abgeschlossen
          </Text>
        </VStack>
        <HStack gap={3} vAlign="center" wrap="wrap">
          {!isCurrentOrFuture && (
            <LockAllButton
              month={month}
              lockableCount={rows.filter((r) => !r.record.locked && r.record.openSegments === 0).length}
            />
          )}
          <MonthSwitcher basePath="/abschluss" month={month} />
        </HStack>
      </HStack>

      {isCurrentOrFuture && (
        <Banner
          status="info"
          title="Der laufende Monat kann erst nach Monatsende abgeschlossen werden."
        />
      )}
      {!isCurrentOrFuture && openCount > 0 && (
        <Banner
          status="warning"
          title={`${openCount} offene Einträge in diesem Monat`}
          description="Monate mit offenen Einträgen können nicht abgeschlossen werden. Öffnen Sie den betroffenen Tag und tragen Sie das Ende nach."
        />
      )}

      <VStack className="tabelle-scroll">
        <Card padding={0}>
        <VStack gap={0}>
          <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
            <span style={{inlineSize: 200, flexShrink: 0}}>
              <Text type="label" color="secondary">
                Mitarbeiter
              </Text>
            </span>
            <span style={{inlineSize: 90, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Ist
              </Text>
            </span>
            <span style={{inlineSize: 90, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Soll
              </Text>
            </span>
            <span style={{inlineSize: 90, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Saldo
              </Text>
            </span>
            <span style={{inlineSize: 110, textAlign: 'end'}}>
              <Text type="label" color="secondary">
                Offene Einträge
              </Text>
            </span>
            <StackItem size="fill">
              <span />
            </StackItem>
            <span style={{inlineSize: 130, flexShrink: 0}} />
          </HStack>
          <Divider />
          {rows.map(({user, record}) => {
            const diff = record.workedMin - record.sollMin;
            return (
              <VStack key={user.id} gap={0}>
                <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
                  <span style={{inlineSize: 200, flexShrink: 0}}>
                    <VStack gap={0}>
                      <Text type="label" weight="medium" maxLines={1}>
                        {user.name}
                      </Text>
                      <Text type="supporting" size="sm" color="secondary">
                        {Math.round(user.weekly_minutes / 60)} Std./Woche
                      </Text>
                    </VStack>
                  </span>
                  <span style={{inlineSize: 90, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers>
                      {fmtDuration(record.workedMin)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 90, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers color="secondary">
                      {fmtDuration(record.sollMin)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 90, textAlign: 'end'}}>
                    <Text type="body" hasTabularNumbers>
                      <span style={{color: diff >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
                        {diff >= 0 ? '+' : ''}
                        {fmtDuration(diff)}
                      </span>
                    </Text>
                  </span>
                  <span style={{inlineSize: 110, textAlign: 'end'}}>
                    {record.openSegments > 0 ? (
                      <Link href={`/team/${user.id}`} style={{textDecoration: 'none'}}>
                        <Badge variant="warning" label={String(record.openSegments)} />
                      </Link>
                    ) : (
                      <Text type="supporting" color="secondary">
                        –
                      </Text>
                    )}
                  </span>
                  <StackItem size="fill">
                    <span style={{display: 'inline-flex'}}>
                      {record.locked && <Badge variant="info" label="Abgeschlossen" />}
                    </span>
                  </StackItem>
                  <span style={{inlineSize: 130, flexShrink: 0, display: 'inline-flex', justifyContent: 'flex-end'}}>
                    <LockButton
                      userId={user.id}
                      month={month}
                      isLocked={record.locked}
                      disabledReason={
                        isCurrentOrFuture
                          ? 'Der laufende Monat kann noch nicht abgeschlossen werden.'
                          : record.openSegments > 0
                            ? 'Offene Einträge müssen zuerst korrigiert werden.'
                            : undefined
                      }
                    />
                  </span>
                </HStack>
                <Divider />
              </VStack>
            );
          })}
        </VStack>
        </Card>
      </VStack>

      <Text type="supporting" color="secondary">
        Abgeschlossene Monate sind schreibgeschützt und bilden die Grundlage für die Lohnabrechnung.
      </Text>
    </VStack>
  );
}
