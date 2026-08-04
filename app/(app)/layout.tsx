import {AppShell} from '@astryxdesign/core';
import type {ReactNode} from 'react';
import {requireUser} from '@/lib/auth';
import {AppNav} from '@/components/app-nav';

export default async function AppLayout({children}: {children: ReactNode}) {
  const user = await requireUser();
  return (
    <AppShell sideNav={<AppNav name={user.name} role={user.role} />} height="auto" contentPadding={0}>
      {children}
    </AppShell>
  );
}
