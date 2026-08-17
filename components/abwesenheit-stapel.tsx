'use client';

import {Badge, Button, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {useState} from 'react';
import {ART_LABEL, STATUS_LABEL, fmtTage, fmtUmfang, istAntrag} from '@/lib/abwesenheit-arten';
import type {AbwesenheitArt, AbwesenheitStatus} from '@/lib/db';
import {fmtDate, fmtDateRange} from '@/lib/format';
import {Ausklapp} from './ausklapp';
import {ABWESENHEIT_STATUS_SINN, Aufklapppfeil, Sinnbild} from './sinnbilder';

/**
 * Die festen Spalten sind so schmal wie ihr längster Inhalt, weil alles, was
 * sie zu viel nehmen, dem Band fehlt — und das Band ist das Einzige, was man
 * hier eigentlich lesen soll. Gemessen statt geschätzt: „28. Dez. – 3. Jan."
 * ist der längste Zeitraum, „12 Tage" die längste Tageszahl, und die breiteste
 * Statusmarke („Eingereicht") misst 104 px.
 */
const SPALTE_ZEITRAUM = 124;
const SPALTE_TAGE = 72;
/**
 * Die Spanne als Mikrografik in fester Spalte — nicht mehr als Bühnenband.
 *
 * Dasselbe Muster, mit dem der Saldo-Trend in den Berichten lebt: ein kleines
 * Bild in einer Spalte, nicht eine Bühne über die halbe Blattbreite. Die Lage
 * im Monat beantwortet seit dem Umbau das Gitter darüber; diese Spalte
 * beantwortet die andere Frage — wie lang ist die Spanne, und wie viel davon
 * kostet etwas.
 */
const SPALTE_SPANNE = 132;
/** Ab wie vielen Tagen der Streifen zusammenfasst statt jeden Tag zu zeichnen. */
const STREIFEN_MAX = 16;
/** Dieselbe feste Statusspalte wie im Reisenstapel, aus demselben Grund: sonst
    liefe die Datumsachse auf einem anderen Maßstab als die Bänder darunter. */
const SPALTE_STATUS = 108;

export interface AbwesenheitAnsicht {
  id: number;
  von: string;
  bis: string;
  art: AbwesenheitArt;
  status: AbwesenheitStatus;
  notiz: string | null;
  /** Nur bei einem eintägigen Freizeitausgleich gesetzt; sonst der ganze Tag. */
  minuten: number | null;
  ruecksprache_vorgesetzte: number;
  /** Kalendertage der Spanne. */
  tage: string[];
  /** Davon die Tage mit einem Soll. */
  arbeitstage: string[];
  locked: boolean;
  auFehlt: boolean;
  auDateiName: string | null;
  darfBearbeiten: boolean;
  darfEinreichen: boolean;
  darfZurueckziehen: boolean;
  entscheidungNotiz: string | null;
  selbstGenehmigt: boolean;
}

export const STATUS_VARIANT: Record<AbwesenheitStatus, 'neutral' | 'info' | 'success' | 'error'> = {
  entwurf: 'neutral',
  eingereicht: 'info',
  gemeldet: 'neutral',
  genehmigt: 'success',
  abgelehnt: 'error',
};

interface AbwesenheitStapelProps {
  abwesenheiten: AbwesenheitAnsicht[];
  /** Der Kalenderausschnitt, über den die Bänder laufen. */
  vonISO: string;
  bisISO: string;
  onBearbeiten: (a: AbwesenheitAnsicht) => void;
  onEinreichen: (id: number) => void;
  onZurueckziehen: (id: number) => void;
  onLoeschen: (id: number) => void;
  onAuNachreichen: (a: AbwesenheitAnsicht) => void;
  isPending: boolean;
}

/**
 * Die Abwesenheiten des Zeitraums als Belegzeilen.
 *
 * Bis zum Umbau war das die Bühne: eine Bahn je Spanne über einen Monat, was
 * bei einem Eintrag im Monat — dem Normalfall — eine 16 px hohe Zeile in einer
 * ansonsten leeren Fläche ergab. Die Lage im Monat zeichnet jetzt das Gitter
 * darüber; hier stehen die Einzelheiten und die Handlungen, und die Spanne
 * bleibt als Mikrografik in einer festen Spalte.
 */
export function AbwesenheitStapel(props: AbwesenheitStapelProps) {
  const [offen, setOffen] = useState<number | null>(null);

  if (props.abwesenheiten.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="abwesenheit" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Keine Abwesenheit in diesem Zeitraum.
          </Text>
          <Text type="supporting" color="secondary">
            Urlaub, Krankheit, Freizeitausgleich und Fortbildung werden als Zeitraum erfasst – vom
            ersten bis zum letzten Tag, in einem Zug.
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
            Art
          </Text>
        </StackItem>
        <span style={{inlineSize: SPALTE_SPANNE, flexShrink: 0}}>
          <Text type="label" size="sm" color="secondary">
            Spanne
          </Text>
        </span>
        <span style={{inlineSize: SPALTE_TAGE, flexShrink: 0}} />
        <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}} />
        <span style={{inlineSize: 16, flexShrink: 0}} />
      </HStack>
      <Divider />

      <VStack as="ol" gap={0} className="bahn-stapel">
        {props.abwesenheiten.map((a) => {
          const istOffen = offen === a.id;
          return (
            <VStack as="li" key={a.id} gap={0} className="bahn-reihe">
              <button
                type="button"
                className="eintrag-zeile zeile-interaktiv"
                aria-expanded={istOffen}
                onClick={() => setOffen(istOffen ? null : a.id)}
                style={{
                  background: istOffen ? 'var(--color-accent-muted)' : undefined,
                  borderRadius: 'var(--radius-inner)',
                }}
              >
                <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2} className="spannen-zeile">
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
                    <Text type="label" size="sm" color="secondary" hasTabularNumbers>
                      {fmtDateRange(a.von, a.bis)}
                    </Text>
                  </span>

                  {/* Der frei gewordene Platz gehört jetzt der Auskunft, für die
                      man vorher aufklappen musste: was für eine Abwesenheit das
                      überhaupt ist. Die Lage im Monat sagt das Gitter darüber. */}
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <HStack gap={1.5} vAlign="center" wrap="nowrap">
                        <Sinnbild sinn={a.art} groesse="zeile" ton="sekundaer" />
                        <Text type="body" size="sm">
                          {ART_LABEL[a.art]}
                        </Text>
                      </HStack>
                      {a.notiz && (
                        <Text type="supporting" size="sm" color="secondary" maxLines={1}>
                          {a.notiz}
                        </Text>
                      )}
                    </HStack>
                  </StackItem>

                  <span style={{inlineSize: SPALTE_SPANNE, flexShrink: 0}}>
                    <SpannenStreifen abwesenheit={a} />
                  </span>

                  <HStack gap={1} vAlign="center" justify="end" wrap="nowrap" width={SPALTE_TAGE}>
                    <Text type="body" size="sm" hasTabularNumbers>
                      {fmtUmfang(a.arbeitstage.length, a.minuten)}
                    </Text>
                  </HStack>

                  <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
                    <Badge
                      variant={STATUS_VARIANT[a.status]}
                      label={STATUS_LABEL[a.status]}
                      icon={<Sinnbild sinn={ABWESENHEIT_STATUS_SINN[a.status]} groesse="zeile" />}
                    />
                  </span>

                  <Aufklapppfeil offen={istOffen} />
                </HStack>
              </button>

              <Ausklapp offen={istOffen}>
                <HStack gap={3} paddingInline={2} paddingBlock={3} align="start">
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}} />
                  <StackItem size="fill">
                    <AbwesenheitTafel {...props} abwesenheit={a} />
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
 * Die Spanne als Streifen aus Tageszellen.
 *
 * Zwei Kanäle wie im alten Band, unverändert: **Füllung** heißt „dieser Tag
 * kostet etwas", **Kante** heißt „das steht fest". Über sechzehn Tagen wird
 * zusammengefasst statt gestaucht — ein Streifen aus 2-px-Splittern wäre
 * genau der Fehler, den das Monatsband gemacht hat.
 */
function SpannenStreifen({abwesenheit: a}: {abwesenheit: AbwesenheitAnsicht}) {
  const zaehlt = new Set(a.arbeitstage);
  const beantragt = a.status === 'eingereicht' || a.status === 'entwurf';

  if (a.tage.length > STREIFEN_MAX) {
    return (
      <HStack gap={1} vAlign="center" wrap="nowrap">
        <span
          aria-hidden
          className={['spannen-block', beantragt ? 'beantragt' : ''].filter(Boolean).join(' ')}
        />
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {a.tage.length} Kalendertage
        </Text>
      </HStack>
    );
  }

  return (
    <figure
      className="spannen-streifen"
      aria-label={`${fmtDate(a.von)} bis ${fmtDate(a.bis)}: ${a.tage.length} ${
        a.tage.length === 1 ? 'Kalendertag' : 'Kalendertage'
      }, davon ${fmtUmfang(a.arbeitstage.length, a.minuten)} mit Soll`}
    >
      {a.tage.map((tag) => (
        <span
          key={tag}
          aria-hidden
          title={`${fmtDate(tag)}${zaehlt.has(tag) ? '' : ' · zählt nicht'}`}
          className={[
            'spannen-zelle',
            zaehlt.has(tag) ? 'zaehlt' : '',
            beantragt ? 'beantragt' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        />
      ))}
    </figure>
  );
}

/** Eine Abwesenheit auf Arbeitsgröße: was sie ist, was sie kostet, was jetzt geht. */
function AbwesenheitTafel({
  abwesenheit: a,
  onBearbeiten,
  onEinreichen,
  onZurueckziehen,
  onLoeschen,
  onAuNachreichen,
  isPending,
}: AbwesenheitStapelProps & {abwesenheit: AbwesenheitAnsicht}) {
  return (
    <VStack gap={3}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Sinnbild sinn={a.art} groesse="gross" ton="sekundaer" />
        <Text type="body" weight="semibold">
          {ART_LABEL[a.art]}
        </Text>
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {a.tage.length} {a.tage.length === 1 ? 'Kalendertag' : 'Kalendertage'} ·{' '}
          {fmtUmfang(a.arbeitstage.length, a.minuten)} mit Soll
        </Text>
      </HStack>

      {a.notiz && (
        <Text type="supporting" color="secondary">
          {a.notiz}
        </Text>
      )}

      {a.status === 'abgelehnt' && a.entscheidungNotiz && (
        <HStack gap={1.5} vAlign="start">
          <Sinnbild sinn="zurueckweisen" groesse="zeile" ton="fehler" />
          <Text type="supporting" color="secondary">
            Zurückgewiesen: {a.entscheidungNotiz}
          </Text>
        </HStack>
      )}

      {a.selbstGenehmigt && (
        <HStack gap={1.5} vAlign="center">
          <Sinnbild sinn="hinweis" groesse="zeile" ton="sekundaer" />
          <Text type="supporting" size="sm" color="secondary">
            Von der Verwaltung selbst genehmigt – es gibt keine zweite Instanz.
          </Text>
        </HStack>
      )}

      {a.art === 'krank' && (
        <HStack gap={1.5} vAlign="center" wrap="wrap">
          <Sinnbild sinn="datei" groesse="zeile" ton={a.auFehlt ? 'warnung' : 'sekundaer'} />
          <Text type="supporting" size="sm" color="secondary">
            {a.auDateiName
              ? `Bescheinigung liegt vor: ${a.auDateiName}`
              : a.auFehlt
                ? 'Arbeitsunfähigkeitsbescheinigung fehlt (§ 5 EFZG).'
                : 'Ohne Bescheinigung – bei bis zu zwei Tagen genügt das.'}
          </Text>
        </HStack>
      )}

      {a.locked && (
        <HStack gap={1.5} vAlign="center">
          <Sinnbild sinn="gesperrt" groesse="zeile" ton="sekundaer" />
          <Text type="supporting" size="sm" color="secondary">
            Der Monat ist abgeschlossen – Änderungen nur über die Verwaltung.
          </Text>
        </HStack>
      )}

      <HStack gap={2} wrap="wrap">
        {a.darfEinreichen && (
          <Button
            label="Einreichen"
            variant="primary"
            size="sm"
            icon={<Sinnbild sinn="einreichen" />}
            isLoading={isPending}
            onClick={() => onEinreichen(a.id)}
          />
        )}
        {a.darfZurueckziehen && (
          <Button
            label="Zurückziehen"
            variant="secondary"
            size="sm"
            icon={<Sinnbild sinn="zurueckziehen" />}
            isLoading={isPending}
            onClick={() => onZurueckziehen(a.id)}
          />
        )}
        {a.darfBearbeiten && (
          <Button
            label="Bearbeiten"
            variant="secondary"
            size="sm"
            icon={<Sinnbild sinn="bearbeiten" />}
            onClick={() => onBearbeiten(a)}
          />
        )}
        {a.art === 'krank' && !a.locked && (
          <Button
            label={a.auDateiName ? 'Bescheinigung ersetzen' : 'Bescheinigung nachreichen'}
            variant="secondary"
            size="sm"
            icon={<Sinnbild sinn="datei" />}
            onClick={() => onAuNachreichen(a)}
          />
        )}
        {a.darfBearbeiten && (
          <Button
            label="Löschen"
            variant="secondary"
            size="sm"
            icon={<Sinnbild sinn="entfernen" />}
            isLoading={isPending}
            onClick={() => onLoeschen(a.id)}
          />
        )}
      </HStack>

      {a.status === 'entwurf' && istAntrag(a.art) && (
        <Text type="supporting" size="sm" color="secondary">
          Ein Entwurf ändert noch nichts. Erst mit dem Einreichen geht er zur Verwaltung.
        </Text>
      )}
    </VStack>
  );
}
