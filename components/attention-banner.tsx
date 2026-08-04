'use client';

import {Banner, Button, HStack, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {useEffect, useState} from 'react';
import {fmtDate} from '@/lib/format';
import type {Issue} from '@/lib/attention';

interface AttentionBannerProps {
  issues: Issue[];
  /** Dates needing correction, most recent first. */
  queue: string[];
}

/** Dismissal lasts for the browser session — payroll data should keep asking. */
const DISMISS_KEY = 'medarbeiter.korrekturen.ausgeblendet';

function dayLink(date: string): string {
  return `/?ansicht=monat&tag=${date}`;
}

/**
 * The standing "your record has holes" notice. Shown on every page until the
 * days are fixed; dismissible for the session, never permanently silenced.
 */
export function AttentionBanner({issues, queue}: AttentionBannerProps) {
  const [isDismissed, setDismissed] = useState(true);
  // Signature of the current problem set: a new issue un-dismisses the banner.
  const signature = issues.map((i) => `${i.kind}:${i.date}`).join('|');

  useEffect(() => {
    setDismissed(sessionStorage.getItem(DISMISS_KEY) === signature);
  }, [signature]);

  if (issues.length === 0 || isDismissed) return null;

  const advisory = issues.filter((i) => !i.needsCorrection);
  const title =
    queue.length === 1
      ? `Ein Tag benötigt Ihre Korrektur: ${fmtDate(queue[0]!)}`
      : queue.length > 1
        ? `${queue.length} Tage benötigen Ihre Korrektur`
        : `${advisory.length} ${advisory.length === 1 ? 'Hinweis' : 'Hinweise'} zur Arbeitszeit`;

  const shown = issues.slice(0, 4);

  return (
    <Banner
      status={queue.length > 0 ? 'warning' : 'info'}
      title={title}
      defaultIsExpanded
      isDismissable
      onDismiss={() => {
        sessionStorage.setItem(DISMISS_KEY, signature);
        setDismissed(true);
      }}
      endContent={
        queue.length > 0 ? (
          <Link href={dayLink(queue[0]!)} style={{textDecoration: 'none'}}>
            <Button label="Jetzt korrigieren" variant="secondary" size="sm" />
          </Link>
        ) : undefined
      }
    >
      <VStack gap={1}>
        {shown.map((issue) => (
          <HStack key={`${issue.kind}-${issue.date}`} gap={2} vAlign="center" wrap="wrap">
            <Link href={dayLink(issue.date)} style={{color: 'var(--color-text-accent)'}}>
              <Text type="supporting" color="inherit" hasTabularNumbers>
                {fmtDate(issue.date)}
              </Text>
            </Link>
            <Text type="supporting" color="secondary">
              {issue.message}
            </Text>
          </HStack>
        ))}
        {issues.length > shown.length && (
          <Text type="supporting" color="secondary">
            … und {issues.length - shown.length} weitere.
          </Text>
        )}
      </VStack>
    </Banner>
  );
}
