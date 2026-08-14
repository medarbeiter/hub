'use client';

import {Badge, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {useState} from 'react';
import {fmtDate, fmtDateRange, fmtDuration, fmtEuro, fmtMonth} from '@/lib/format';
import {Ausklapp} from './ausklapp';
import {ReiseTafel, STATUS_VARIANT, type ReiseAnsicht} from './reise-tafel';
import {Aufklapppfeil, REISE_STATUS_SINN, Sinnbild} from './sinnbilder';

interface ReisenStapelProps {
  reisen: ReiseAnsicht[];
  /** Welche Reise offen ist — der Zustand wohnt außerhalb, weil auch das
      Gitter darüber ihn liest und die Tage dieser Reise hervorhebt. */
  offenId?: number | null;
  onOffen?: (id: number | null) => void;
  onBearbeiten: (reise: ReiseAnsicht) => void;
}

const SPALTE_ZEITRAUM = 124;
const SPALTE_SUMME = 88;
const SPALTE_STATUS = 108;
/**
 * Die Spanne als Mikrografik in fester Spalte, nicht als Bühnenband.
 *
 * Dasselbe Muster, mit dem der Saldo-Trend in den Berichten lebt. Die Lage im
 * Monat beantwortet seit dem Umbau das Gitter darüber; diese Spalte beantwortet
 * die andere Frage — wie viele Reisetage, und welche davon bringen etwas ein.
 */
const SPALTE_SPANNE = 132;
/** Ab wie vielen Tagen der Streifen zusammenfasst statt jeden Tag zu zeichnen. */
const STREIFEN_MAX = 16;

/**
 * Die Reisen des Zeitraums als Belegzeilen.
 *
 * Das war einmal die Bühne: eine Bahn je Reise über den Monat, bei null bis
 * vier Reisen also bis zu vier dünne Streifen in einer ansonsten leeren
 * Fläche. Erst im aufgeklappten Zustand zeichnet wieder die Tagesbahn — die
 * einzige Stelle, an der ein Tag gezeichnet wird.
 */
export function ReisenStapel(props: ReisenStapelProps) {
  const [eigen, setEigen] = useState<number | null>(props.offenId ?? null);
  const offen = props.offenId !== undefined ? props.offenId : eigen;
  const umschalten = (id: number) => {
    const naechste = offen === id ? null : id;
    if (props.onOffen) props.onOffen(naechste);
    else setEigen(naechste);
  };

  if (props.reisen.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="reise" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Keine Reise in diesem Zeitraum erfasst.
          </Text>
          <Text type="supporting" color="secondary">
            Erfasse eine Reise mit Abfahrt und Rückkehr – die Verpflegungspauschale und die
            Reisetage entstehen daraus von selbst.
          </Text>
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack gap={0}>
      <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2} className="spannen-achse">
        <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
          <Text type="label" size="sm" color="secondary">
            Zeitraum
          </Text>
        </span>
        <StackItem size="fill">
          <Text type="label" size="sm" color="secondary">
            Anlass
          </Text>
        </StackItem>
        <span style={{inlineSize: SPALTE_SPANNE, flexShrink: 0}}>
          <Text type="label" size="sm" color="secondary">
            Reisetage
          </Text>
        </span>
        <span style={{inlineSize: SPALTE_SUMME, flexShrink: 0}} />
        <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}} />
        <span style={{inlineSize: 16, flexShrink: 0}} />
      </HStack>
      <Divider />

      <VStack as="ol" gap={0} className="bahn-stapel">
        {props.reisen.map((reise) => {
          const istOffen = offen === reise.id;
          return (
            <VStack as="li" key={reise.id} gap={0} className="bahn-reihe">
              <button
                type="button"
                className="eintrag-zeile zeile-interaktiv"
                aria-expanded={istOffen}
                onClick={() => umschalten(reise.id)}
                style={{
                  background: istOffen ? 'var(--color-accent-muted)' : undefined,
                  borderRadius: 'var(--radius-inner)',
                }}
              >
                <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2} className="spannen-zeile">
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
                    <Text type="label" size="sm" color="secondary" hasTabularNumbers>
                      {fmtDateRange(reise.startDate, reise.endDate)}
                    </Text>
                  </span>

                  {/* Der frei gewordene Platz gehört dem Anlass — der Auskunft,
                      für die man bisher aufklappen musste. */}
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="body" size="sm">
                        {reise.zweck}
                      </Text>
                      {reise.ziel && (
                        <Text type="supporting" size="sm" color="secondary" maxLines={1}>
                          {reise.ziel}
                        </Text>
                      )}
                      <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                        {fmtDuration(reise.abwesenheitMin)} Std.
                      </Text>
                    </HStack>
                  </StackItem>

                  <span style={{inlineSize: SPALTE_SPANNE, flexShrink: 0}}>
                    <ReiseStreifen reise={reise} />
                  </span>

                  <HStack gap={1} vAlign="center" justify="end" wrap="nowrap" width={SPALTE_SUMME}>
                    <Text type="body" size="sm" hasTabularNumbers>
                      {fmtEuro(reise.summeCent)}
                    </Text>
                  </HStack>

                  <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
                    <Badge
                      variant={STATUS_VARIANT[reise.status]}
                      label={reise.statusLabel}
                      icon={<Sinnbild sinn={REISE_STATUS_SINN[reise.status]} groesse="zeile" />}
                    />
                  </span>

                  <Aufklapppfeil offen={istOffen} />
                </HStack>
              </button>

              {/* Dieselbe Bewegung wie im Tagesstapel — eine Zeile, die sich
                  öffnet, tut das in dieser Anwendung überall gleich. */}
              <Ausklapp offen={istOffen}>
                <HStack gap={3} paddingInline={2} paddingBlock={3} align="start">
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}} />
                  <StackItem size="fill">
                    <ReiseTafel reise={reise} onBearbeiten={props.onBearbeiten} zeigtStatus={false} />
                  </StackItem>
                </HStack>
              </Ausklapp>

              <Divider />
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}

