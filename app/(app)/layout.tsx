import {AppShell, VStack} from '@astryxdesign/core';
import type {ReactNode} from 'react';
import {requireUser} from '@/lib/auth';
import {AppNav} from '@/components/app-nav';
import {AttentionBanner} from '@/components/attention-banner';
import {ClockBar} from '@/components/clock-bar';
import {ClockProvider} from '@/components/clock-provider';
import {attentionIssues, correctionQueue, excusedDays} from '@/lib/attention';
import {autoCloseForgotten, clockState, dayRecord, nowMinutes, todayISO} from '@/lib/time';

export default async function AppLayout({children}: {children: ReactNode}) {
  const user = await requireUser();
  const today = todayISO();

  // Sweep first so a provisionally closed entry shows up as "please confirm"
  // in the same render rather than one navigation later.
  autoCloseForgotten(user.id, today);

  const record = dayRecord(user, today);
  const clock = clockState(user.id);
  const issues = attentionIssues(user, {today, isExcused: excusedDays(user, today)});

  return (
    <AppShell sideNav={<AppNav name={user.name} role={user.role} />} height="auto" contentPadding={0}>
      <ClockProvider
        today={today}
        initialNowMin={nowMinutes()}
        segments={record.segments}
        status={clock.status}
        since={clock.since}
        sinceYesterday={clock.sinceYesterday ?? false}
        sollMin={record.sollMin}
      >
        <ClockBar />
        {issues.length > 0 && (
          <VStack paddingInline={5} paddingBlock={3}>
            <AttentionBanner issues={issues} queue={correctionQueue(issues)} />
          </VStack>
        )}
        {children}
      </ClockProvider>
    </AppShell>
  );
}
