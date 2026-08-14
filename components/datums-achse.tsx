'use client';

import {Text} from '@astryxdesign/core';
import type {Datumsachse} from '@/lib/datumsachse';
import {fmtMonthShort} from '@/lib/format';

/**
 * Die Beschriftung einer Datumsachse — Tageszahlen, solange sie nebeneinander
 * passen, sonst Monatsnamen.
 *
 * Der Jahresausschnitt des Teamkalenders hat es vorgeführt: bei `schritt: 5`
 * standen auf 365 Tagen dreiundsiebzig Zahlen in einer Reihe und ergaben eine
 * ununterbrochene Ziffernkette („5100250504914241610261510250…"). Ein Datum
 * war daraus nicht mehr zu lesen — und eine Achse, die man nicht lesen kann,
 * ist keine.
 *
 * Ein eigenes Modul, weil beide langen Bänder dieselbe Achse tragen: der
 * Teamkalender und das Protokollband. Zwei Beschriftungen für dieselbe Achse
 * wären zwei Maßstäbe, und genau davor bewahrt `lib/datumsachse.ts` die
 * Bänder schon bei der Geometrie.
 */
export function DatumsAchse({achse}: {achse: Datumsachse}) {
  const {tage, links, mitte, schritt, langer, monatsanfaenge} = achse;
  return (
    <span aria-hidden style={{position: 'relative', display: 'block', blockSize: 18}}>
      {langer
        ? monatsanfaenge.map((datum) => (
            <span key={datum} style={{position: 'absolute', insetBlockStart: 0, insetInlineStart: links(datum)}}>
              <Text type="supporting" size="sm" color="secondary">
                {fmtMonthShort(datum)}
              </Text>
            </span>
          ))
        : tage.map((datum, i) =>
            (i + 1) % schritt === 0 ? (
              <span
                key={datum}
                style={{
                  position: 'absolute',
                  insetBlockStart: 0,
                  insetInlineStart: mitte(i),
                  transform: 'translateX(-50%)',
                }}
              >
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {Number(datum.slice(8))}
                </Text>
              </span>
            ) : null,
          )}
    </span>
  );
}
