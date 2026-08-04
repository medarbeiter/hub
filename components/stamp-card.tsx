'use client';

import {Button, Card, Heading, HStack, ProgressBar, Text, VStack} from '@astryxdesign/core';
import {useState, useTransition} from 'react';
import {useRouter} from 'next/navigation';
import {stampAction} from '@/app/actions';
import {fmtDuration, fmtTime} from '@/lib/format';
import type {ClockStatus} from '@/lib/time';

export type StampAction = 'einstempeln' | 'pause' | 'fortsetzen' | 'ausstempeln';

interface StampCardProps {
  status: ClockStatus;
  since: number | null;
  workedMin: number;
  pauseMin: number;
  sollMin: number;
  /** Override the default server round-trip (used for optimistic stamping). */
  onStamp?: (action: StampAction) => Promise<{error: string | null}>;
}

const STATUS_TEXT: Record<ClockStatus, string> = {
  aus: 'Ausgestempelt',
  arbeit: 'Eingestempelt',
  pause: 'Pause',
};

/**
 * The one state-coupled control: its actions are exactly what the timeline
 * state allows, nothing else. Primary action changes with the state.
 */
export function StampCard({status, since, workedMin, pauseMin, sollMin, onStamp}: StampCardProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = (action: StampAction) =>
    startTransition(async () => {
      setError(null);
      if (onStamp) {
        const result = await onStamp(action);
        if (result.error) setError(result.error);
        return;
      }
      const result = await stampAction(action);
      if (result.error) setError(result.error);
      router.refresh();
    });

  return (
    <Card padding={4} elevation="low">
      <VStack gap={4}>
        <HStack justify="between" vAlign="center" gap={2}>
          <Heading level={2}>{STATUS_TEXT[status]}</Heading>
          {since !== null && (
            <Text type="supporting" color="secondary" hasTabularNumbers>
              seit {fmtTime(since)}
            </Text>
          )}
        </HStack>

        <VStack gap={1}>
          <HStack vAlign="end" gap={2}>
            <Heading level={3} type="display-3" accessibilityLevel={3}>
              {fmtDuration(workedMin)}
            </Heading>
            <Text type="supporting" color="secondary">
              von {fmtDuration(sollMin)} Std.
            </Text>
          </HStack>
          <ProgressBar
            value={sollMin > 0 ? Math.min(workedMin / sollMin, 1) * 100 : 0}
            max={100}
            variant="accent"
            label="Tagesfortschritt"
          />
          <Text type="supporting" color="secondary" hasTabularNumbers>
            Pausen heute: {fmtDuration(pauseMin)} Std.
          </Text>
        </VStack>

        {error && (
          <Text type="supporting" color="inherit">
            <span style={{color: 'var(--color-error)'}}>{error}</span>
          </Text>
        )}

        <VStack gap={2}>
          {status === 'aus' && (
            <Button label="Einstempeln" variant="primary" size="lg" width="100%" isLoading={isPending} onClick={() => run('einstempeln')} />
          )}
          {status === 'arbeit' && (
            <>
              <Button label="Ausstempeln" variant="primary" size="lg" width="100%" isLoading={isPending} onClick={() => run('ausstempeln')} />
              <Button label="Pause starten" variant="secondary" width="100%" isLoading={isPending} onClick={() => run('pause')} />
            </>
          )}
          {status === 'pause' && (
            <>
              <Button label="Pause beenden" variant="primary" size="lg" width="100%" isLoading={isPending} onClick={() => run('fortsetzen')} />
              <Button label="Ausstempeln" variant="secondary" width="100%" isLoading={isPending} onClick={() => run('ausstempeln')} />
            </>
          )}
        </VStack>
      </VStack>
    </Card>
  );
}
