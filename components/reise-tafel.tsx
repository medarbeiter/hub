'use client';

import {Badge, Banner, Button, Divider, HStack, StackItem, Text, TextArea, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {
  belegDeleteAction,
  reiseDeleteAction,
  reiseEinreichenAction,
  reiseGenehmigenAction,
  reiseZurueckweisenAction,
  reiseZurueckziehenAction,
} from '@/app/actions';
import type {ReiseStatus} from '@/lib/db';
import {
  fmtDate,
  fmtDateRange,
  fmtDuration,
  fmtEuro,
  fmtTime,
  fmtWeekdayShort,
  hourTicks,
  segmentPoints,
  spanOf,
  type TimelineSegment,
} from '@/lib/format';
import type {TagArt} from '@/lib/pauschale';
import type {PersonAngabe} from '@/lib/avatar';
import {PersonZeichen} from './person-zeichen';
import {BelegDialog} from './beleg-felder';
import {useMelde} from './melde';
import {REISE_STATUS_SINN, Sinnbild, TAGART_SINN} from './sinnbilder';
import {Tagesbahn} from './tagesbahn';

export interface BelegAnsicht {
  id: number;
  artLabel: string;
  datum: string;
  betragCent: number;
  beschreibung: string | null;
  hatDatei: boolean;
}

export interface ReiseTagAnsicht {
  datum: string;
  art: TagArt;
  artLabel: string;
  grund: string;
  abwesenheitMin: number;
  satzCent: number;
  /** Die Abwesenheit an genau diesem Kalendertag. */
  vonMin: number;
  bisMin: number;
  erfuellt: boolean;
  /** Wohin die Abwesenheit hätte reichen müssen; nur am eintägigen Reisetag. */
  schwelleMin: number | null;
  /** Was an diesem Tag gestempelt wurde — der Beleg neben der Behauptung. */
  segments: TimelineSegment[];
}

export interface ReiseAnsicht {
  id: number;
  userName: string | null;
  /** Das Profilzeichen der reisenden Person — nur, wo sie geprüft wird. */
  person?: PersonAngabe | null;
  startDate: string;
  startMin: number;
  endDate: string;
  endMin: number;
  zweck: string;
  ziel: string | null;
  status: ReiseStatus;
  statusLabel: string;
  entscheidungNotiz: string | null;
  eingereichtAm: string | null;
  abwesenheitMin: number;
  pauschaleCent: number;
  belegeCent: number;
  summeCent: number;
  tage: ReiseTagAnsicht[];
  belege: BelegAnsicht[];
  locked: boolean;
  saetzeAktuell: boolean;
  darfBearbeiten: boolean;
  darfEinreichen: boolean;
  darfZurueckziehen: boolean;
  darfPruefen: boolean;
}

export const STATUS_VARIANT: Record<ReiseStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  entwurf: 'neutral',
  eingereicht: 'info',
  genehmigt: 'success',
  abgelehnt: 'error',
};

const SPALTE_TAG = 76;
const SPALTE_BETRAG = 96;

/**
 * Eine Reise in voller Größe: jeder Reisetag als Bahn mit der Abwesenheitsspange
 * darunter, daneben die Regel, die den Betrag ergeben hat.
 *
 * Dieselbe Tafel bedient beide Seiten. Der Mitarbeiter sieht seine Abrechnung,
 * die Verwaltung sieht sie über den gestempelten Tagen derselben Person — genau
 * die Frage, die eine Prüfung beantworten muss.
 */
