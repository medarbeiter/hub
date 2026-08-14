import {Heading, HStack, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireRecht} from '@/lib/auth';
import {addDays, fmtDate, fmtDurationSigned, todayISO} from '@/lib/format';
import {getUser, zeitkontoSummary} from '@/lib/time';
import {KontoTafel} from '@/components/konto-tafel';
import {KontoHerleitung} from '@/components/kontext-rail';
import {Sinnbild} from '@/components/sinnbilder';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{userId: string}>;
}

export default async function TeamKontoPage({params}: PageProps) {
  await requireRecht('zeit.team');
  const {userId} = await params;
  const user = getUser(Number(userId));
  if (!user || !user.active) notFound();

  const through = addDays(todayISO(), -1);
  const summary = zeitkontoSummary(user, through);

  return (
    <VStack className="zeit-blatt" gap={5} padding={5}>
      <VStack gap={2}>
        <Link href={`/team/${user.id}`} style={{textDecoration: 'none', color: 'var(--color-text-accent)'}}>
          <HStack gap={1} vAlign="center">
            <Sinnbild sinn="hinauf" groesse="zeile" />
            <Text type="label" color="inherit">
              Zurück zu {user.name}
            </Text>
          </HStack>
        </Link>
        <HStack gap={2} vAlign="center">
          <Sinnbild sinn="konto" groesse="gross" ton="sekundaer" />
          <Heading level={1}>Zeitkonto – {user.name}</Heading>
        </HStack>
        <HStack gap={2} vAlign="end" wrap="wrap">
          <Text type="display-1" hasTabularNumbers color="inherit">
            <span style={{color: summary.balanceMin >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
              {fmtDurationSigned(summary.balanceMin)}
            </span>
          </Text>
          <Text type="large" color="secondary">
            Std. Überstunden bis {fmtDate(summary.through)}
          </Text>
        </HStack>
      </VStack>

      <KontoHerleitung
        recordedDays={summary.recordedDays}
        absenceDays={summary.absenceDays}
        uncountableDays={summary.uncountableDays}
        missingDays={summary.missingDays}
      />

      <KontoTafel summary={summary} />
    </VStack>
  );
}
