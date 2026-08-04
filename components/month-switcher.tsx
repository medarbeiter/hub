import {HStack, Icon, Text} from '@astryxdesign/core';
import Link from 'next/link';
import {addMonths, fmtMonth, monthOf, todayISO} from '@/lib/format';

interface MonthSwitcherProps {
  basePath: string;
  month: string;
  /** Extra query params to preserve. */
  params?: Record<string, string>;
}

function monthHref(basePath: string, month: string, params?: Record<string, string>) {
  const search = new URLSearchParams({...params, monat: month});
  return `${basePath}?${search.toString()}`;
}

const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  inlineSize: 'var(--size-element-md)',
  blockSize: 'var(--size-element-md)',
  borderRadius: 'var(--radius-element)',
  border: 'var(--border-width) solid var(--color-border-emphasized)',
  color: 'var(--color-icon-primary)',
  background: 'var(--color-background-surface)',
};

export function MonthSwitcher({basePath, month, params}: MonthSwitcherProps) {
  const currentMonth = monthOf(todayISO());
  const next = addMonths(month, 1);
  return (
    <HStack gap={2} vAlign="center">
      <Link href={monthHref(basePath, addMonths(month, -1), params)} aria-label="Voriger Monat" style={linkStyle}>
        <Icon icon="chevronLeft" size="sm" />
      </Link>
      <span style={{inlineSize: 132, textAlign: 'center'}}>
        <Text type="label" weight="semibold">
          {fmtMonth(month)}
        </Text>
      </span>
      {next <= currentMonth ? (
        <Link href={monthHref(basePath, next, params)} aria-label="Nächster Monat" style={linkStyle}>
          <Icon icon="chevronRight" size="sm" />
        </Link>
      ) : (
        <span aria-hidden style={{...linkStyle, opacity: 0.35}}>
          <Icon icon="chevronRight" size="sm" />
        </span>
      )}
    </HStack>
  );
}
