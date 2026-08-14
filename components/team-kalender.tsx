'use client';

import {Badge, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {ART_LABEL, fmtTage, tageDerSpanne} from '@/lib/abwesenheit-arten';
import type {AbwesenheitArt} from '@/lib/db';
import {fmtDate, fmtDateLong, fmtDateRange, fmtMonthShort, mondayOf} from '@/lib/format';
import {
  WOCHENTAGE,
  kalendergitter,
  rasterStufe,
  wochenraster,
  type RasterWoche,
} from '@/lib/kalendergitter';
import {GitterMarke, GitterMehr, Monatsgitter, type GitterZelle} from './monatsgitter';
import {Sinnbild} from './sinnbilder';

/**
 * Eine Abwesenheit, wie der Teamkalender sie kennt.
 *
 * `art` ist absichtlich optional: für Kolleginnen und Kollegen wird sie am
 * Server nicht mitgeschickt. Nicht ausgeblendet, sondern gar nicht erst
 * gesendet — was im Browser ankommt, ist einsehbar, und der Unterschied
 * zwischen „Urlaub" und „Krank" ist eine Gesundheitsangabe nach Art. 9 DSGVO.
 */
export interface KalenderSpanne {
  id: number;
  von: string;
  bis: string;
  /** Nur für die Verwaltung und für die eigene Zeile. */
  art: AbwesenheitArt | null;
  /** Wirksam (genehmigt/gemeldet) oder erst beantragt. */
  beantragt: boolean;
  /** Kalendertage im gezeigten Ausschnitt, die ein Soll tragen. */
  arbeitstage: number;
  /** Genau die Tage aus `arbeitstage` — die Zellen, die gefüllt werden. */
  zaehlendeTage: string[];
}

export interface KalenderZeile {
  userId: number;
  name: string;
  /** Die eigene Zeile wird hervorgehoben — sie ist der Anker im Blatt. */
  selbst: boolean;
  spannen: KalenderSpanne[];
}

/** Wie viele Namen in eine Zelle passen, bevor gekürzt wird. Gemessen, nicht geraten. */
const MARKEN_JE_ZELLE = 3;

const SPALTE_NAME = 148;

/** Der Nachname allein — in einer 120-px-Zelle ist er die Auskunft, die trägt. */
function kurzname(name: string): string {
  const teile = name.trim().split(/\s+/);
  return teile.length > 1 ? teile[teile.length - 1]! : name;
}

interface TagesMarke {
  name: string;
  art: AbwesenheitArt | null;
  beantragt: boolean;
  /** Trägt dieser Tag ein Soll? Ein Wochenende im Urlaub kostet nichts. */
  zaehlt: boolean;
  selbst: boolean;
}

/** Wer an welchem Tag weg ist — einmal gerechnet, von Gitter und Kurve gelesen. */
function belegungProTag(zeilen: KalenderZeile[]): Map<string, TagesMarke[]> {
  const proTag = new Map<string, TagesMarke[]>();
  for (const zeile of zeilen) {
    for (const spanne of zeile.spannen) {
      const zaehlt = new Set(spanne.zaehlendeTage);
      for (const tag of tageDerSpanne(spanne.von, spanne.bis)) {
        const liste = proTag.get(tag) ?? [];
        liste.push({
          name: zeile.name,
          art: spanne.art,
          beantragt: spanne.beantragt,
          zaehlt: zaehlt.has(tag),
          selbst: zeile.selbst,
        });
        proTag.set(tag, liste);
      }
    }
  }
  // Die eigene Zeile zuerst, danach alphabetisch: wer sein eigenes Blatt liest,
  // sucht sich selbst, und eine gekürzte Zelle darf ihn nicht wegschneiden.
  for (const liste of proTag.values()) {
    liste.sort((a, b) => Number(b.selbst) - Number(a.selbst) || a.name.localeCompare(b.name, 'de'));
  }
  return proTag;
}

interface TeamKalenderProps {
  zeilen: KalenderZeile[];
  /** Der Monat, um den es geht, als YYYY-MM. */
  monat: string;
  /** Heute, wenn es in den Ausschnitt fällt — sonst null. */
  heute: string | null;
  /** Tage ohne Soll: Wochenenden und Feiertage. */
  ruhetage: string[];
}

/**
 * Wer wann weg ist — als Monatskalender, nicht als Bahn je Person.
 *
 * Die Bahnen waren die falsche Form, und zwar messbar: neun Spuren, um eine
 * Abwesenheit zu zeigen, rund ein Prozent Tinte auf neunundneunzig Prozent
 * Spur, und die Frage, wegen der man morgens überhaupt hierher sieht — „kann
 * ich Freitag den 21. weg?" — nur durch Abzählen von Zellen zu beantworten.
 * Eine Gantt-Bahn belohnt dichte, überlappende Dauern; Abwesenheiten sind
 * dünn gesät, überschneiden sich selten und sind vor allem im Kalender
 * verortet. Das Band optimierte also die Achse, auf der die Daten kaum
 * variieren, und warf die weg, auf der sie es tun.
 *
 * Im Gitter kehrt sich auch die Leere um: ein ruhiger Monat ist ein stilles
 * Raster, ein voller ist sichtbar dicht — vorher wurde die Seite umso leerer,
 * je mehr Mitarbeiter es gab.
 *
 * Was aus dem Band unverändert übernommen ist: eine Spanne erscheint als ihre
 * einzelnen Tage, und die zwei Kanäle kreuzen sich nie — **Füllung** sagt, ob
 * der Tag etwas kostet, **Kante**, ob er feststeht.
 *
 * Kein Gold. Abwesenheit ist keine gearbeitete Zeit — dieselbe Regel, aus der
 * die Abwesenheitsspange im Reiseband ihr Steingrau bezieht.
 */
export function TeamKalender({zeilen, monat, heute, ruhetage}: TeamKalenderProps) {
  const gitter = kalendergitter(monat);
  const ruhe = new Set(ruhetage);
  const proTag = belegungProTag(zeilen);

  if (zeilen.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="teamkalender" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          Keine Mitarbeiter erfasst.
        </Text>
      </HStack>
    );
  }

  const zelle = (datum: string): GitterZelle => {
    const marken = proTag.get(datum) ?? [];
    if (marken.length === 0) return {beschriftung: `${fmtDateLong(datum)}: niemand abwesend`};

    const gezeigt = marken.slice(0, MARKEN_JE_ZELLE);
    const rest = marken.length - gezeigt.length;
    return {
      // Nur, wenn mehr als einer weg ist: eine „1" neben einem einzigen Namen
      // wäre die Zahl der Zeilen darunter und damit keine Nachricht.
      zaehler: marken.length > 1 ? marken.length : null,
      beschriftung: `${fmtDateLong(datum)}: ${marken
        .map((m) => `${m.name}${m.art ? ` (${ART_LABEL[m.art]})` : ''}${m.beantragt ? ', beantragt' : ''}`)
        .join('; ')}`,
      inhalt: (
        <>
          {gezeigt.map((m, i) => (
            <GitterMarke
              key={`${m.name}-${i}`}
              label={kurzname(m.name)}
              titel={`${m.name}${m.art ? ` · ${ART_LABEL[m.art]}` : ''}${m.beantragt ? ' · beantragt' : ''}`}
              zeichen={m.art ? <Sinnbild sinn={m.art} groesse="zeile" ton="sekundaer" /> : undefined}
              beantragt={m.beantragt}
              leer={!m.zaehlt}
            />
          ))}
          {rest > 0 && (
            <GitterMehr anzahl={rest} titel={marken.slice(MARKEN_JE_ZELLE).map((m) => m.name).join(', ')} />
          )}
        </>
      ),
    };
  };

  return (
    <Monatsgitter gitter={gitter} ruhetage={ruhe} heute={heute} zelle={zelle} zellhoehe={82} />
  );
}

