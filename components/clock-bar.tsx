'use client';

import {Button, HStack, StackItem, StatusDot, Text} from '@astryxdesign/core';
import {useState, useTransition} from 'react';
import {fmtDuration, fmtTime} from '@/lib/format';
import {useClock, type StampAction} from './clock-provider';

const STATUS_TEXT = {aus: 'Nicht eingestempelt', arbeit: 'Eingestempelt', pause: 'Pause'} as const;

/**
 * The persistent clock strip on every authenticated route: current status,
 * today's elapsed time, and the state-coupled stamp actions. Sticky, so the
 * clock stays one click away wherever the user is.
 */
export function ClockBar() {
  const clock = useClock();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: StampAction) =>
    startTransition(async () => {
      setError(null);
      const result = await clock.stamp(action);
      if (result.error) setError(result.error);
    });

  const c = clock.compliance;
  const breakHint =
    clock.status === 'aus'
      ? null
      : c.deficitMin > 0 && c.requiredMin > 0
        ? `Pause: noch ${c.deficitMin} Min. gesetzlich nötig`
        : c.dueSoon
          ? 'Ab 6 Std. Arbeit sind 30 Min. Pause Pflicht'
          : null;

  return (
    <HStack className="stempel-leiste" gap={3} vAlign="center" paddingInline={5} paddingBlock={2} wrap="wrap">
      {clock.status === 'arbeit' ? (
        <StatusDot variant="accent" label="Eingestempelt" isPulsing />
      ) : clock.status === 'pause' ? (
        <StatusDot variant="warning" label="Pause" isPulsing />
      ) : (
        <StatusDot variant="neutral" label="Ausgestempelt" />
      )}
      <Text type="label" weight="semibold">
        {STATUS_TEXT[clock.status]}
      </Text>
      {clock.since !== null && (
        <Text type="supporting" color="secondary" hasTabularNumbers>
          seit {clock.sinceYesterday ? 'gestern ' : ''}
          {fmtTime(clock.since)}
        </Text>
      )}
      {/* No separator characters: the bar wraps to two or three rows on a
          phone, and a leading "·" at the start of a line reads as debris. */}
      <Text type="supporting" color="secondary" hasTabularNumbers>
        {fmtDuration(clock.summary.workedMin)} Std. heute
      </Text>
      {clock.prognose && (
        <Text type="supporting" color="secondary" hasTabularNumbers>
          Feierabend ca. {fmtTime(clock.prognose.atMin)}
          {clock.prognose.outstandingBreakMin > 0 && (
            <> (inkl. {clock.prognose.outstandingBreakMin} Min. Pause)</>
          )}
        </Text>
      )}
      {/* Advisory, never blocking: the record stays whatever actually happened. */}
      {breakHint && (
        <Text type="supporting" color="inherit" hasTabularNumbers>
          <span style={{color: 'var(--color-warning)'}}>{breakHint}</span>
        </Text>
      )}
      {error && (
        <Text type="supporting" color="inherit">
          <span style={{color: 'var(--color-error)'}}>{error}</span>
        </Text>
      )}
      <StackItem size="fill" />
      {clock.status === 'aus' && (
        <Button label="Einstempeln" variant="primary" isLoading={isPending} onClick={() => run('einstempeln')} />
      )}
      {clock.status === 'arbeit' && (
        <>
          <Button label="Pause starten" variant="secondary" isLoading={isPending} onClick={() => run('pause')} />
          <Button label="Ausstempeln" variant="primary" isLoading={isPending} onClick={() => run('ausstempeln')} />
        </>
      )}
      {clock.status === 'pause' && (
        <>
          <Button label="Ausstempeln" variant="secondary" isLoading={isPending} onClick={() => run('ausstempeln')} />
          <Button label="Pause beenden" variant="primary" isLoading={isPending} onClick={() => run('fortsetzen')} />
        </>
      )}
    </HStack>
  );
}