/**
 * Die Reisetage als Streifen: Füllung heißt „dieser Tag bringt etwas ein",
 * gestrichelte Kante heißt „noch nicht eingereicht". Dieselben zwei Kanäle wie
 * überall, nur auf Reisetage angewandt.
 */
function ReiseStreifen({reise}: {reise: ReiseAnsicht}) {
  const beantragt = reise.status === 'entwurf';
  if (reise.tage.length > STREIFEN_MAX) {
    return (
      <HStack gap={1} vAlign="center" wrap="nowrap">
        <span aria-hidden className={['spannen-block', beantragt ? 'beantragt' : ''].filter(Boolean).join(' ')} />
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {reise.tage.length} {reise.tage.length === 1 ? 'Reisetag' : 'Reisetage'}
        </Text>
      </HStack>
    );
  }
  return (
    <figure
      className="spannen-streifen"
      aria-label={`${reise.tage.length} ${reise.tage.length === 1 ? 'Reisetag' : 'Reisetage'}, davon ${
        reise.tage.filter((t) => t.satzCent > 0).length
      } mit Anspruch`}
    >
      {reise.tage.map((tag) => (
        <span
          key={tag.datum}
          aria-hidden
          title={`${fmtDate(tag.datum)} · ${tag.grund} · ${fmtEuro(tag.satzCent)}`}
          className={['spannen-zelle', tag.satzCent > 0 ? 'zaehlt' : '', beantragt ? 'beantragt' : '']
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </figure>
  );
}

export interface JahresMonat {
  monat: string;
  summeCent: number;
  reisen: number;
  tage: number;
}

/** Das Jahr als Monatsreihe — dieselbe Balkensprache wie der Kontoverlauf. */
export function JahresStreifen({monate}: {monate: JahresMonat[]}) {
  const max = Math.max(1, ...monate.map((m) => m.summeCent));
  if (monate.every((m) => m.summeCent === 0)) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="geld" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            In diesem Jahr ist noch keine Reise erfasst.
          </Text>
          <Text type="supporting" color="secondary">
            Sobald eine Reise abgerechnet ist, erscheint sie hier im Monat ihrer Abfahrt.
          </Text>
        </VStack>
      </HStack>
    );
  }
  return (
    <VStack gap={0} role="list">
      <Divider />
      {monate.map((m) => (
        <VStack key={m.monat} gap={0} role="listitem">
          <HStack gap={3} vAlign="center" paddingBlock={2} paddingInline={2}>
            <span style={{inlineSize: 116, flexShrink: 0}}>
              <Text type="label" size="sm" color="secondary">
                {fmtMonth(m.monat)}
              </Text>
            </span>
            <StackItem size="fill">
              <span
                aria-hidden
                style={{
                  position: 'relative',
                  display: 'block',
                  blockSize: 10,
                  background: 'var(--color-background-muted)',
                  borderRadius: 'var(--radius-full)',
                }}
              >
                <span
                  style={{
                    position: 'absolute',
                    insetBlock: 0,
                    insetInlineStart: 0,
                    inlineSize: `${(m.summeCent / max) * 100}%`,
                    background: 'var(--color-text-secondary)',
                    borderRadius: 'var(--radius-full)',
                  }}
                />
              </span>
            </StackItem>
            <span style={{inlineSize: 132, flexShrink: 0, textAlign: 'end'}}>
              <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                {m.reisen > 0
                  ? `${m.reisen} ${m.reisen === 1 ? 'Reise' : 'Reisen'} · ${m.tage} ${m.tage === 1 ? 'Tag' : 'Tage'}`
                  : '–'}
              </Text>
            </span>
            <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
              <Text type="body" size="sm" hasTabularNumbers>
                {fmtEuro(m.summeCent)}
              </Text>
            </span>
          </HStack>
          <Divider />
        </VStack>
      ))}
    </VStack>
  );
}