interface BelegungsKurveProps {
  zeilen: KalenderZeile[];
  monat: string;
  /** Wie viele gleichzeitig als unbedenklich gelten. Null = keine Grenze gesetzt. */
  grenze: number | null;
  gesamt: number;
}

/**
 * Wie viele gleichzeitig weg sind, Tag für Tag.
 *
 * Das ist die Zahl, wegen der die Verwaltung überhaupt in den Kalender sieht —
 * und die einzige Größe dieser Oberfläche, für die eine durchlaufende Achse
 * tatsächlich das richtige Gerät ist: eine dichte Zahl über die Zeit. Das Band
 * überlebt hier also, in dem Beruf, für den es taugt. Bis zum Umbau stand die
 * Auskunft als Nachsatz in der Standzeile („am meisten am Do, 6. August: 1").
 *
 * Gezählt wird nur, was feststeht: ein Antrag bindet nichts.
 */
export function BelegungsKurve({zeilen, monat, grenze, gesamt}: BelegungsKurveProps) {
  const gitter = kalendergitter(monat);
  const proTag = belegungProTag(zeilen);

  const tage = gitter.monatsTage.map((datum) => {
    const marken = (proTag.get(datum) ?? []).filter((m) => !m.beantragt && m.zaehlt);
    // Eine Person zählt einmal, auch wenn zwei Spannen sie an diesem Tag
    // berühren (Krank über Urlaub ist nach § 9 BUrlG ausdrücklich erlaubt).
    return {datum, anzahl: new Set(marken.map((m) => m.name)).size};
  });

  if (tage.every((t) => t.anzahl === 0)) return null;
  /* Der Maßstab hat einen Boden. Ohne ihn füllte eine einzige abwesende Person
     von neun die ganze Höhe, weil sie zugleich die Spitze ist — und ein Bild,
     das „einer ist weg" wie „alle sind weg" zeichnet, lügt über genau die
     Größe, wegen der man es ansieht. */
  const spitze = Math.max(...tage.map((t) => t.anzahl), grenze ?? 0, 3);

  return (
    <VStack gap={2}>
      <span className="gitter-rahmen">
        <VStack gap={0} className="belegung-blatt">
          <figure
            className="belegung"
            aria-label={`Gleichzeitig abwesend je Tag: ${tage
              .filter((t) => t.anzahl > 0)
              .map((t) => `${fmtDate(t.datum)} ${t.anzahl}`)
              .join(', ')}`}
          >
            {grenze !== null && (
              <span
                aria-hidden
                className="belegung-grenze"
                style={{insetBlockEnd: `${(grenze / spitze) * 100}%`}}
              />
            )}
            {tage.map((t) => (
              <span
                key={t.datum}
                aria-hidden
                title={`${fmtDateLong(t.datum)}: ${t.anzahl} von ${gesamt} abwesend`}
                className={['belegung-saeule', grenze !== null && t.anzahl > grenze ? 'ueber' : '']
                  .filter(Boolean)
                  .join(' ')}
              >
                {/* Die Zahl über der Säule: die Höhe vergleicht, die Zahl
                    benennt. Ohne sie ließe sich ein Balken nur schätzen. */}
                {t.anzahl > 0 && (
                  <b>
                    <Text type="supporting" size="sm" color="inherit" hasTabularNumbers>
                      {t.anzahl}
                    </Text>
                  </b>
                )}
                {t.anzahl > 0 && <i style={{blockSize: `${(t.anzahl / spitze) * 100}%`}} />}
              </span>
            ))}
          </figure>
          {/* Die Tageszahlen unter der Kurve — ohne sie ließe sich ein Balken
              nicht auf einen Tag zurückführen, und genau danach fragt man. */}
          <span aria-hidden className="belegung-achse">
            {tage.map((t) => (
              <span key={t.datum}>
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {Number(t.datum.slice(8))}
                </Text>
              </span>
            ))}
          </span>
        </VStack>
      </span>
      <Text type="supporting" size="sm" color="secondary" as="p">
        Gleichzeitig abwesend, Tag für Tag – gezählt wird nur, was feststeht.
        {grenze !== null
          ? ` Die gestrichelte Linie ist die eingestellte Grenze von ${grenze}.`
          : ' Eine Belastungsgrenze ist nicht eingestellt (Einstellungen).'}
      </Text>
    </VStack>
  );
}

