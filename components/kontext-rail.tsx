import {Card, Heading, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {fmtDate, fmtDuration, fmtDurationSigned, fmtWeekdayShort} from '@/lib/format';
import {Sinnbild} from './sinnbilder';

/**
 * The right-hand rail, on every range: whatever sits one zoom level up, plus
 * the Zeitkonto. It never moves and never changes side, so "und sonst?" always
 * has the same address.
 */

export interface RailTag {
  date: string;
  workedMin: number;
  sollMin: number;
  hasSegments: boolean;
  isFuture: boolean;
}

/** Mo–So as quiet bars: what is done, against what is expected. */
export function WochenUebersicht({days, today, titel = 'Diese Woche'}: {days: RailTag[]; today: string; titel?: string}) {
  const scaleMax = Math.max(...days.map((d) => Math.max(d.workedMin, d.sollMin)), 480);
  return (
    <Card padding={4}>
      <VStack gap={3}>
        {/* Die vier Karten der Rail sahen einander gleich; das Zeichen sagt
            jetzt vor dem Lesen, welche Frage die Karte beantwortet. */}
        <HStack gap={2} vAlign="center">
          <Sinnbild sinn="woche" groesse="gross" ton="sekundaer" />
          <Heading level={3}>{titel}</Heading>
        </HStack>
        <VStack gap={2}>
          {days.map((d) => {
            const isToday = d.date === today;
            /* Heute ohne einen einzigen Eintrag ist noch Plan, nicht Fehlanzeige.
               Die Bühne daneben zeichnet für denselben Tag längst das gestrichelte
               Soll — die Rail schrieb dazu „–", und dieselbe Seite widersprach
               sich an zwei Stellen. */
            const istPlan = (d.isFuture || (isToday && !d.hasSegments && d.workedMin === 0)) && d.sollMin > 0;
            const pct = Math.min((d.workedMin / scaleMax) * 100, 100);
            const sollPct = Math.min((d.sollMin / scaleMax) * 100, 100);
            return (
              <HStack key={d.date} gap={3} vAlign="center" className="wochen-tag">
                <span style={{inlineSize: 24, flexShrink: 0}}>
                  <Text
                    type="label"
                    size="sm"
                    color={isToday ? 'accent' : 'secondary'}
                    weight={isToday ? 'semibold' : 'normal'}
                  >
                    {fmtWeekdayShort(d.date)}
                  </Text>
                </span>
                <span
                  aria-hidden
                  style={{
                    position: 'relative',
                    flex: 1,
                    display: 'block',
                    blockSize: 10,
                    background: 'var(--color-background-muted)',
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden',
                  }}
                >
                  {/* A day still to come shows its Soll as a dashed plan, not as
                      an empty grey track: the week reads as being filled in. */}
                  {istPlan && d.workedMin === 0 ? (
                    <span
                      style={{
                        position: 'absolute',
                        insetBlock: 0,
                        insetInlineStart: 0,
                        inlineSize: `${sollPct}%`,
                        border: '1px dashed var(--color-icon-accent)',
                        background: 'var(--color-accent-muted)',
                        borderRadius: 'var(--radius-full)',
                      }}
                    />
                  ) : (
                    <>
                      {d.sollMin > 0 && (
                        <span
                          style={{
                            position: 'absolute',
                            insetBlock: 0,
                            /* Um die eigene Breite zurückgezogen: bei sollPct
                               = 100 (jeder Tag, an dem niemand die Skala nach
                               oben zog) lag die Marke genau auf der Kante und
                               wurde vom overflow:hidden ganz weggeschnitten. */
                            insetInlineStart: `calc(${sollPct}% - 2px)`,
                            inlineSize: 2,
                            background: 'var(--farbe-pause)',
                          }}
                        />
                      )}
                      <span
                        className={d.workedMin > 0 ? 'arbeit-flaeche bahn-block' : undefined}
                        style={{
                          position: 'absolute',
                          insetBlock: 0,
                          insetInlineStart: 0,
                          inlineSize: `${pct}%`,
                          background: isToday
                            ? 'linear-gradient(90deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 70%, white))'
                            : 'var(--color-accent)',
                          borderRadius: 'var(--radius-full)',
                        }}
                      />
                    </>
                  )}
                </span>
                <span style={{inlineSize: 72, flexShrink: 0, textAlign: 'end'}}>
                  <Text type="supporting" size="sm" color={d.isFuture ? 'disabled' : 'secondary'} hasTabularNumbers>
                    {/* A weekend is not "geplant" — it has no Soll to plan. */}
                    {d.hasSegments || d.workedMin > 0
                      ? `${fmtDuration(d.workedMin)} Std.`
                      : istPlan
                        ? 'geplant'
                        : '–'}
                  </Text>
                </span>
              </HStack>
            );
          })}
        </VStack>
      </VStack>
    </Card>
  );
}

/** One period against its Soll — the month behind a week, the year behind a month. */
export function ZeitraumFortschritt({
  titel,
  workedMin,
  sollMin,
  fussnote,
}: {
  titel: string;
  workedMin: number;
  sollMin: number;
  fussnote?: string;
}) {
  const pct = sollMin > 0 ? Math.min((workedMin / sollMin) * 100, 100) : 0;
  return (
    <Card padding={4}>
      <VStack gap={2}>
        <HStack gap={2} vAlign="center">
          <Sinnbild sinn="monat" groesse="gross" ton="sekundaer" />
          <Heading level={3}>{titel}</Heading>
        </HStack>
        <HStack gap={2} vAlign="end">
          <Text type="display-3" hasTabularNumbers>
            {fmtDuration(workedMin)}
          </Text>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            von {fmtDuration(sollMin)} Std.
          </Text>
        </HStack>
        <span
          aria-hidden
          style={{
            position: 'relative',
            display: 'block',
            blockSize: 10,
            background: 'var(--color-background-muted)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
          }}
        >
          <span
            className={workedMin > 0 ? 'arbeit-flaeche bahn-block' : undefined}
            style={{
              position: 'absolute',
              insetBlock: 0,
              insetInlineStart: 0,
              inlineSize: `${pct}%`,
              background: 'var(--color-accent)',
              borderRadius: 'var(--radius-full)',
            }}
          />
        </span>
        {fussnote && (
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fussnote}
          </Text>
        )}
      </VStack>
    </Card>
  );
}