export function ReiseTafel({
  reise,
  onBearbeiten,
  zeigtStatus = true,
}: {
  reise: ReiseAnsicht;
  onBearbeiten?: (reise: ReiseAnsicht) => void;
  /**
   * Aus einem Stapel heraus `false`: die aufgeklappte Zeile darüber trägt die
   * Statusmarke bereits, und zweimal „Eingereicht" übereinander sagt nichts
   * doppelt so laut. „Monat abgeschlossen" bleibt in beiden Fällen stehen —
   * das steht nirgends sonst.
   */
  zeigtStatus?: boolean;
}) {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, start] = useTransition();
  const [belegOffen, setBelegOffen] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [ablehnen, setAblehnen] = useState(false);
  const [grund, setGrund] = useState('');

  const lauf = (fn: () => Promise<{error: string | null}>) =>
    start(async () => {
      const {error} = await fn();
      if (error) melde({ton: 'fehler', titel: error, dauerhaft: true});
      else {
        setLoeschen(false);
        setAblehnen(false);
        setGrund('');
      }
      router.refresh();
    });

  // Ein gemeinsamer Ausschnitt für alle Reisetage: nur so sind sie vergleichbar.
  const span = spanOf(
    reise.tage.flatMap((t) => [
      ...segmentPoints(t.segments, {isToday: false, nowMin: 0}),
      t.vonMin,
      t.bisMin,
      ...(t.schwelleMin != null ? [t.schwelleMin] : []),
    ]),
    8,
  );

  return (
    <VStack gap={4}>
      {/* Nur in der Prüfung gesetzt: wer seine eigene Reise ansieht, weiß, wer
          gereist ist. Wer zwölf fremde nachrechnet, entscheidet hier über
          einen bestimmten Menschen und soll ihn sehen. */}
      {reise.person && (
        <PersonZeichen
          person={reise.person}
          groesse="karte"
          mitName
          betont
          unterzeile={reise.eingereichtAm ? `Eingereicht am ${fmtDate(reise.eingereichtAm.slice(0, 10))}` : null}
        />
      )}
      <HStack justify="between" vAlign="start" gap={3} wrap="wrap">
        <VStack gap={0.5}>
          <HStack gap={2} vAlign="center" wrap="nowrap">
            <Sinnbild sinn="reise" ton="sekundaer" />
            <Text type="body" weight="semibold">
              {reise.zweck}
            </Text>
          </HStack>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtDateRange(reise.startDate, reise.endDate)} · {fmtTime(reise.startMin)} bis{' '}
            {fmtTime(reise.endMin)}
            {reise.ziel ? ` · ${reise.ziel}` : ''} · {fmtDuration(reise.abwesenheitMin)} Std. abwesend
          </Text>
        </VStack>
        <HStack gap={2} vAlign="center" wrap="wrap">
          {reise.locked && (
            <Badge variant="info" label="Monat abgeschlossen" icon={<Sinnbild sinn="gesperrt" groesse="zeile" />} />
          )}
          {zeigtStatus && (
            <Badge
              variant={STATUS_VARIANT[reise.status]}
              label={reise.statusLabel}
              icon={<Sinnbild sinn={REISE_STATUS_SINN[reise.status]} groesse="zeile" />}
            />
          )}
        </HStack>
      </HStack>

      {reise.status === 'abgelehnt' && reise.entscheidungNotiz && (
        <Banner
          status="warning"
          title="Zurückgewiesen"
          description={reise.entscheidungNotiz}
        />
      )}

      {/* Tag für Tag: die gestempelte Zeit, die Abwesenheit darunter, die Regel
          daneben. Die Stundenachse wird einmal für den ganzen Stapel
          beschriftet, die Bahnen tragen nur die Striche — sonst liefe das
          Raster nicht durch die Reise hindurch. */}
      <HStack gap={3} vAlign="center" wrap="nowrap">
        <span style={{inlineSize: SPALTE_TAG, flexShrink: 0}} />
        <StackItem size="fill">
          <span aria-hidden style={{position: 'relative', display: 'block', blockSize: 18}}>
            {hourTicks(span).map((h) => (
              <span
                key={h}
                style={{
                  position: 'absolute',
                  insetBlockStart: 0,
                  insetInlineStart: `${((h * 60 - span.from) / (span.to - span.from)) * 100}%`,
                  transform: 'translateX(-50%)',
                }}
              >
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {String(h).padStart(2, '0')}
                </Text>
              </span>
            ))}
          </span>
        </StackItem>
        <span style={{inlineSize: SPALTE_BETRAG, flexShrink: 0}} />
      </HStack>

      <VStack as="ol" gap={0} className="bahn-stapel">
        {reise.tage.map((tag) => (
          <VStack as="li" key={tag.datum} gap={0} className="bahn-reihe">
            <HStack gap={3} vAlign="center" paddingBlock={2} wrap="nowrap">
              <span style={{inlineSize: SPALTE_TAG, flexShrink: 0}}>
                <Text type="label" size="sm" color="secondary" hasTabularNumbers>
                  {fmtWeekdayShort(tag.datum)} {Number(tag.datum.slice(8))}.
                </Text>
              </span>

              <StackItem size="fill">
                <Tagesbahn
                  date={tag.datum}
                  segments={tag.segments}
                  isToday={false}
                  nowMin={0}
                  span={span}
                  groesse="zeile"
                  achse="raster"
                  abwesenheit={{
                    vonMin: tag.vonMin,
                    bisMin: tag.bisMin,
                    erfuellt: tag.erfuellt,
                    schwelleMin: tag.schwelleMin,
                  }}
                />
              </StackItem>

              <span style={{inlineSize: SPALTE_BETRAG, flexShrink: 0, textAlign: 'end'}}>
                <Text type="body" size="sm" hasTabularNumbers>
                  {fmtEuro(tag.satzCent)}
                </Text>
              </span>
            </HStack>

            <HStack gap={3} paddingBlock={0.5}>
              <span style={{inlineSize: SPALTE_TAG, flexShrink: 0}} />
              <StackItem size="fill">
                {/* Abflug, unterwegs, Landung: die Regel, die den Satz ergeben
                    hat, ist an der Zeile ablesbar, bevor man sie liest. */}
                <HStack gap={1.5} vAlign="center" wrap="nowrap">
                  <Sinnbild sinn={TAGART_SINN[tag.art]} groesse="zeile" ton="sekundaer" />
                  <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                    {tag.grund} · {fmtDuration(tag.abwesenheitMin)} Std. abwesend
                  </Text>
                </HStack>
              </StackItem>
              <span style={{inlineSize: SPALTE_BETRAG, flexShrink: 0}} />
            </HStack>

            <Divider />
          </VStack>
        ))}
      </VStack>

      {/* Belege */}
      <VStack gap={2}>
        <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
          <HStack gap={1.5} vAlign="center">
            <Sinnbild sinn="beleg" groesse="zeile" ton="sekundaer" />
            <Text type="label" color="secondary">
              Belege
            </Text>
          </HStack>
          {reise.darfBearbeiten && (
            <Button
              label="Beleg hinzufügen"
              variant="secondary"
              size="sm"
              icon={<Sinnbild sinn="hinzufuegen" />}
              onClick={() => setBelegOffen(true)}
            />
          )}
        </HStack>

        {reise.belege.length === 0 ? (
          <HStack gap={3} vAlign="start" paddingBlock={2} wrap="nowrap">
            <Sinnbild sinn="beleg" groesse="leer" ton="sekundaer" />
            <Text type="supporting" color="secondary">
              Keine Belege erfasst. Übernachtung, Parken und Tickets kommen hier dazu – die
              Verpflegungspauschale oben braucht keinen Beleg.
            </Text>
          </HStack>
        ) : (
          <VStack gap={0} role="list">
            <Divider />
            {reise.belege.map((beleg) => (
              <VStack key={beleg.id} gap={0} role="listitem">
                <HStack gap={3} vAlign="center" paddingBlock={2} wrap="wrap">
                  <span style={{inlineSize: 96, flexShrink: 0}}>
                    <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                      {fmtDate(beleg.datum)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 116, flexShrink: 0}}>
                    <Text type="body" size="sm">
                      {beleg.artLabel}
                    </Text>
                  </span>
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="supporting" size="sm" color="secondary">
                        {beleg.beschreibung ?? '—'}
                      </Text>
                      {beleg.hatDatei && (
                        <Link
                          href={`/api/beleg/${beleg.id}`}
                          target="_blank"
                          style={{textDecoration: 'none'}}
                        >
                          <HStack gap={1} vAlign="center">
                            <Sinnbild sinn="datei" groesse="zeile" ton="akzent" />
                            <Text type="supporting" size="sm" color="accent">
                              Beleg öffnen
                            </Text>
                          </HStack>
                        </Link>
                      )}
                    </HStack>
                  </StackItem>
                  <span style={{inlineSize: SPALTE_BETRAG, flexShrink: 0, textAlign: 'end'}}>
                    <Text type="body" size="sm" hasTabularNumbers>
                      {fmtEuro(beleg.betragCent)}
                    </Text>
                  </span>
                  {reise.darfBearbeiten && (
                    <Button
                      label="Entfernen"
                      variant="ghost"
                      size="sm"
                      isLoading={isPending}
                      onClick={() => lauf(() => belegDeleteAction(beleg.id))}
                    />
                  )}
                </HStack>
                <Divider />
              </VStack>
            ))}
          </VStack>
        )}
      </VStack>

      {/* Die Summe, so gerechnet wie sie dasteht. */}
      <VStack gap={1}>
        <HStack justify="between" gap={3}>
          <HStack gap={1.5} vAlign="center">
            <Sinnbild sinn="verpflegung" groesse="zeile" ton="sekundaer" />
            <Text type="supporting" color="secondary">
              Verpflegungspauschale
            </Text>
          </HStack>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtEuro(reise.pauschaleCent)}
          </Text>
        </HStack>
        <HStack justify="between" gap={3}>
          <HStack gap={1.5} vAlign="center">
            <Sinnbild sinn="beleg" groesse="zeile" ton="sekundaer" />
            <Text type="supporting" color="secondary">
              Belege
            </Text>
          </HStack>
          <Text type="supporting" color="secondary" hasTabularNumbers>
            {fmtEuro(reise.belegeCent)}
          </Text>
        </HStack>
        <Divider />
        <HStack justify="between" gap={3} vAlign="center">
          <Text type="body" weight="semibold">
            Erstattung
          </Text>
          <Text type="body" weight="semibold" hasTabularNumbers>
            {fmtEuro(reise.summeCent)}
          </Text>
        </HStack>
        {!reise.saetzeAktuell && (
          <Text type="supporting" size="sm" color="secondary">
            Gerechnet mit den Sätzen, die beim Einreichen galten.
          </Text>
        )}
      </VStack>

      {/* Aktionen */}
      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
        <HStack gap={2} vAlign="center" wrap="wrap">
          {reise.darfBearbeiten && onBearbeiten && (
            <Button
              label="Bearbeiten"
              variant="ghost"
              size="sm"
              icon={<Sinnbild sinn="bearbeiten" />}
              onClick={() => onBearbeiten(reise)}
            />
          )}
          {reise.darfBearbeiten &&
            (loeschen ? (
              <HStack gap={2} vAlign="center">
                <Text type="supporting">Wirklich löschen?</Text>
                <Button
                  label="Löschen"
                  variant="destructive"
                  size="sm"
                  isLoading={isPending}
                  icon={<Sinnbild sinn="entfernen" />}
                  onClick={() => lauf(() => reiseDeleteAction(reise.id))}
                />
                <Button label="Abbrechen" variant="ghost" size="sm" onClick={() => setLoeschen(false)} />
              </HStack>
            ) : (
              <Button
                label="Reise löschen"
                variant="ghost"
                size="sm"
                /* Der Auslöser trug dieselbe stille Tinte wie „Bearbeiten"
                   daneben — der Weg ins Löschen sah aus wie jeder andere.
                   Die Fehlerfarbe statt der vollen destruktiven Fläche: die
                   Bestätigung eine Zeile weiter ist die laute Schaltfläche,
                   nicht schon der Weg dorthin. */
                style={{color: 'var(--color-error)'}}
                icon={<Sinnbild sinn="entfernen" />}
                onClick={() => setLoeschen(true)}
              />
            ))}
        </HStack>

        <HStack gap={2} vAlign="center" wrap="wrap">
          {reise.darfZurueckziehen && (
            <Button
              label="Zurückziehen"
              variant="ghost"
              size="sm"
              isLoading={isPending}
              icon={<Sinnbild sinn="zurueckziehen" />}
              onClick={() => lauf(() => reiseZurueckziehenAction(reise.id))}
            />
          )}
          {reise.darfEinreichen && (
            <Button
              label="Zur Prüfung einreichen"
              variant="primary"
              size="sm"
              isLoading={isPending}
              icon={<Sinnbild sinn="einreichen" />}
              onClick={() => lauf(() => reiseEinreichenAction(reise.id))}
            />
          )}
          {reise.darfPruefen &&
            (ablehnen ? (
              <VStack gap={2} width={320}>
                <TextArea
                  label="Grund der Zurückweisung"
                  value={grund}
                  onChange={setGrund}
                  placeholder="z. B. Bitte den Beleg für die Übernachtung nachreichen."
                  rows={2}
                />
                <HStack gap={2} justify="end">
                  <Button label="Abbrechen" variant="ghost" size="sm" onClick={() => setAblehnen(false)} />
                  <Button
                    label="Zurückweisen"
                    variant="secondary"
                    size="sm"
                    isLoading={isPending}
                    icon={<Sinnbild sinn="zurueckweisen" />}
                    onClick={() => lauf(() => reiseZurueckweisenAction(reise.id, grund))}
                  />
                </HStack>
              </VStack>
            ) : (
              <>
                <Button
                  label="Zurückweisen"
                  variant="secondary"
                  size="sm"
                  icon={<Sinnbild sinn="zurueckweisen" />}
                  onClick={() => setAblehnen(true)}
                />
                <Button
                  label="Genehmigen"
                  variant="primary"
                  size="sm"
                  isLoading={isPending}
                  icon={<Sinnbild sinn="genehmigen" />}
                  onClick={() => lauf(() => reiseGenehmigenAction(reise.id))}
                />
              </>
            ))}
        </HStack>
      </HStack>

      {belegOffen && (
        <BelegDialog
          isOpen={belegOffen}
          onOpenChange={setBelegOffen}
          reiseId={reise.id}
          vonISO={reise.startDate}
          bisISO={reise.endDate}
        />
      )}
    </VStack>
  );
}
