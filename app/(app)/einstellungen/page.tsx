import {Heading, HStack, Text, VStack} from '@astryxdesign/core';
import {requireRecht} from '@/lib/auth';
import {absenderAdresse, autoCloseCutoffMin, getSetting, mailAktiv, mergeWindowMin, spesenSaetze} from '@/lib/settings';
import {letzterVersand, mailKonfiguriert} from '@/lib/mail-buch';
import {fmtEuroPlain, fmtTime} from '@/lib/format';
import {SettingsForm} from '@/components/settings-form';
import {Sinnbild} from '@/components/sinnbilder';

export const dynamic = 'force-dynamic';

export default async function EinstellungenPage() {
  await requireRecht('einstellungen.verwalten');
  const cutoff = autoCloseCutoffMin();
  const saetze = spesenSaetze();

  return (
    <VStack className="zeit-blatt" gap={5} padding={5}>
      <VStack gap={0.5}>
        <HStack gap={2} vAlign="center">
          <Sinnbild sinn="einstellungen" groesse="gross" ton="sekundaer" />
          <Heading level={1}>Einstellungen</Heading>
        </HStack>
        <Text type="supporting" color="secondary">
          Gelten für alle Mitarbeiter. Änderungen wirken ab sofort und ändern keine bereits erfassten Zeiten.
        </Text>
      </VStack>
      <SettingsForm
        mergeWindowMin={mergeWindowMin()}
        autoCloseCutoff={cutoff === null ? '' : fmtTime(cutoff)}
        belegungGrenze={getSetting('belegung_grenze')}
        bundesland={getSetting('bundesland')}
        mailAktiv={mailAktiv()}
        mailAbsender={absenderAdresse()}
        /* Ob ein Schlüssel hinterlegt ist, weiß nur der Server — der Browser
           bekommt die Tatsache, nie den Schlüssel. */
        mailKonfiguriert={mailKonfiguriert()}
        letzterVersand={letzterVersand(5)}
        spesenStufen={saetze.map((s) => ({
          ab: s.ab,
          halb: fmtEuroPlain(s.halbCent),
          voll: fmtEuroPlain(s.vollCent),
        }))}
      />
    </VStack>
  );
}
