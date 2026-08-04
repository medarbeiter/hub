import {AppShell} from '@astryxdesign/core';
import type {ReactNode} from 'react';
import {requireUser} from '@/lib/auth';
import {AppNav} from '@/components/app-nav';
import {ClockBar} from '@/components/clock-bar';
import {ClockProvider} from '@/components/clock-provider';
import {clockState, dayRecord, nowMinutes, todayISO} from '@/lib/time';

export default async function AppLayout({children}: {children: ReactNode}) {
  const user = await requireUser();
  const today = todayISO();
  const record = dayRecord(user, today);
  const clock = clockState(user.id);
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
        {children}
      </ClockProvider>
    </AppShell>
  );
}
