'use client';

import {Heading, HStack, Table, Text, VStack, pixel, proportional} from '@astryxdesign/core';
import {
  fmtDateMitWochentag,
  fmtDuration,
  fmtDurationSigned,
  fmtMonth,
  monthOf,
} from '@/lib/format';
import type {DayTypeKind} from '@/lib/db';
import type {LedgerRow, ZeitkontoSummary} from '@/lib/time';
import {Sinnbild} from './sinnbilder';

interface KontoZeile extends Record<string, unknown> {
  date: string;
  tag: string;
  ist: string;
  soll: string;
  diffMin: number;
  tagesart: string;
  /** Für das Zeichen in der Tagesart-Spalte; null an einem gearbeiteten Tag. */
  tagesartKind: DayTypeKind | null;
  stand: string;
}

/**
 * The Zeitkonto as the fourth range of the same question. The balance and its
 * derivation used to live on a page of their own outside the tab set, with two
 * paragraphs of prose running the full width of the screen; here the number is
 * the frame's figure, the shape of the account is the Bühne, and the days are
 * an actual table.
 */
export function KontoTafel({summary}: {summary: ZeitkontoSummary}) {
  const byMonth = new Map<string, LedgerRow[]>();
  for (const row of summary.rows) {
    const month = monthOf(row.date);
    if (!byMonth.has(month)) byMonth.set(month, []);
    byMonth.get(month)!.push(row);
  }
  const months = [...byMonth.keys()].sort().reverse();

  if (summary.rows.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="konto" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Noch keine erfassten Tage – das Zeitkonto beginnt mit deinem ersten Eintrag.
          </Text>
          <Text type="supporting" color="secondary">
            Sobald ein Tag vollständig erfasst ist, erscheint er hier mit Ist, Soll und der Differenz.
          </Text>
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack gap={5}>
      {months.map((month) => {
        const rows = [...byMonth.get(month)!].reverse();
        const monatsSaldo = rows.reduce((sum, r) => sum + r.diffMin, 0);
        const data: KontoZeile[] = rows.map((r) => ({
          date: r.date,
          tag: fmtDateMitWochentag(r.date),
          ist: fmtDuration(r.workedMin),
          soll: fmtDuration(r.sollMin),
          diffMin: r.diffMin,
          tagesart: r.dayTypeLabel ?? '',
          tagesartKind: r.dayType,
          stand: fmtDurationSigned(r.runningMin),
        }));
        return (
          <VStack key={month} gap={2}>
            <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="monat" groesse="gross" ton="sekundaer" />
                <Heading level={3}>{fmtMonth(month)}</Heading>
              </HStack>
              <Text type="supporting" color="secondary" hasTabularNumbers>
                Monatssaldo{' '}
                <span style={{color: monatsSaldo >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
                  {fmtDurationSigned(monatsSaldo)} Std.
                </span>
              </Text>
            </HStack>
            <VStack className="tabelle-scroll konto-blatt-tabelle">
              <Table<KontoZeile>
                data={data}
                idKey="date"
                density="compact"
                dividers="rows"
                textOverflow="truncate"
                columns={[
                  {key: 'tag', header: 'Tag', width: pixel(150)},
                  {key: 'ist', header: 'Ist', width: pixel(78), align: 'end'},
                  {key: 'soll', header: 'Soll', width: pixel(78), align: 'end'},
                  {
                    key: 'diffMin',
                    header: '+/−',
                    width: pixel(90),
                    align: 'end',
                    renderCell: (row) => (
                      <Text type="body" size="sm" hasTabularNumbers color="inherit">
                        <span style={{color: row.diffMin >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
                          {fmtDurationSigned(row.diffMin)}
                        </span>
                      </Text>
                    ),
                  },
                  {
                    key: 'tagesart',
                    header: 'Tagesart',
                    width: proportional(1),
                    // Dieselben Zeichen wie im Tagesart-Menü: eine Spalte
                    // gleichlanger Wörter wird damit überfliegbar.
                    renderCell: (row) =>
                      row.tagesartKind ? (
                        <HStack gap={1.5} vAlign="center" wrap="nowrap">
                          <Sinnbild sinn={row.tagesartKind} groesse="zeile" ton="sekundaer" />
                          <Text type="body" size="sm">
                            {row.tagesart}
                          </Text>
                        </HStack>
                      ) : null,
                  },
                  {key: 'stand', header: 'Kontostand', width: pixel(110), align: 'end'},
                ]}
              />
            </VStack>
          </VStack>
        );
      })}
    </VStack>
  );
}

export interface VerlaufMonat {
  month: string;
  /** Balance at the end of this month. */
  standMin: number;
  isCurrent: boolean;
}

const HALB = 42;

/**
 * How the balance got here: the account's standing at the end of each month,
 * diverging from a zero hairline. Same grammar as the micro trend on Berichte,
 * at reading scale — bronze above the line, error red below.
 *
 * Drei Dinge, die dem Bild bei Lesegröße gefehlt haben:
 *
 *  – Die Nulllinie stand fest in der Mitte. Bei einem Konto, das nie ins Minus
 *    gerät (der Regelfall), war damit die untere Hälfte immer leer und das Bild
 *    wirkte abgeschnitten. Sie sitzt jetzt unten, solange kein Monat negativ
 *    ist, und rückt erst in die Mitte, wenn es einen gibt.
 *  – Kein Balken trug seinen Wert. Im Streifen auf „Berichte" ist das richtig
 *    — dort ist es ein Miniaturzeichen neben der Zahl. Hier ist es das Bild
 *    selbst, und ein Bild ohne Beschriftung lässt sich nur schätzen.
 *  – Der laufende Monat war allein durch halbe Deckkraft markiert, ohne dass
 *    irgendwo stand, was das heißt. Die Bildunterschrift sagt es jetzt.
 */
export function KontoVerlauf({months}: {months: VerlaufMonat[]}) {
  if (months.length === 0) return null;
  const scale = Math.max(...months.map((m) => Math.abs(m.standMin)), 60);
  const hatMinus = months.some((m) => m.standMin < 0);
  const laufend = months.some((m) => m.isCurrent);
  // Ohne Minusmonat braucht es keine untere Hälfte: die Nulllinie steht am Fuß.
  const nulllinie = hatMinus ? '50%' : '100%';
  const hoehe = hatMinus ? HALB * 2 : HALB;
  return (
    <VStack gap={2}>
      <figure
        aria-label={`Kontostand je Monat: ${months
          .map((m) => `${fmtMonth(m.month)} ${fmtDurationSigned(m.standMin)} Std.`)
          .join(', ')}`}
        style={{position: 'relative', display: 'flex', alignItems: 'stretch', gap: 6, blockSize: hoehe, margin: 0}}
      >
        <span
          aria-hidden
          style={{
            position: 'absolute',
            insetInline: 0,
            insetBlockStart: nulllinie,
            borderBlockStart: 'var(--border-width) solid var(--color-border-emphasized)',
          }}
        />
        {months.map((m, i) => {
          const hoch = m.standMin === 0 ? 0 : Math.max(Math.round((Math.abs(m.standMin) / scale) * HALB), 3);
          const positiv = m.standMin >= 0;
          return (
            <span
              key={m.month}
              aria-hidden
              title={`${fmtMonth(m.month)}: ${fmtDurationSigned(m.standMin)} Std.${m.isCurrent ? ' (laufend)' : ''}`}
              style={{position: 'relative', flex: 1, minInlineSize: 10}}
            >
              {hoch > 0 && (
                <span
                  className="konto-balken"
                  style={{
                    position: 'absolute',
                    insetInline: 0,
                    blockSize: hoch,
                    [positiv ? 'insetBlockEnd' : 'insetBlockStart']: hatMinus ? '50%' : 0,
                    background: positiv ? 'var(--color-icon-accent)' : 'var(--color-error)',
                    opacity: m.isCurrent ? 0.5 : 1,
                    borderRadius: positiv ? '3px 3px 0 0' : '0 0 3px 3px',
                    transformOrigin: positiv ? 'bottom' : 'top',
                    // Bounded cascade wie `.bahn-reihe`, hier bis zu zwölf Monate.
                    animationDelay: `${Math.min(i * 20, 160)}ms`,
                  }}
                />
              )}
            </span>
          );
        })}
      </figure>
      <HStack gap={6}>
        {months.map((m) => (
          <StackItemLabel
            key={m.month}
            label={fmtMonth(m.month).slice(0, 3)}
            wert={`${fmtDurationSigned(m.standMin)} Std.`}
          />
        ))}
      </HStack>
      {laufend && (
        <Text type="supporting" size="sm" color="secondary" as="p">
          Kontostand am Monatsende. Der hellere Balken ist der laufende Monat.
        </Text>
      )}
    </VStack>
  );
}

function StackItemLabel({label, wert}: {label: string; wert?: string}) {
  return (
    <span style={{flex: 1, minInlineSize: 10, textAlign: 'center'}}>
      <VStack gap={0} align="center">
        <Text type="supporting" size="sm" color="secondary">
          {label}
        </Text>
        {wert && (
          <Text type="supporting" size="sm" color="primary" hasTabularNumbers>
            {wert}
          </Text>
        )}
      </VStack>
    </span>
  );
}
