import {Heading, HStack, Icon, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requireVerwaltung} from '@/lib/auth';
import {addDays, todayISO} from '@/lib/format';
import {getUser, zeitkontoSummary} from '@/lib/time';
import {KontoLedger} from '@/components/konto-ledger';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{userId: string}>;
}

export default async function TeamKontoPage({params}: PageProps) {
  await requireVerwaltung();
  const {userId} = await params;
  const user = getUser(Number(userId));
  if (!user || !user.active) notFound();

  const through = addDays(todayISO(), -1);
  const summary = zeitkontoSummary(user, through);

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={2}>
        <Link href={`/team/${user.id}`} style={{textDecoration: 'none', color: 'var(--color-text-accent)'}}>
          <HStack gap={1} vAlign="center">
            <Icon icon="chevronLeft" size="sm" />
            <Text type="label" color="inherit">
              Zurück zu {user.name}
            </Text>
          </HStack>
        </Link>
        <Heading level={1}>Zeitkonto – {user.name}</Heading>
      </VStack>
      <KontoLedger summary={summary} />
    </VStack>
  );
}
