import {Badge, Card, Heading, HStack, Icon, StackItem, StatusDot, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireVerwaltung} from '@/lib/auth';
import {fmtDuration, nowMinutes, todayISO} from '@/lib/format';
import {activeUsers, clockState, dayRecord, stalePastOpenSegments} from '@/lib/time';
import {DaySwitcher} from '@/components/day-switcher';
import {MiniTimeline} from '@/components/mini-timeline';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{tag?: string}>;
}

export default async function TeamPage({searchParams}: PageProps) {
  await requireVerwaltung();
  const params = await searchParams;
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.tag ?? '') && params.tag! <= today ? params.tag! : today;
  const isToday = date === today;
  const nowMin = nowMinutes();

  const rows = activeUsers().map((u) => {
    const record = dayRecord(u, date);
    const state = isToday ? clockState(u.id) : null;
    const anomalies = stalePastOpenSegments(u.id).length;
    return {user: u, record, state, anomalies};
  });

  const totalWorked = rows.reduce((sum, r) => sum + r.record.summary.workedMin, 0);
  const presentCount = rows.filter((r) => r.state?.status === 'arbeit').length;

  // Today groups by live status so "who is here?" answers itself.
  const groups = isToday
    ? [
        {title: 'Eingestempelt', rows: rows.filter((r) => r.state?.status === 'arbeit')},
        {title: 'Pause', rows: rows.filter((r) => r.state?.status === 'pause')},
        {title: 'Abwesend', rows: rows.filter((r) => (r.state?.status ?? 'aus') === 'aus')},
      ].filter((g) => g.rows.length > 0)
    : [{title: 'Alle', rows}];

  return (
    <VStack gap={5} padding={5}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <Heading level={1}>Team</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {rows.length} Mitarbeiter · {fmtDuration(totalWorked)} Std. erfasst
            {isToday && ` · ${presentCount} gerade eingestempelt`}
          </Text>
        </VStack>
        <DaySwitcher basePath="/team" date={date} />
      </HStack>

      <Card padding={0}>
        <VStack gap={0}>
          {groups.map((group) => (
            <VStack key={group.title} gap={0}>
              {groups.length > 1 && (
                <HStack gap={2} vAlign="center" paddingInline={4} paddingBlock={1.5}>
                  <Text type="label" size="sm" color="secondary" weight="semibold">
                    {group.title} ({group.rows.length})
                  </Text>
                </HStack>
              )}
              {group.rows.map(({user, record, state, anomalies}) => (
                <Link
                  key={user.id}
                  href={`/team/${user.id}?tag=${date}`}
                  className="zeile-interaktiv"
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'block',
                    borderBlockStart: 'var(--border-width) solid var(--color-border)',
                  }}
                >
                  <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
                    <span style={{inlineSize: 20, flexShrink: 0, display: 'inline-flex', justifyContent: 'center'}}>
                      {state ? (
                        state.status === 'arbeit' ? (
                          <StatusDot variant="accent" label="Eingestempelt" isPulsing />
                        ) : state.status === 'pause' ? (
                          <StatusDot variant="warning" label="Pause" isPulsing />
                        ) : (
                          <StatusDot variant="neutral" label="Ausgestempelt" />
                        )
                      ) : record.summary.hasOpen ? (
                        <StatusDot variant="warning" label="Offener Eintrag" />
                      ) : (
                        <StatusDot variant="neutral" label="Keine Auffälligkeiten" />
                      )}
                    </span>
                    <span style={{inlineSize: 180, flexShrink: 0}}>
                      <VStack gap={0}>
                        <Text type="label" weight="medium" maxLines={1}>
                          {user.name}
                        </Text>
                        <Text type="supporting" size="sm" color="secondary">
                          {Math.round(user.weekly_minutes / 60)} Std./Woche
                        </Text>
                      </VStack>
                    </span>
                    <StackItem size="fill">
                      <MiniTimeline segments={record.segments} isToday={isToday} nowMin={nowMin} />
                    </StackItem>
                    <span style={{inlineSize: 70, flexShrink: 0, textAlign: 'end'}}>
                      <Text type="body" hasTabularNumbers weight="medium">
                        {record.segments.length > 0 ? `${fmtDuration(record.summary.workedMin)}` : '–'}
                      </Text>
                    </span>
                    <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
                      {anomalies > 0 ? (
                        <Badge variant="warning" label={anomalies === 1 ? '1 offener Tag' : `${anomalies} offene Tage`} />
                      ) : null}
                    </span>
                    <span style={{flexShrink: 0, display: 'inline-flex', color: 'var(--color-icon-secondary)'}}>
                      <Icon icon="chevronRight" size="sm" />
                    </span>
                  </HStack>
                </Link>
              ))}
            </VStack>
          ))}
          <HStack
            gap={4}
            vAlign="center"
            paddingInline={4}
            paddingBlock={2}
          >
            <span style={{inlineSize: 20, flexShrink: 0}} />
            <span style={{inlineSize: 180, flexShrink: 0}}>
              <Text type="label" weight="semibold">
                Summe
              </Text>
            </span>
            <StackItem size="fill">
              <span />
            </StackItem>
            <span style={{inlineSize: 70, flexShrink: 0, textAlign: 'end'}}>
              <Text type="body" hasTabularNumbers weight="semibold">
                {fmtDuration(totalWorked)}
              </Text>
            </span>
            <span style={{inlineSize: 96, flexShrink: 0}} />
            <span style={{inlineSize: 16, flexShrink: 0}} />
          </HStack>
        </VStack>
      </Card>

      <Text type="supporting" color="secondary">
        Zeile anklicken, um Zeiten einzusehen und zu korrigieren. Goldene Balken sind Arbeitszeit, graue Pausen.
      </Text>
    </VStack>
  );
}
