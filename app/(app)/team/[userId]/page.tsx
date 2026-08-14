import {Card, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireRecht} from '@/lib/auth';
import {
  addDays,
  fmtDurationSigned,
  fmtMonth,
  monthOf,
  nowMinutes,
  segmentPoints,
  spanOf,
  todayISO,
} from '@/lib/format';
import {dayRecord, getUser, isMonthLocked, zeitkontoBalance} from '@/lib/time';
import {TagesTafel} from '@/components/tages-tafel';
import {NachweisKarte} from '@/components/nachweis-karte';
import {TagLeiste} from '@/components/bereichs-leiste';
import {Sinnbild} from '@/components/sinnbilder';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{userId: string}>;
  searchParams: Promise<{tag?: string}>;
}

export default async function TeamMemberPage({params, searchParams}: PageProps) {
  await requireRecht('zeit.team');
  const {userId} = await params;
  const query = await searchParams;
  const user = getUser(Number(userId));
  if (!user || !user.active) notFound();

  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(query.tag ?? '') && query.tag! <= today ? query.tag! : today;
  const record = dayRecord(user, date);
  const locked = isMonthLocked(user.id, monthOf(date));
  const zeitkonto = zeitkontoBalance(user, addDays(today, -1));
  const nowMin = nowMinutes();
  const span = spanOf(segmentPoints(record.segments, {isToday: date === today, nowMin}), 6);

  return (
    <VStack className="zeit-blatt" gap={5} padding={5}>
      <VStack gap={2}>
        <Link href="/team" style={{textDecoration: 'none', color: 'var(--color-text-accent)'}}>
          <HStack gap={1} vAlign="center">
            <Sinnbild sinn="hinauf" groesse="zeile" />
            <Text type="label" color="inherit">
              Zurück zum Team
            </Text>
          </HStack>
        </Link>
        <VStack gap={0.5}>
          <Heading level={1}>{user.name}</Heading>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {Math.round(user.weekly_minutes / 60)} Std./Woche · Zeitkonto{' '}
            <Link href={`/team/${user.id}/konto`} style={{color: 'var(--color-text-accent)'}}>
              {fmtDurationSigned(zeitkonto)} Std.
            </Link>
          </Text>
        </VStack>
        <TagLeiste route={`/team/${user.id}`} tag={date} today={today} />
      </VStack>

      <HStack gap={5} wrap="wrap" align="start">
        <StackItem size="fill">
          <TagesTafel
            userId={user.id}
            date={date}
            isToday={date === today}
            nowMin={nowMin}
            span={span}
            kopf="voll"
            dayType={record.dayType}
            dayTypeLabel={record.dayTypeLabel}
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
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="hinweis" groesse="gross" ton="sekundaer" />
                <Heading level={3}>Hinweis</Heading>
              </HStack>
              <Text type="supporting" color="secondary">
                Korrekturen werden mit deinem Namen protokolliert und sind für die Lohnabrechnung nachvollziehbar.
              </Text>
            </VStack>
          </Card>
          <NachweisKarte userId={user.id} month={monthOf(date)} name={user.name} />
        </VStack>
      </HStack>
    </VStack>
  );
}
