'use client';

import {Tab, TabList} from '@astryxdesign/core';
import Link from 'next/link';
import type {ComponentProps} from 'react';

const NextLink = (props: ComponentProps<'a'>) => <Link {...(props as ComponentProps<typeof Link>)} />;

export type Ansicht = 'heute' | 'woche' | 'monat';

interface PeriodSwitcherProps {
  ansicht: Ansicht;
  /** Selected day, preserved when switching views. */
  tag?: string | null;
  monat?: string | null;
}

/** Heute | Woche | Monat — URL-driven navigation, so deep links keep working. */
export function PeriodSwitcher({ansicht, tag, monat}: PeriodSwitcherProps) {
  const href = (target: Ansicht): string => {
    if (target === 'heute') return '/';
    const search = new URLSearchParams({ansicht: target});
    if (tag) search.set('tag', tag);
    if (target === 'monat' && monat) search.set('monat', monat);
    return `/?${search.toString()}`;
  };
  return (
    <TabList value={ansicht} onChange={() => {}} hasDivider>
      <Tab value="heute" label="Heute" href={href('heute')} as={NextLink} />
      <Tab value="woche" label="Woche" href={href('woche')} as={NextLink} />
      <Tab value="monat" label="Monat" href={href('monat')} as={NextLink} />
    </TabList>
  );
}
