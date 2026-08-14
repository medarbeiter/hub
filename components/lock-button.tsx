'use client';

import {Button} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useTransition} from 'react';
import {lockMonthAction, unlockMonthAction} from '@/app/actions';
import {useMelde} from './melde';
import {Sinnbild} from './sinnbilder';

interface LockButtonProps {
  userId: number;
  month: string;
  isLocked: boolean;
  disabledReason?: string;
}

export function LockButton({userId, month, isLocked, disabledReason}: LockButtonProps) {
  const [isPending, startTransition] = useTransition();
  const melde = useMelde();
  const router = useRouter();

  const run = () =>
    startTransition(async () => {
      const result = isLocked ? await unlockMonthAction(userId, month) : await lockMonthAction(userId, month);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      router.refresh();
    });

  return (
    <Button
      label={isLocked ? 'Aufheben' : 'Abschließen'}
      variant={isLocked ? 'ghost' : 'secondary'}
      size="sm"
      icon={<Sinnbild sinn={isLocked ? 'entsperrt' : 'gesperrt'} />}
      isLoading={isPending}
      isDisabled={!isLocked && Boolean(disabledReason)}
      tooltip={!isLocked ? disabledReason : undefined}
      onClick={run}
    />
  );
}
