'use client';

import {Button, HStack, Text} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {lockAllAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {Sinnbild} from './sinnbilder';

interface LockAllButtonProps {
  month: string;
  /** Employees currently lockable (unlocked, no open entries). */
  lockableCount: number;
}

export function LockAllButton({month, lockableCount}: LockAllButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (lockableCount === 0 && !result) return null;

  const run = () =>
    startTransition(async () => {
      const outcome = await sicher(lockAllAction)(month);
      setConfirming(false);
      if (outcome.error) setResult(outcome.error);
      else {
        setResult(
          outcome.skipped > 0
            ? `${outcome.locked} abgeschlossen, ${outcome.skipped} wegen offener Einträge oder ungeprüfter Reisen übersprungen.`
            : `${outcome.locked} Mitarbeiter abgeschlossen.`,
        );
      }
      router.refresh();
    });

  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      {result && (
        <Text type="supporting" color="secondary">
          {result}
        </Text>
      )}
      {confirming ? (
        <>
          <Text type="supporting">{lockableCount} Mitarbeiter abschließen?</Text>
          <Button
            label="Ja, abschließen"
            variant="primary"
            size="sm"
            isLoading={isPending}
            icon={<Sinnbild sinn="gesperrt" />}
            onClick={run}
          />
          <Button label="Abbrechen" variant="ghost" size="sm" onClick={() => setConfirming(false)} />
        </>
      ) : lockableCount > 0 ? (
        <Button
          label="Alle abschließen"
          variant="secondary"
          size="sm"
          icon={<Sinnbild sinn="gesperrt" />}
          onClick={() => setConfirming(true)}
        />
      ) : null}
    </HStack>
  );
}
