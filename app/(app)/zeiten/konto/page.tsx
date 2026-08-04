import {Heading, HStack, Icon, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireUser} from '@/lib/auth';
import {addDays, todayISO} from '@/lib/format';
import {zeitkontoSummary} from '@/lib/time';
import {KontoLedger} from '@/components/konto-ledger';

export const dynamic = 'force-dynamic';

export default async function KontoPage() {
  const user = await requireUser();
  const through = addDays(todayISO(), -1);
  const summary = zeitkontoSummary(user, through);

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={2}>
        <Link href="/?ansicht=monat" style={{textDecoration: 'none', color: 'var(--color-text-accent)'}}>
          <HStack gap={1} vAlign="center">
            <Icon icon="chevronLeft" size="sm" />
            <Text type="label" color="inherit">
              Zurück zu Meine Zeit
            </Text>
          </HStack>
        </Link>
        <Heading level={1}>Zeitkonto</Heading>
      </VStack>
      <KontoLedger summary={summary} />
    </VStack>
  );
}
