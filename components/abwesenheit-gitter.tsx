'use client';

import {HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {ART_LABEL, STATUS_LABEL, fmtTage} from '@/lib/abwesenheit-arten';
import {fmtDateLong, fmtDateRange, mondayOf} from '@/lib/format';
import {kalendergitter, rasterStufe, wochenraster} from '@/lib/kalendergitter';
import type {AbwesenheitAnsicht} from './abwesenheit-stapel';
import {GitterMarke, Monatsgitter, type GitterWahl, type GitterZelle} from './monatsgitter';
import {Sinnbild} from './sinnbilder';

/**
 * Die eigenen Abwesenheiten im Monatsgitter.
 *
 * Vorher zeichnete jede Spanne eine eigene Bahn über den Monat. Bei einem
 * Eintrag im Monat — dem Normalfall — war das eine 16 px hohe Zeile in einer
 * ansonsten leeren Bühne, und aus der Bahn ließ sich nicht ablesen, welcher
 * Wochentag ein Tag ist. Genau das ist aber die Frage vor einem Urlaubsantrag.
 *
 * Der eigentliche Gewinn liegt aber in der Geste: die Tagesauswahl brauchte
 * bisher eine eigene Datumsrinne neben den Bahnen, weil auf der Bahn selbst
 * schon das Ziehen für einen Zeiteintrag wohnt. Hier gibt es diese Kollision
 * nicht — über Kalendertage zu ziehen kann nichts anderes heißen —, und damit
 * sind Anzeige und Eingabefläche endlich dasselbe Objekt.
 */
export function AbwesenheitsGitter({
  abwesenheiten,
  monat,
  ruhetage,
  heute,
  wahl,
}: {
  abwesenheiten: AbwesenheitAnsicht[];
  monat: string;
  ruhetage: string[];
  heute: string;
  wahl: GitterWahl;
}) {
  const gitter = kalendergitter(monat);
  const ruhe = new Set(ruhetage);

  // Ein Tag kann mehrere Spannen tragen: eine Krankmeldung über einem
  // genehmigten Urlaub ist nach § 9 BUrlG ausdrücklich erlaubt.
  const proTag = new Map<string, AbwesenheitAnsicht[]>();
  for (const a of abwesenheiten) {
    for (const tag of a.tage) {
      proTag.set(tag, [...(proTag.get(tag) ?? []), a]);
    }
  }

  const zelle = (datum: string): GitterZelle => {
    const eintraege = proTag.get(datum) ?? [];
    if (eintraege.length === 0) return {beschriftung: `${fmtDateLong(datum)} – frei`};
    return {
      beschriftung: `${fmtDateLong(datum)}: ${eintraege
        .map((a) => `${ART_LABEL[a.art]} (${STATUS_LABEL[a.status]})`)
        .join('; ')}`,
      inhalt: (
        <>
          {eintraege.map((a) => (
            <GitterMarke
              key={a.id}
              label={ART_LABEL[a.art]}
              titel={`${ART_LABEL[a.art]} · ${STATUS_LABEL[a.status]} · ${fmtDateRange(a.von, a.bis)}`}
              zeichen={<Sinnbild sinn={a.art} groesse="zeile" ton="sekundaer" />}
              beantragt={a.status === 'eingereicht' || a.status === 'entwurf'}
              // Ohne Füllung, wenn der Tag nichts kostet — an einem Wochenende
              // im Urlaub wäre ohnehin nicht gearbeitet worden.
              leer={!a.arbeitstage.includes(datum)}
            />
          ))}
        </>
      ),
    };
  };

  return (
    <Monatsgitter
      gitter={gitter}
      ruhetage={ruhe}
      heute={heute >= gitter.alleTage[0]! && heute <= gitter.alleTage.at(-1)! ? heute : null}
      zelle={zelle}
      wahl={wahl}
      zellhoehe={70}
    />
  );
}

/**
 * Das eigene Jahr als Wochenraster — dieselbe Auflösung wie im Teamkalender,
 * nur mit einer Zeile je Art statt einer je Person. Im Jahr ist die Frage
 * nicht „an welchem Tag", sondern „in welchen Wochen und wie viel davon".
 */
export function AbwesenheitsJahr({
  abwesenheiten,
  jahr,
  heute,
}: {
  abwesenheiten: AbwesenheitAnsicht[];
  jahr: string;
  heute: string;
}) {
  const wochen = wochenraster(jahr);
  const heuteMontag = mondayOf(heute);

  const arten = ['urlaub', 'krank', 'freizeitausgleich', 'fortbildung'] as const;
  const zeilen = arten
    .map((art) => {
      const eigene = abwesenheiten.filter((a) => a.art === art);
      const proWoche = new Map<string, {tage: number; beantragt: boolean}>();
      for (const a of eigene) {
        for (const tag of a.arbeitstage) {
          const montag = mondayOf(tag);
          const e = proWoche.get(montag) ?? {tage: 0, beantragt: false};
          e.tage += 1;
          e.beantragt = e.beantragt || a.status === 'eingereicht' || a.status === 'entwurf';
          proWoche.set(montag, e);
        }
      }
      const gesamt = [...proWoche.values()].reduce((s, w) => s + w.tage, 0);
      return {art, proWoche, gesamt};
    })
    // Eine Art ohne einen einzigen Tag ist keine Nachricht — dieselbe Regel wie
    // überall sonst in dieser Anwendung, wo eine Null nicht dasteht.
    .filter((z) => z.gesamt > 0);

  if (zeilen.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="abwesenheit" groesse="leer" ton="sekundaer" />
        <VStack gap={2}>
          <Text type="body" color="secondary">
            In diesem Jahr ist keine Abwesenheit erfasst.
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
    <span className="gitter-rahmen">
      <VStack gap={0} className="wochenraster">
        {zeilen.map(({art, proWoche, gesamt}) => (
          <HStack key={art} gap={3} vAlign="center" paddingInline={2} paddingBlock={1} className="raster-zeile">
            <span style={{inlineSize: 148, flexShrink: 0}}>
              <HStack gap={1.5} vAlign="center" wrap="nowrap">
                <Sinnbild sinn={art} groesse="zeile" ton="sekundaer" />
                <Text type="label" size="sm" weight="medium" maxLines={1}>
                  {ART_LABEL[art]}
                </Text>
              </HStack>
            </span>
            <StackItem size="fill">
              <figure className="raster-spur" aria-label={`${ART_LABEL[art]}: ${fmtTage(gesamt)} im Jahr`}>
                {wochen.map((w) => {
                  const e = proWoche.get(w.montag);
                  return (
                    <span
                      key={w.montag}
                      aria-hidden
                      title={
                        e
                          ? `KW ${w.kw} (${fmtDateRange(w.montag, w.sonntag)}): ${fmtTage(e.tage)}`
                          : `KW ${w.kw} (${fmtDateRange(w.montag, w.sonntag)})`
                      }
                      className={[
                        'raster-zelle',
                        `stufe-${rasterStufe(e?.tage ?? 0)}`,
                        e?.beantragt ? 'beantragt' : '',
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
                {fmtTage(gesamt)}
              </Text>
            </span>
          </HStack>
        ))}

        <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={1}>
          <span style={{inlineSize: 148, flexShrink: 0}}>
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
                      {new Date(`${w.montag}T12:00:00`).toLocaleDateString('de-DE', {month: 'short'})}
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
