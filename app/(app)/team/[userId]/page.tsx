import {Card, Heading, HStack, Icon, StackItem, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireVerwaltung} from '@/lib/auth';
import {addDays, fmtDuration, fmtDurationSigned, monthOf, nowMinutes, todayISO} from '@/lib/format';
import {dayRecord, getUser, isMonthLocked, zeitkontoBalance} from '@/lib/time';
import {DayDetail} from '@/components/day-detail';
import {DaySwitcher} from '@/components/day-switcher';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{userId: string}>;
  searchParams: Promise<{tag?: string}>;
}

export default async function TeamMemberPage({params, searchParams}: PageProps) {
  await requireVerwaltung();
  const {userId} = await params;
  const query = await searchParams;
  const user = getUser(Number(userId));
  if (!user || !user.active) notFound();

  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.tag ?? '') && query.tag! <= today ? query.tag! : today;
  const record = dayRecord(user, date);
  const locked = isMonthLocked(user.id, monthOf(date));
  const zeitkonto = zeitkontoBalance(user, addDays(today, -1));

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={2}>
        <Link href="/team" style={{textDecoration: 'none', color: 'var(--color-text-accent)'}}>
          <HStack gap={1} vAlign="center">
            <Icon icon="chevronLeft" size="sm" />
            <Text type="label" color="inherit">
              Zurück zum Team
            </Text>
          </HStack>
        </Link>
        <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
          <VStack gap={0.5}>
            <Heading level={1}>{user.name}</Heading>
            <Text type="supporting" color="secondary" hasTabularNumbers>
              {Math.round(user.weekly_minutes / 60)} Std./Woche · Zeitkonto{' '}
              <Link href={`/team/${user.id}/konto`} style={{color: 'var(--color-text-accent)'}}>
                {fmtDurationSigned(zeitkonto)} Std.
              </Link>
            </Text>
          </VStack>
          <DaySwitcher basePath={`/team/${user.id}`} date={date} />
        </HStack>
      </VStack>

      <HStack gap={5} wrap="wrap" align="start">
        <StackItem size="fill">
          <DayDetail
            userId={user.id}
            date={date}
            isToday={date === today}
            nowMin={nowMinutes()}
            segments={record.segments}
            workedMin={record.summary.workedMin}
            pauseMin={record.summary.pauseMin}
            sollMin={record.sollMin}
            canEdit={!locked}
            lockedNote={locked ? 'Dieser Monat ist abgeschlossen. Zum Bearbeiten zuerst den Abschluss aufheben.' : undefined}
          />
        </StackItem>
        <VStack gap={4} width={300}>
          <Card padding={4}>
            <VStack gap={1}>
              <Heading level={3}>Hinweis</Heading>
              <Text type="supporting" color="secondary">
                Korrekturen werden mit Ihrem Namen protokolliert und sind für die Lohnabrechnung nachvollziehbar.
              </Text>
            </VStack>
          </Card>
          <Card padding={4}>
            <VStack gap={2}>
              <Heading level={3}>Arbeitszeitnachweis</Heading>
              <Text type="supporting" color="secondary">
                Druckansicht für {user.name} – über den Druckdialog als PDF speichern.
              </Text>
              <Link
                href={`/druck/${monthOf(date)}?mitarbeiter=${user.id}`}
                target="_blank"
                style={{color: 'var(--color-text-accent)', textDecoration: 'none'}}
              >
                <Text type="label" color="inherit">
                  Monat {monthOf(date)} drucken
                </Text>
              </Link>
            </VStack>
          </Card>
        </VStack>
      </HStack>
    </VStack>
  );
}
