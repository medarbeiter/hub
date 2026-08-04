import {Card, Skeleton, VStack} from '@astryxdesign/core';

/** Shown while a route's data loads — the shape of what is coming, not a spinner. */
export default function Loading() {
  return (
    <VStack gap={5} padding={5} aria-label="Inhalt wird geladen" aria-busy>
      <VStack gap={2}>
        <Skeleton width={220} height={32} />
        <Skeleton width={320} height={16} />
      </VStack>
      <Card padding={4}>
        <VStack gap={3}>
          <Skeleton width="100%" height={72} />
          <Skeleton width="100%" height={40} />
          <Skeleton width="100%" height={40} />
        </VStack>
      </Card>
    </VStack>
  );
}
