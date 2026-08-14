import {Heading, HStack, Text, VStack} from '@astryxdesign/core';
import type {ReactNode} from 'react';
import {HeuteDeckung} from './kopf-deckung';
import {Sinnbild, type Sinn} from './sinnbilder';
import {Zahlwert} from './zahlwert';

interface ZeitRahmenProps {
  /** The heading: a greeting on today, otherwise the period's own name. */
  titel: string;
  /**
   * Das Zeichen der Seite — dasselbe, unter dem sie in der Seitennavigation
   * steht. Wer irgendwo ankommt, sieht das Zeichen, dem er gefolgt ist. Ohne
   * Angabe steht keins da: auf „Meine Zeit / Tag" ist die Überschrift eine
   * Begrüßung, und neben einer Begrüßung steht kein Piktogramm.
   */
  sinn?: Sinn;
  /** The one number this range is about. Exactly one per view. */
  figur: string;
  /** What the number is measured against, beside it. */
  figurEinheit?: string;
  /** A balance reads positive or negative; worked time reads as a plain fact. */
  figurTon?: 'arbeit' | 'positiv' | 'negativ';
  /** Badges belonging to the period as a whole (locked month, issue count). */
  figurMeta?: ReactNode;
  /** One sentence on how the range stands. */
  stand?: ReactNode;
  /**
   * The BereichsLeiste. Sits at the foot of the header band on every range.
   * Optional, weil eine Seite ohne Zeitraum keine hat — „Mitarbeiter" blättert
   * durch nichts.
   */
  nav?: ReactNode;
  /**
   * Werkzeuge des Blattes: Ausgaben, Sammelhandlungen. Sie stehen rechts im
   * Kopf, unter den Marken — an derselben Stelle, an der bisher jede
   * Verwaltungsseite ihre Knöpfe selbst hingeschoben hat.
   */
  werkzeuge?: ReactNode;
  banner?: ReactNode;
  /**
   * Time drawn as form — the only place a timeline appears. Optional: eine
   * Liste von Personen mit Zahlen hat keine Bühne, nur Belege.
   */
  buehne?: ReactNode;
  /** The record, as rows you can act on. */
  belege?: ReactNode;
  /** The next range up plus the Zeitkonto. Always on the right. */
  kontext?: ReactNode;
  /**
   * Sagt dieser Kopf den Stand von *heute*? Dann meldet er sich der
   * Stempelleiste als Deckung an, und sie hört auf, dasselbe ein zweites Mal
   * zu sagen — solange er im Bild steht (siehe `kopf-deckung.tsx`). Nur die
   * Tagesansicht auf dem heutigen Tag darf das behaupten: jeder andere
   * Zeitraum trägt eine andere Zahl.
   */
  decktHeute?: boolean;
}

const TON: Record<NonNullable<ZeitRahmenProps['figurTon']>, string> = {
  arbeit: 'var(--color-text-primary)',
  positiv: 'var(--color-text-accent)',
  negativ: 'var(--color-error)',
};

/**
 * The frame every range of "Meine Zeit" is poured into: Kopf (who and where we
 * stand, plus the navigator), Bühne (the time as form), Belege (the record),
 * and a context rail that always holds the next range up.
 *
 * Before this, each zoom invented its own page header and flipped the column
 * topology, so switching tabs meant relearning where everything lived. Nothing
 * moves between ranges now — only the contents of the three bands change.
 */
export function ZeitRahmen(props: ZeitRahmenProps) {
  const ton = TON[props.figurTon ?? 'arbeit'];
  return (
    <VStack gap={0}>
      <VStack className="kopf-band" gap={0}>
        <VStack className="zeit-blatt kopf-blatt" gap={4} paddingInline={5} paddingBlock={5}>
          <HStack justify="between" vAlign="end" gap={4} wrap="wrap">
            <VStack gap={1}>
              {props.sinn ? (
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn={props.sinn} groesse="gross" ton="sekundaer" />
                  <Heading level={1}>{props.titel}</Heading>
                </HStack>
              ) : (
                <Heading level={1}>{props.titel}</Heading>
              )}
              <HStack className="kopf-figur" gap={2} vAlign="end" wrap="wrap">
                {/* Die eine Zahl des Zeitraums. Im laufenden Tag wächst sie von
                    selbst, beim Blättern wechselt sie den Zeitraum — in beiden
                    Fällen rollt sie herein, statt umzuspringen. */}
                <Text type="display-1" hasTabularNumbers color="inherit">
                  <span style={{color: ton}}>
                    <Zahlwert wert={props.figur} />
                  </span>
                </Text>
                {props.figurEinheit && (
                  <Text type="large" color="secondary" hasTabularNumbers>
                    {props.figurEinheit}
                  </Text>
                )}
              </HStack>
              {props.stand && (
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {props.stand}
                </Text>
              )}
              {/* Misst den Block, in dem er steht — Überschrift, Zahl und
                  Standzeile sind zusammen die Angabe, die die Leiste deckt. */}
              {props.decktHeute && <HeuteDeckung />}
            </VStack>
            {(props.figurMeta || props.werkzeuge) && (
              <VStack gap={3} align="end">
                {props.figurMeta && (
                  <HStack gap={2} vAlign="center" wrap="wrap" justify="end">
                    {props.figurMeta}
                  </HStack>
                )}
                {props.werkzeuge && (
                  <HStack gap={2} vAlign="center" wrap="wrap" justify="end">
                    {props.werkzeuge}
                  </HStack>
                )}
              </VStack>
            )}
          </HStack>

          {props.nav}
        </VStack>
      </VStack>

      <VStack className="zeit-blatt" gap={5} paddingInline={5} paddingBlock={5}>
        {props.banner}
        {/* A grid, not a wrapping row: the day stack's fixed columns make its
            min-content wider than any flex basis, which pushed the rail below a
            month's worth of lanes instead of beside them. */}
        <VStack className={props.kontext ? 'zeit-inhalt' : 'zeit-inhalt einspaltig'} gap={0}>
          <VStack gap={4}>
            {props.buehne}
            {props.belege}
          </VStack>
          {props.kontext && (
            <VStack gap={4} className="kontext-rail">
              {props.kontext}
            </VStack>
          )}
        </VStack>
      </VStack>
    </VStack>
  );
}
