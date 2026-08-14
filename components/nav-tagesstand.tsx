'use client';

import {HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {usePathname} from 'next/navigation';
import {fmtDuration, fmtDurationSigned} from '@/lib/format';
import {useClockOptional} from './clock-provider';

/**
 * Der Tagesstand über der Kontozeile: zwei Zahlen, sonst nichts.
 *
 * Die erste Fassung zeichnete den Tag als Miniatur-`Tagesbahn` (10 px, ohne
 * Achse) und setzte ein Sinnbild vor „Zeitkonto" — auf Fingernagelgröße las
 * sich die Bahn aber nicht als Form, sondern als unruhiger Farbfleck, und das
 * Zeichen kostete mehr Platz, als es Auskunft gab. Hier steht jetzt nur, was
 * bleibt, wenn man beides wegnimmt: zwei stille Zeilen, Bezeichnung links,
 * Zahl rechts — dieselbe Grammatik wie eine `NavStand`-Zusatzzeile, nur ohne
 * Punkt und ohne Rahmen.
 *
 * **Auf „Meine Zeit" verschwindet er.** Dort trägt die Kontextspalte beides
 * ohnehin — „Diese Woche" und die Zeitkonto-Karte stehen auf jedem der vier
 * Zeiträume rechts —, und ein drittes Mal dieselbe Zahl wäre kein Dienst,
 * sondern Lärm. Dieselbe Regel wie bei der Deckung der Stempelleiste.
 *
 * Es ist eine Auskunft, keine Handlung — gestempelt wird in der Stempelleiste
 * und im aufgeklappten Eintrag darüber, nirgends sonst. Die Fläche führt
 * deshalb auf „Meine Zeit" und nicht auf einen eigenen Ort.
 */
export function NavTagesstand({
  kontoSaldoMin,
  eingeklappt,
}: {
  kontoSaldoMin: number;
  /** In der Schiene ist kein Platz für eine zweite Textzeile. */
  eingeklappt: boolean;
}) {
  const clock = useClockOptional();
  const pfad = usePathname();

  const gedeckt = pfad === '/' || pfad.startsWith('/zeiten');
  if (eingeklappt || gedeckt || !clock) return null;

  return (
    <Link href="/" className="nav-tagesstand" aria-label="Meine Zeit heute">
      <VStack gap={0.5} paddingInline={2} paddingBlock={1.5}>
        <HStack gap={2} vAlign="center" wrap="nowrap">
          <StackItem size="fill">
            <Text type="supporting" size="sm" color="secondary">
              Heute
            </Text>
          </StackItem>
          <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
            {fmtDuration(clock.summary.workedMin)} Std.
          </Text>
        </HStack>
        <HStack gap={2} vAlign="center" wrap="nowrap">
          <StackItem size="fill">
            <Text type="supporting" size="sm" color="secondary">
              Zeitkonto
            </Text>
          </StackItem>
          {/* Dieselbe Farbunterscheidung wie auf der Konto-Karte: Bronze im
              Plus, Fehlerrot im Minus. Gold wäre falsch — ein Kontostand ist
              keine gearbeitete Zeit. */}
          <Text type="supporting" size="sm" weight="medium" hasTabularNumbers>
            <span
              style={{
                color: kontoSaldoMin >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)',
              }}
            >
              {fmtDurationSigned(kontoSaldoMin)} Std.
            </span>
          </Text>
        </HStack>
      </VStack>
    </Link>
  );
}
