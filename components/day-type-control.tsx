'use client';

import {Selector, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {dayTypeSaveAction} from '@/app/actions';
import type {DayTypeKind} from '@/lib/db';

const NONE = 'arbeitstag';

const OPTIONS = [
  {value: NONE, label: 'Arbeitstag'},
  {value: 'urlaub', label: 'Urlaub'},
  {value: 'krank', label: 'Krank'},
  {value: 'feiertag', label: 'Feiertag'},
  {value: 'freizeitausgleich', label: 'Freizeitausgleich'},
  {value: 'fortbildung', label: 'Fortbildung'},
];

interface DayTypeControlProps {
  userId: number;
  date: string;
  type: DayTypeKind | null;
  /** Set when the type comes from the holiday calendar rather than a decision. */
  computedLabel: string | null;
  isDisabled?: boolean;
}

/**
 * Why a day has no working time. Without this the Zeitkonto has to guess, and
 * a public holiday looks exactly like a day someone forgot to record.
 */
export function DayTypeControl({userId, date, type, computedLabel, isDisabled}: DayTypeControlProps) {
  const [value, setValue] = useState<string>(type ?? NONE);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const save = (next: string) => {
    setValue(next);
    startTransition(async () => {
      setError(null);
      const result = await dayTypeSaveAction(userId, date, next === NONE ? null : (next as DayTypeKind));
      if (result.error) {
        setError(result.error);
        setValue(type ?? NONE);
        return;
      }
      router.refresh();
    });
  };

  return (
    <VStack gap={1}>
      <Selector
        label="Tagesart"
        isLabelHidden
        options={OPTIONS}
        value={value}
        onChange={save}
        placeholder="Tagesart wählen"
        size="sm"
        isDisabled={isDisabled || isPending}
        width={200}
      />
      {computedLabel && value === 'feiertag' && (
        <Text type="supporting" size="sm" color="secondary">
          {computedLabel} (aus dem Feiertagskalender)
        </Text>
      )}
      {error && (
        <Text type="supporting" size="sm" color="inherit">
          <span style={{color: 'var(--color-error)'}}>{error}</span>
        </Text>
      )}
    </VStack>
  );
}
