import {HStack, Icon, Text} from '@astryxdesign/core';
import Link from 'next/link';
import {addDays, fmtDateLong, todayISO} from '@/lib/format';

interface DaySwitcherProps {
  basePath: string;
  date: string;
}

function href(basePath: string, date: string) {
  return `${basePath}?tag=${date}`;
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

export function DaySwitcher({basePath, date}: DaySwitcherProps) {
  const today = todayISO();
  const next = addDays(date, 1);
  return (
    <HStack gap={2} vAlign="center">
      <Link href={href(basePath, addDays(date, -1))} aria-label="Voriger Tag" style={linkStyle}>
        <Icon icon="chevronLeft" size="sm" />
      </Link>
      <span style={{inlineSize: 148, textAlign: 'center'}}>
        <Text type="label" weight="semibold">
          {date === today ? 'Heute' : fmtDateLong(date)}
        </Text>
      </span>
      {next <= today ? (
        <Link href={href(basePath, next)} aria-label="Nächster Tag" style={linkStyle}>
          <Icon icon="chevronRight" size="sm" />
        </Link>
      ) : (
        <span aria-hidden style={{...linkStyle, opacity: 0.35}}>
          <Icon icon="chevronRight" size="sm" />
        </span>
      )}
      {date !== today && (
        <Link href={href(basePath, today)} style={{color: 'var(--color-text-accent)', textDecoration: 'none'}}>
          <Text type="label" color="inherit">
            Heute
          </Text>
        </Link>
      )}
    </HStack>
  );
}
