import {BahnenGeruest, KontextGeruest, LadeBlatt} from '@/components/ladegeruest';
import {HStack, StackItem, VStack} from '@astryxdesign/core';

/** Ein Mitarbeitertag: Rückverweis, Name, Tagesleiste, dann die Tagestafel. */
export default function Loading() {
  return (
    <LadeBlatt zurueck nav>
      <HStack gap={5} wrap="wrap" align="start">
        <StackItem size="fill">
          <BahnenGeruest anzahl={4} />
        </StackItem>
        <VStack gap={4} className="kontext-rail">
          <KontextGeruest />
        </VStack>
      </HStack>
    </LadeBlatt>
  );
}
