import {Heading, Text, VStack} from '@astryxdesign/core';
import {requireVerwaltung} from '@/lib/auth';
import {autoCloseCutoffMin, getSetting, mergeWindowMin} from '@/lib/settings';
import {fmtTime} from '@/lib/format';
import {SettingsForm} from '@/components/settings-form';

export const dynamic = 'force-dynamic';

export default async function EinstellungenPage() {
  await requireVerwaltung();
  const cutoff = autoCloseCutoffMin();

  return (
    <VStack gap={5} padding={5}>
      <VStack gap={0.5}>
        <Heading level={1}>Einstellungen</Heading>
        <Text type="supporting" color="secondary">
          Gelten für alle Mitarbeiter. Änderungen wirken ab sofort und ändern keine bereits erfassten Zeiten.
        </Text>
      </VStack>
      <SettingsForm
        mergeWindowMin={mergeWindowMin()}
        autoCloseCutoff={cutoff === null ? '' : fmtTime(cutoff)}
        bundesland={getSetting('bundesland')}
      />
    </VStack>
  );
}
