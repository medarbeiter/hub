import {HStack, Icon, Text} from '@astryxdesign/core';
import Link from 'next/link';
import {addDays, mondayOf, todayISO} from '@/lib/format';

const MONTHS_SHORT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];

function fmtDayShort(dateISO: string): string {
  const [, m, d] = dateISO.split('-');
  return `${Number(d)}. ${MONTHS_SHORT[Number(m) - 1]}`;
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

/** ‹ Woche › pager, mirroring MonthSwitcher; future weeks stay unreachable. */
export function WeekSwitcher({anchor}: {anchor: string}) {
  const monday = mondayOf(anchor);
  const nextMonday = addDays(monday, 7);
  const href = (m: string) => `/?ansicht=woche&tag=${m}`;
  return (
    <HStack gap={2} vAlign="center">
      <Link href={href(addDays(monday, -7))} aria-label="Vorige Woche" style={linkStyle}>
        <Icon icon="chevronLeft" size="sm" />
      </Link>
      <span style={{inlineSize: 148, textAlign: 'center'}}>
        <Text type="label" weight="semibold" hasTabularNumbers>
          {fmtDayShort(monday)} – {fmtDayShort(addDays(monday, 6))}
        </Text>
      </span>
      {nextMonday <= todayISO() ? (
        <Link href={href(nextMonday)} aria-label="Nächste Woche" style={linkStyle}>
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
