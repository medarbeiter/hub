'use client';

import {Button, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {lockMonthAction, unlockMonthAction} from '@/app/actions';

interface LockButtonProps {
  userId: number;
  month: string;
  isLocked: boolean;
  disabledReason?: string;
}

export function LockButton({userId, month, isLocked, disabledReason}: LockButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      setError(null);
      const result = isLocked ? await unlockMonthAction(userId, month) : await lockMonthAction(userId, month);
      if (result.error) setError(result.error);
      router.refresh();
    });

  return (
    <VStack gap={1} hAlign="end">
      <Button
        label={isLocked ? 'Aufheben' : 'Abschließen'}
        variant={isLocked ? 'ghost' : 'secondary'}
        size="sm"
        isLoading={isPending}
        isDisabled={!isLocked && Boolean(disabledReason)}
        tooltip={!isLocked ? disabledReason : undefined}
        onClick={run}
      />
      {error && (
        <Text type="supporting" size="sm" color="inherit">
          <span style={{color: 'var(--color-error)'}}>{error}</span>
        </Text>
      )}
    </VStack>
  );
}