interface JahresRasterProps {
  zeilen: KalenderZeile[];
  jahr: string;
  heute: string | null;
}

/**
 * Das Jahr als Wochenraster: eine Zeile je Person, eine Spalte je Kalenderwoche.
 *
 * Das Jahr ist nicht „der Monat, herausgezoomt", und genau daran ist die alte
 * Jahresansicht gescheitert. Als 365-Tage-Bahn blieben 1,2 px je Tag: ein
 * zwölftägiger Urlaub war acht Pixel breit, und weil rund 104 Wochenendzellen
 * bei dieser Auflösung zu einem durchgehenden Karo verschmelzen, musste die
 * Ruhetags-Hinterlegung oberhalb von 62 Tagen sogar abgeschaltet werden — übrig
 * blieb eine Spur ganz ohne Struktur.
 *
 * Mit der Auflösung wechselt die Frage. Im Jahr fragt niemand „an welchem
 * Tag", sondern „in welchen Wochen" und „wer hat wie viel verbraucht". 52
 * Spalten sind dafür lesbar, 365 sind es nie.
 */
export function TeamJahresRaster({zeilen, jahr, heute}: JahresRasterProps) {
  const wochen = wochenraster(jahr);
  const heuteMontag = heute ? mondayOf(heute) : null;

  if (zeilen.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="teamkalender" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          Keine Mitarbeiter erfasst.
        </Text>
      </HStack>
    );
  }

  return (
    <span className="gitter-rahmen">
      <VStack gap={0} className="wochenraster">
        {zeilen.map((zeile) => {
          const proWoche = new Map<string, {tage: number; beantragt: boolean}>();
          for (const spanne of zeile.spannen) {
            for (const tag of spanne.zaehlendeTage) {
              const montag = mondayOf(tag);
              const eintrag = proWoche.get(montag) ?? {tage: 0, beantragt: false};
              eintrag.tage += 1;
              // Beantragt schlägt durch, sobald ein Tag der Woche es ist: eine
              // Woche, die zur Hälfte noch zur Entscheidung steht, steht nicht fest.
              eintrag.beantragt = eintrag.beantragt || spanne.beantragt;
              proWoche.set(montag, eintrag);
            }
          }
          const gesamtTage = [...proWoche.values()].reduce((s, w) => s + w.tage, 0);

          return (
            <HStack
              key={zeile.userId}
              gap={3}
              vAlign="center"
              paddingInline={2}
              paddingBlock={1}
              className="raster-zeile"
              style={
                zeile.selbst
                  ? {background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-inner)'}
                  : undefined
              }
            >
              <span style={{inlineSize: SPALTE_NAME, flexShrink: 0}}>
                <HStack gap={1.5} vAlign="center" wrap="nowrap">
                  <Text type="label" size="sm" weight={zeile.selbst ? 'semibold' : 'medium'} maxLines={1}>
                    {zeile.name}
                  </Text>
                  {zeile.selbst && (
                    <Text type="supporting" size="sm" color="secondary">
                      (Du)
                    </Text>
                  )}
                </HStack>
              </span>
              <StackItem size="fill">
                <figure
                  className="raster-spur"
                  aria-label={
                    gesamtTage === 0
                      ? `${zeile.name}: durchgehend anwesend`
                      : `${zeile.name}: ${fmtTage(gesamtTage)} abwesend im Jahr`
                  }
                >
                  {wochen.map((w) => {
                    const eintrag = proWoche.get(w.montag);
                    const stufe = rasterStufe(eintrag?.tage ?? 0);
                    return (
                      <span
                        key={w.montag}
                        aria-hidden
                        title={rasterTitel(w, eintrag?.tage ?? 0)}
                        className={[
                          'raster-zelle',
                          `stufe-${stufe}`,
                          eintrag?.beantragt ? 'beantragt' : '',
                          heuteMontag === w.montag ? 'jetzt' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      />
                    );
                  })}
                </figure>
              </StackItem>
              <span style={{inlineSize: 66, flexShrink: 0, textAlign: 'end'}}>
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {gesamtTage > 0 ? fmtTage(gesamtTage) : '–'}
                </Text>
              </span>
            </HStack>
          );
        })}

        {/* Die Monatsmarken einmal unter allen Spuren — dieselbe Aufteilung wie
            beim Gitter, wo die Wochentage einmal über allen Zeilen stehen. */}
        <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={1}>
          <span style={{inlineSize: SPALTE_NAME, flexShrink: 0}}>
            <Text type="supporting" size="sm" color="secondary">
              KW
            </Text>
          </span>
          <StackItem size="fill">
            <span aria-hidden className="raster-spur raster-achse">
              {wochen.map((w) => (
                <span key={w.montag} className="raster-marke">
                  {w.montag.slice(8) <= '07' ? (
                    <Text type="supporting" size="sm" color="secondary">
                      {fmtMonthShort(w.montag)}
                    </Text>
                  ) : null}
                </span>
              ))}
            </span>
          </StackItem>
          <span style={{inlineSize: 66, flexShrink: 0}} />
        </HStack>
      </VStack>
    </span>
  );
}

function rasterTitel(w: RasterWoche, tage: number): string {
  const zeitraum = fmtDateRange(w.montag, w.sonntag);
  return tage > 0 ? `KW ${w.kw} (${zeitraum}): ${fmtTage(tage)} abwesend` : `KW ${w.kw} (${zeitraum})`;
}

/**
 * Wer heute weg ist, mit dem Tag der Rückkehr — die Frage, wegen der man
 * morgens auf diese Seite geht. Steht in der Kontextspalte neben dem Gitter,
 * nicht darin: das Gitter beantwortet „wann", diese Liste „wer jetzt".
 */
export function HeuteAbwesend({
  namen,
}: {
  namen: Array<{name: string; art: AbwesenheitArt | null; zurueck: string | null; tage: number}>;
}) {
  if (namen.length === 0) {
    return (
      <Text type="supporting" color="secondary">
        Heute ist niemand abwesend.
      </Text>
    );
  }
  return (
    <VStack gap={2}>
      {namen.map((p) => (
        <HStack key={p.name} justify="between" gap={2} vAlign="center" wrap="nowrap">
          <HStack gap={1.5} vAlign="center" wrap="nowrap">
            <Sinnbild sinn={p.art ?? 'abwesenheit'} groesse="zeile" ton="sekundaer" />
            <Text type="supporting" maxLines={1}>
              {p.name}
            </Text>
          </HStack>
          <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
            {p.zurueck ? `zurück am ${fmtDate(p.zurueck)}` : fmtTage(p.tage)}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}

/**
 * Die Legende — und zwar für beide Kanäle getrennt, weil das der Punkt ist:
 * die Füllung sagt, ob der Tag etwas kostet, die Kante, ob er feststeht.
 */
export function KalenderLegende({mitArten, jahr}: {mitArten: boolean; jahr?: boolean}) {
  if (jahr) {
    return (
      <VStack gap={2}>
        <HStack gap={2} vAlign="center" wrap="wrap">
          {([0, 1, 2, 3, 4] as const).map((stufe) => (
            <span key={stufe} aria-hidden className={`raster-zelle stufe-${stufe} raster-probe`} />
          ))}
          <Text type="supporting" size="sm" color="secondary">
            kein Tag → ganze Woche
          </Text>
        </HStack>
        <HStack gap={2} vAlign="center">
          <span aria-hidden className="raster-zelle stufe-2 beantragt raster-probe" />
          <Text type="supporting" size="sm" color="secondary">
            Beantragt – noch nicht entschieden
          </Text>
        </HStack>
      </VStack>
    );
  }
  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center">
        <span aria-hidden className="gitter-marke legende-probe">
          <span aria-hidden className="gitter-punkt" />
        </span>
        <Text type="supporting" size="sm" color="secondary">
          Abwesend – steht fest
        </Text>
      </HStack>
      <HStack gap={2} vAlign="center">
        <span aria-hidden className="gitter-marke beantragt legende-probe">
          <span aria-hidden className="gitter-punkt" />
        </span>
        <Text type="supporting" size="sm" color="secondary">
          Beantragt – noch nicht entschieden
        </Text>
      </HStack>
      <HStack gap={2} vAlign="center">
        <span aria-hidden className="gitter-marke leer legende-probe">
          <span aria-hidden className="gitter-punkt" />
        </span>
        <Text type="supporting" size="sm" color="secondary">
          Wochenende oder Feiertag – kostet nichts
        </Text>
      </HStack>
      {mitArten && (
        <HStack gap={1} wrap="wrap">
          {(['urlaub', 'krank', 'freizeitausgleich', 'fortbildung'] as AbwesenheitArt[]).map((art) => (
            <Badge
              key={art}
              variant="neutral"
              label={ART_LABEL[art]}
              icon={<Sinnbild sinn={art} groesse="zeile" />}
            />
          ))}
        </HStack>
      )}
    </VStack>
  );
}

/** Die Wochentagsköpfe, für eine Legende außerhalb des Gitters. */
export const WOCHENTAGS_KOEPFE = WOCHENTAGE;
