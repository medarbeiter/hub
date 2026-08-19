'use client';

import {Badge, Divider, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {useSearchParams} from 'next/navigation';
import {useState} from 'react';
import {
  aktionLabel,
  BEREICH_LABEL,
  erfassungsart,
  ERFASSUNG_ERKLAERUNG,
  ERFASSUNG_LABEL,
  istBereich,
} from '@/lib/protokoll-arten';
import type {PersonAngabe} from '@/lib/avatar';
import {Ausklapp} from './ausklapp';
import {PersonZeichen} from './person-zeichen';
import {Aufklapppfeil, ERFASSUNG_SINN, PROTOKOLL_BEREICH_SINN, Sinnbild} from './sinnbilder';

/**
 * Eine Protokollzeile, so wie die Seite sie braucht: fertig aufbereitet, mit
 * bereits gelesenem Vorher/Nachher. Die Aufbereitung geschieht auf dem Server
 * — über die Grenze geht nur, was sich serialisieren lässt.
 */
export interface ProtokollZeile {
  id: number;
  /** „Mi., 12.8.2026" */
  tag: string;
  /** „14:07" */
  uhrzeit: string;
  akteur: string;
  /**
   * Das Gesicht zum eingefrorenen Namen — **frisch nachgeschlagen**, während
   * `akteur` Geschichte bleibt. Die Tabelle hat mit Absicht keine
   * Fremdschlüssel: wer umbenannt wird, schreibt die Vergangenheit nicht um.
   * Ein Bild ist keine Aussage über die Handlung, sondern eine Lesehilfe, also
   * darf es der aktuellen Person folgen — und `null` sein, wenn es das Konto
   * nicht mehr gibt. Dann bleiben die Initialen des Namens von damals.
   */
  akteurBild: PersonAngabe | null;
  akteurRolle: string | null;
  betroffen: string | null;
  bereich: string;
  aktion: string;
  gegenstand: string;
  /** Der Geschäftstag, um den es ging, falls er ein anderer ist als der Tag der Handlung. */
  datum: string | null;
  fehler: string | null;
  vorher: Array<[string, string]>;
  nachher: Array<[string, string]>;
  hash: string;
  vorherHash: string;
}

interface ProtokollListeProps {
  zeilen: ProtokollZeile[];
  /** Die Verwaltung sieht die Spalte „Betrifft"; auf der eigenen Seite steht überall derselbe Name. */
  mitBetroffen: boolean;
}

/**
 * Gemessen, nicht geschätzt — und zwar gegen die Breite, die diese Liste
 * tatsächlich hat: die Belegspalte des Rahmens misst neben der 320-px-Rail
 * rund 640 px. Der erste Zuschnitt verlangte 704 px, und die Folge war nicht
 * etwa eine enge Spalte, sondern eine mit Breite **null**: „Arbeit am 6.8.2026,
 * 15:59–16:00" stand nirgends, und die Zeile lief 72 px über ihren Rahmen
 * hinaus.
 *
 * Zwei Personenspalten sind dabei ganz verschwunden, und das ist die eigentliche
 * Verbesserung: in den allermeisten Zeilen stand zweimal derselbe Name, weil
 * die meisten Menschen ihren eigenen Datensatz bearbeiten. Jetzt steht der Name
 * einmal, und *nur wenn* jemand anderes betroffen war, kommt eine zweite Zeile
 * dazu. Der seltene, interessante Fall bekommt damit die Aufmerksamkeit, die
 * vorher der häufige, langweilige verbrauchte.
 */
const SPALTE_ZEIT = 112;
const SPALTE_AKTION = 176;
const SPALTE_PERSON = 148;

/**
 * Das Protokoll als Zeilen — dieselbe Grammatik wie jeder andere Belegstapel
 * dieser Anwendung: dichte Zeilen über die volle Breite, Haarlinien dazwischen,
 * und ein Fach, das an Ort und Stelle aufgeht (`Ausklapp`).
 *
 * Der aufgeklappte Teil ist der Grund, warum es keine Tabelle ist: dort steht
 * die Gegenüberstellung Vorher/Nachher, und die braucht eine Fläche, keine
 * Zelle. „Ende: 16:30 → 17:15" ist die Auskunft, wegen der jemand ein
 * Protokoll aufschlägt.
 */
export function ProtokollListe({zeilen, mitBetroffen}: ProtokollListeProps) {
  const [offen, setOffen] = useState<number | null>(null);
  const params = useSearchParams();

  const sortierung = params.get('sortierung') === 'alt' ? 'alt' : 'neu';
  const andereSortierung = () => {
    const naechste = new URLSearchParams(params.toString());
    if (sortierung === 'neu') naechste.set('sortierung', 'alt');
    else naechste.delete('sortierung');
    naechste.delete('seite');
    return `/protokoll?${naechste.toString()}`;
  };

  if (zeilen.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="protokoll" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            Für diese Auswahl steht nichts im Protokoll.
          </Text>
          <Text type="supporting" color="secondary">
            Das ist eine Auskunft, kein Fehler: in diesem Zeitraum wurde nichts nachträglich geändert.
            Der Schalter „Auch das Stempeln“ zeigt zusätzlich die laufende Erfassung.
          </Text>
        </VStack>
      </HStack>
    );
  }

  return (
    <VStack gap={0}>
      {/* Die Kopfzeile. „Zeitpunkt" ist ein Verweis, kein Knopf: die Sortierung
          steht in der Adresse, damit sie das Neuladen überlebt und sich
          weiterreichen lässt — und damit sie ohne JavaScript funktioniert. */}
      <HStack gap={2} vAlign="center" paddingInline={2} paddingBlock={1.5} className="protokoll-kopf" wrap="nowrap">
        <span style={{inlineSize: SPALTE_ZEIT, flexShrink: 0}}>
          <Link href={andereSortierung()} className="protokoll-sortierung" scroll={false}>
            <HStack gap={1} vAlign="center" wrap="nowrap">
              <Text type="label" size="sm" color="secondary">
                Zeitpunkt
              </Text>
              <Sinnbild sinn={sortierung === 'neu' ? 'aufklappen' : 'jetzt'} groesse="zeile" ton="sekundaer" />
            </HStack>
          </Link>
        </span>
        <span style={{inlineSize: SPALTE_AKTION, flexShrink: 0}}>
          <Text type="label" size="sm" color="secondary">
            Vorgang · Erfassung
          </Text>
        </span>
        <StackItem size="fill">
          <Text type="label" size="sm" color="secondary">
            Gegenstand
          </Text>
        </StackItem>
        <span style={{inlineSize: SPALTE_PERSON, flexShrink: 0}}>
          <Text type="label" size="sm" color="secondary">
            Ausgeführt von
          </Text>
        </span>
        <span style={{inlineSize: 16, flexShrink: 0}} />
      </HStack>
      <Divider />

      <VStack as="ol" gap={0} className="bahn-stapel">
        {zeilen.map((z) => {
          const istOffen = offen === z.id;
          const erfassung = erfassungsart(z.aktion);
          return (
            <VStack as="li" key={z.id} gap={0} className="bahn-reihe">
              {/* Kein Knopf um die ganze Zeile: das Gesicht darin öffnet die
                  Personenkarte, und ein Knopf im Knopf ist kein gültiges HTML.
                  Der Knopf sitzt am Pfeil und deckt die Zeile unsichtbar ab
                  (`.zeilen-knopf::after`) — die Fläche bleibt dieselbe. */}
              <HStack
                gap={2}
                vAlign="center"
                paddingInline={2}
                paddingBlock={2}
                className="protokoll-zeile zeilen-flaeche zeile-interaktiv"
                wrap="nowrap"
                style={{
                  background: istOffen ? 'var(--color-accent-muted)' : undefined,
                  borderRadius: 'var(--radius-inner)',
                }}
              >
                  <span style={{inlineSize: SPALTE_ZEIT, flexShrink: 0}}>
                    <VStack gap={0}>
                      <Text type="supporting" size="sm" hasTabularNumbers>
                        {z.uhrzeit}
                      </Text>
                      <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                        {z.tag}
                      </Text>
                    </VStack>
                  </span>

                  {/* Der Vorgang und — direkt darunter — wie die Zeit in den
                      Datensatz kam. Zwei Zeilen wie in der Zeitspalte, und
                      bewusst hier statt beim Gegenstand: „Eintrag geändert /
                      Nachgetragen" ist ein Satz über die Handlung, nicht über
                      die Sache. Ohne die zweite Zeile musste man aus dem Namen
                      des Vorgangs erschließen, ob eine Stunde gemessen oder
                      behauptet wurde — genau die Frage, wegen der jemand ein
                      Protokoll aufschlägt. */}
                  <span style={{inlineSize: SPALTE_AKTION, flexShrink: 0}}>
                    <VStack gap={0}>
                      <HStack gap={1.5} vAlign="center" wrap="nowrap">
                        <Sinnbild
                          sinn={istBereich(z.bereich) ? PROTOKOLL_BEREICH_SINN[z.bereich] : 'protokoll'}
                          groesse="zeile"
                          ton={z.fehler ? 'fehler' : 'sekundaer'}
                        />
                        <Text type="supporting" size="sm" maxLines={1}>
                          {aktionLabel(z.aktion)}
                        </Text>
                      </HStack>
                      {erfassung && (
                        <HStack gap={1.5} vAlign="center" wrap="nowrap">
                          <Sinnbild sinn={ERFASSUNG_SINN[erfassung]} groesse="zeile" ton="sekundaer" />
                          <Text
                            type="supporting"
                            size="sm"
                            /* Das Gestempelte ist der Normalfall und tritt
                               zurück; das von Hand Erfasste und das von der
                               Maschine Gesetzte stehen in voller Tinte, weil
                               sie das sind, was jemand sucht. */
                            color={erfassung === 'gestempelt' ? 'secondary' : undefined}
                            weight={erfassung === 'gestempelt' ? undefined : 'semibold'}
                            maxLines={1}
                          >
                            {ERFASSUNG_LABEL[erfassung]}
                          </Text>
                        </HStack>
                      )}
                    </VStack>
                  </span>

                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="supporting" size="sm" color="secondary" maxLines={1}>
                        {z.gegenstand}
                      </Text>
                      {z.fehler && (
                        <Badge
                          variant="error"
                          label="Abgewiesen"
                          icon={<Sinnbild sinn="fehler" groesse="zeile" />}
                        />
                      )}
                    </HStack>
                  </StackItem>

                  {/* Ein Name, nicht zwei. Die zweite Zeile erscheint nur,
                      wenn jemand an einem fremden Datensatz gearbeitet hat —
                      und genau das ist die Zeile, die jemand sucht. */}
                  <span className="zeilen-vorn" style={{inlineSize: SPALTE_PERSON, flexShrink: 0}}>
                    <PersonZeichen
                      person={z.akteurBild}
                      ersatzName={z.akteur}
                      groesse="winzig"
                      mitName
                      unterzeile={
                        mitBetroffen && z.betroffen && z.betroffen !== z.akteur
                          ? `betrifft ${z.betroffen}`
                          : null
                      }
                    />
                  </span>

                  <button
                    type="button"
                    className="zeilen-knopf"
                    aria-expanded={istOffen}
                    aria-label={`${z.tag} ${z.uhrzeit}, ${aktionLabel(z.aktion)} – Einzelheiten`}
                    onClick={() => setOffen(istOffen ? null : z.id)}
                  >
                    <Aufklapppfeil offen={istOffen} />
                  </button>
                </HStack>

              <Ausklapp offen={istOffen}>
                <ZeilenTafel zeile={z} />
              </Ausklapp>

              <Divider />
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}

/** Was in einer Zeile steckt: die Gegenüberstellung, der Grund, das Siegel. */
function ZeilenTafel({zeile}: {zeile: ProtokollZeile}) {
  const felder = [...new Set([...zeile.vorher.map(([k]) => k), ...zeile.nachher.map(([k]) => k)])];
  const vorher = new Map(zeile.vorher);
  const nachher = new Map(zeile.nachher);
  const erfassung = erfassungsart(zeile.aktion);

  return (
    <VStack gap={3} paddingInline={2} paddingBlock={3}>
      <HStack gap={2} vAlign="center" wrap="wrap">
        <Text type="supporting" weight="semibold">
          {aktionLabel(zeile.aktion)}
        </Text>
        <Badge
          variant="neutral"
          label={istBereich(zeile.bereich) ? BEREICH_LABEL[zeile.bereich] : zeile.bereich}
          icon={
            <Sinnbild
              sinn={istBereich(zeile.bereich) ? PROTOKOLL_BEREICH_SINN[zeile.bereich] : 'protokoll'}
              groesse="zeile"
            />
          }
        />
        {erfassung && (
          <Badge
            variant="neutral"
            label={ERFASSUNG_LABEL[erfassung]}
            icon={<Sinnbild sinn={ERFASSUNG_SINN[erfassung]} groesse="zeile" />}
          />
        )}
        {zeile.datum && (
          <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
            betrifft den {zeile.datum}
          </Text>
        )}
      </HStack>

      {/* Der ganze Satz, nicht nur das Wort. Hier ist Platz dafür, und die
          Unterscheidung zwischen gemessener und behaupteter Zeit ist genau
          die, die ein Prüfer erklärt haben will. */}
      {erfassung && (
        <HStack gap={1.5} vAlign="start" wrap="nowrap">
          <span style={{display: 'flex', paddingBlockStart: 'var(--spacing-0-5)'}}>
            <Sinnbild sinn={ERFASSUNG_SINN[erfassung]} groesse="zeile" ton="sekundaer" />
          </span>
          <Text type="supporting" size="sm" color="secondary">
            {ERFASSUNG_ERKLAERUNG[erfassung]}
          </Text>
        </HStack>
      )}

      {zeile.fehler && (
        <HStack gap={1.5} vAlign="start" wrap="nowrap">
          <span style={{display: 'flex', paddingBlockStart: 'var(--spacing-0-5)'}}>
            <Sinnbild sinn="fehler" groesse="zeile" ton="fehler" />
          </span>
          <Text type="supporting" size="sm" color="secondary">
            Abgewiesen: {zeile.fehler}
          </Text>
        </HStack>
      )}

      {felder.length > 0 ? (
        <VStack gap={1}>
          {felder.map((feld) => {
            const alt = vorher.get(feld);
            const neu = nachher.get(feld);
            const geaendert = alt !== undefined && neu !== undefined && alt !== neu;
            // Ein unverändertes Feld steht einmal da, nicht zweimal
            // nebeneinander: „Arbeit  Arbeit" liest sich als Darstellungsfehler
            // und macht die eine Zeile, die sich wirklich geändert hat,
            // schwerer zu finden.
            const unveraendert = alt !== undefined && neu !== undefined && alt === neu;
            return (
              <HStack key={feld} gap={2} vAlign="center" wrap="wrap">
                <span style={{inlineSize: 132, flexShrink: 0}}>
                  <Text type="supporting" size="sm" color="secondary">
                    {feld}
                  </Text>
                </span>
                {unveraendert ? (
                  <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                    {neu}
                  </Text>
                ) : (
                  <>
                    {alt !== undefined && (
                      <Text
                        type="supporting"
                        size="sm"
                        color="secondary"
                        hasTabularNumbers
                        /* Kein Durchstreichen: ein durchgestrichener Wert in
                           einem Zeitnachweis liest sich, als sei er ungültig
                           gewesen. Er war gültig — er ist bloß nicht mehr
                           aktuell. */
                      >
                        {alt}
                      </Text>
                    )}
                    {geaendert && <Sinnbild sinn="hin" groesse="zeile" ton="sekundaer" />}
                    {neu !== undefined && (
                      <Text type="supporting" size="sm" weight="semibold" hasTabularNumbers>
                        {neu}
                      </Text>
                    )}
                  </>
                )}
              </HStack>
            );
          })}
        </VStack>
      ) : (
        <Text type="supporting" size="sm" color="secondary">
          Zu diesem Vorgang gibt es keine Werte gegenüberzustellen – er hat nichts überschrieben.
        </Text>
      )}

      {/* Das Siegel. Es steht hier nicht, damit jemand es liest, sondern damit
          sichtbar ist, dass es existiert: die Zeile trägt den Fingerabdruck
          ihres eigenen Inhalts und den ihrer Vorgängerin. Wer eine Zeile
          herausnimmt, zerreißt die Kette an dieser Stelle. */}
      <HStack gap={1.5} vAlign="center" wrap="wrap">
        <Sinnbild sinn="siegel" groesse="zeile" ton="sekundaer" />
        <Text type="supporting" size="sm" color="secondary">
          Siegel <code className="protokoll-hash">{zeile.hash.slice(0, 12)}</code> · folgt auf{' '}
          <code className="protokoll-hash">{zeile.vorherHash.slice(0, 12)}</code>
        </Text>
      </HStack>
    </VStack>
  );
}