/** The running Überstunden balance, and the way into its derivation. */
export function KontoKarte({balanceMin, href = '/?ansicht=konto'}: {balanceMin: number; href?: string}) {
  const positiv = balanceMin >= 0;
  return (
    <Link href={href} style={{textDecoration: 'none', color: 'inherit'}} className="zeile-interaktiv">
      <Card padding={4}>
        <VStack gap={1}>
          <HStack gap={2} vAlign="center">
            <Sinnbild sinn="konto" groesse="gross" ton="sekundaer" />
            <Heading level={3}>Zeitkonto</Heading>
          </HStack>
          <Text type="display-3" hasTabularNumbers color="inherit">
            <span style={{color: positiv ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
              {fmtDurationSigned(balanceMin)} Std.
            </span>
          </Text>
          <HStack gap={1} vAlign="center" wrap="nowrap">
            <Text type="supporting" color="secondary">
              Überstunden bis gestern · Herleitung ansehen
            </Text>
            <Sinnbild sinn="hin" groesse="zeile" ton="akzent" />
          </HStack>
        </VStack>
      </Card>
    </Link>
  );
}

/**
 * What the Zeitkonto figure is made of. On the Konto range this replaces the
 * two paragraphs of prose that used to run the full width of the page.
 */
export function KontoHerleitung({
  recordedDays,
  absenceDays,
  uncountableDays,
  missingDays,
}: {
  recordedDays: number;
  absenceDays: number;
  uncountableDays: string[];
  missingDays: string[];
}) {
  return (
    <Card padding={4}>
      <VStack gap={3}>
        <HStack gap={2} vAlign="center">
          <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
          <Heading level={3}>So entsteht die Zahl</Heading>
        </HStack>
        <VStack gap={2}>
          <HStack justify="between" gap={3}>
            <HStack gap={1.5} vAlign="center">
              <Sinnbild sinn="uhrzeit" groesse="zeile" ton="sekundaer" />
              <Text type="supporting" color="secondary">
                Tage mit erfassten Zeiten
              </Text>
            </HStack>
            <Text type="body" size="sm" hasTabularNumbers>
              {recordedDays}
            </Text>
          </HStack>
          <HStack justify="between" gap={3}>
            <HStack gap={1.5} vAlign="center">
              <Sinnbild sinn="urlaub" groesse="zeile" ton="sekundaer" />
              <Text type="supporting" color="secondary">
                Tage mit Tagesart
              </Text>
            </HStack>
            <Text type="body" size="sm" hasTabularNumbers>
              {absenceDays}
            </Text>
          </HStack>
        </VStack>
        <Text type="supporting" color="secondary">
          Für jeden gezählten Tag wird die Arbeitszeit mit dem Soll verrechnet und aufaddiert. Urlaub, Krankheit und
          Feiertage setzen das Soll auf null; Freizeitausgleich bucht es ab, Fortbildung gilt als geleistet.
        </Text>
        {(uncountableDays.length > 0 || missingDays.length > 0) && (
          <VStack gap={1}>
            {uncountableDays.length > 0 && (
              <HStack gap={1.5} vAlign="start" wrap="nowrap">
                <Sinnbild sinn="ohneEnde" groesse="zeile" ton="warnung" />
              <Text type="supporting" color="inherit">
                <span style={{color: 'var(--color-warning)'}}>
                  Nicht gezählt: {uncountableDays.length}{' '}
                  {uncountableDays.length === 1 ? 'Tag ohne Ende' : 'Tage ohne Ende'} (
                  {uncountableDays.slice(0, 3).map(fmtDate).join(', ')}
                  {uncountableDays.length > 3 && ' …'}). Ohne Endzeit lässt sich der Tag nicht verrechnen.
                </span>
              </Text>
              </HStack>
            )}
            {missingDays.length > 0 && (
              <HStack gap={1.5} vAlign="start" wrap="nowrap">
                <Sinnbild sinn="warnung" groesse="zeile" ton="warnung" />
              <Text type="supporting" color="inherit">
                <span style={{color: 'var(--color-warning)'}}>
                  Nicht gezählt: {missingDays.length}{' '}
                  {missingDays.length === 1 ? 'Arbeitstag ohne Eintrag' : 'Arbeitstage ohne Eintrag'} (
                  {missingDays.slice(0, 3).map(fmtDate).join(', ')}
                  {missingDays.length > 3 && ' …'}). Trage die Zeiten nach oder wähle eine Tagesart.
                </span>
              </Text>
              </HStack>
            )}
          </VStack>
        )}
      </VStack>
    </Card>
  );
}

/** Filler so the rail is never an awkward empty column. */
export function RailPlatzhalter({text}: {text: string}) {
  return (
    <Card padding={4}>
      <StackItem>
        <Text type="supporting" color="secondary">
          {text}
        </Text>
      </StackItem>
    </Card>
  );
}
