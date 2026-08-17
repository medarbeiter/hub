'use client';

import {Text} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {WOCHENTAGE, type Kalendergitter} from '@/lib/kalendergitter';
import {fmtDateLong, fmtDateRange} from '@/lib/format';

/** Die volle Form des Wochentags — für alles, was nur gehört und nicht gesehen wird. */
const WOCHENTAG_LANG: Record<string, string> = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

export interface GitterZelle {
  /**
   * Die Zahl oben links in der Ecke — „wie viele gleichzeitig", „wie viele
   * Zeilen". Null und 0 zeigen nichts: eine Null ist keine Nachricht.
   */
  zaehler?: number | null;
  /** Was in der Zelle steht. */
  inhalt?: ReactNode;
  /** Was eine Vorlesehilfe von diesem Tag hört. Ohne Angabe nur das Datum. */
  beschriftung?: string;
  /** Hebt den Tag hervor — ein Reisetag, ein gefilterter Protokolltag. */
  betont?: boolean;
}

/** Die Ziehauswahl, wie sie `useGitterWahl` liefert. */
export interface GitterWahl {
  istGewaehlt: (datum: string) => boolean;
  beginnen: (datum: string) => void;
  einzeln: (datum: string) => void;
  spanne: {von: string; bis: string} | null;
}

interface MonatsgitterProps {
  gitter: Kalendergitter;
  /** Tage ohne Soll: Wochenenden und Feiertage. Sie tragen den Papiergrund. */
  ruhetage: ReadonlySet<string>;
  /** Heute, wenn es in den Ausschnitt fällt — sonst null. */
  heute: string | null;
  /** Der Inhalt je Tag. */
  zelle: (datum: string) => GitterZelle;
  /** Macht jede Zelle zu einem Knopf. */
  onTag?: (datum: string) => void;
  /** Zusätzlich zum Klick: über mehrere Tage ziehen. */
  wahl?: GitterWahl;
  /** Der Tag, der gerade offen ist — bekommt die Goldwäsche. */
  aktiverTag?: string | null;
  /**
   * Mindesthöhe einer Zelle. Personenmarken brauchen mehr Raum als eine
   * Dichtesäule, deshalb bestellt jede Oberfläche ihr eigenes Maß.
   */
  zellhoehe?: number;
  /**
   * Tage, die nicht gewählt werden dürfen — vor dem `min`, nach dem `max`.
   * Sie werden gezeichnet (sonst hätte das Gitter Löcher), aber der Griff ist
   * tot und sagt das auch einer Vorlesehilfe.
   */
  gesperrt?: (datum: string) => boolean;
  /**
   * Das Gitter als Datumswähler: eine Zahl je Zelle, mittig, ohne Raum für
   * Marken. Dieselbe Zeichnung, kleinere Auflösung — kein zweites Gitter.
   */
  kompakt?: boolean;
}

/**
 * Das eine Gitter, in das jede Oberfläche der Datumsachse gezeichnet wird.
 *
 * Es steht zu `lib/kalendergitter.ts` in genau der Beziehung, in der
 * `Tagesbahn` zu ihren drei Größen steht: **eine** Zeichnung, austauschbare
 * Füllung. Vier Bänder zeichneten vorher dasselbe auf einer durchlaufenden
 * Achse — der Teamkalender, der Abwesenheitsstapel, der Reisenstapel und das
 * Protokollband — und keines davon konnte sagen, welcher Wochentag ein Tag ist.
 *
 * Ein echtes `<table>` und keine Rasterattrappe: ein Monatskalender *ist*
 * tabellarisch, und damit bekommt eine Vorlesehilfe Spalten- und
 * Zeilenüberschriften geschenkt, statt eine einzige lange `aria-label`-Kette
 * vorgelesen zu bekommen.
 *
 * Zwei Kanäle wie im alten Band, unverändert übernommen: die **Füllung** sagt,
 * ob ein Tag etwas kostet (ein Wochenende mitten im Urlaub bleibt leer), die
 * **Kante** sagt, ob er feststeht. Beide wohnen jetzt in der Zellfüllung, die
 * jede Oberfläche selbst mitbringt.
 */
export function Monatsgitter(props: MonatsgitterProps) {
  const {gitter, ruhetage, heute, zelle, onTag, wahl, aktiverTag, gesperrt, kompakt} = props;
  const hoehe = props.zellhoehe ?? (kompakt ? 34 : 62);
  const interaktiv = Boolean(onTag || wahl);

  return (
    <span className={['gitter-rahmen', kompakt ? 'kompakt' : ''].filter(Boolean).join(' ')}>
      <table className="monatsgitter" style={{['--gitter-zellhoehe' as string]: `${hoehe}px`}}>
        <thead>
          <tr>
            {/* Die Kalenderwoche ist die Zeilenüberschrift; ihre Spalte trägt
                selbst keine Beschriftung, weil „KW" über den Zahlen steht. */}
            <th scope="col" className="gitter-kw-kopf">
              <Text type="supporting" size="sm" color="secondary">
                KW
              </Text>
            </th>
            {WOCHENTAGE.map((tag) => (
              <th key={tag} scope="col" className="gitter-tagkopf">
                <Text type="label" size="sm" color="secondary">
                  <abbr title={WOCHENTAG_LANG[tag]} style={{textDecoration: 'none'}}>
                    {tag}
                  </abbr>
                </Text>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {gitter.wochen.map((woche) => (
            <tr key={woche.montag}>
              <th scope="row" className="gitter-kw">
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  {woche.kw}
                </Text>
              </th>
              {woche.tage.map((tag) => {
                const inhalt = zelle(tag.datum);
                const istRuhe = ruhetage.has(tag.datum);
                const istGesperrt = gesperrt?.(tag.datum) ?? false;
                const gewaehlt = wahl?.istGewaehlt(tag.datum) ?? false;
                const klassen = [
                  'gitter-zelle',
                  tag.imMonat ? '' : 'fremd',
                  istRuhe ? 'ruhe' : '',
                  heute === tag.datum ? 'heute' : '',
                  aktiverTag === tag.datum ? 'offen' : '',
                  gewaehlt ? 'gewaehlt' : '',
                  inhalt.betont ? 'betont' : '',
                  istGesperrt ? 'gesperrt' : '',
                ]
                  .filter(Boolean)
                  .join(' ');

                const kern = (
                  <>
                    {/* Der Zähler steht in der Ecke gegenüber der Tageszahl,
                        damit die beiden Zahlen einander nie erklären müssen. */}
                    {inhalt.zaehler ? (
                      <span className="gitter-zaehler">
                        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                          {inhalt.zaehler}
                        </Text>
                      </span>
                    ) : null}
                    <span className="gitter-zahl">
                      <Text
                        type="supporting"
                        size="sm"
                        color={heute === tag.datum ? 'accent' : 'secondary'}
                        weight={heute === tag.datum ? 'semibold' : 'normal'}
                        hasTabularNumbers
                      >
                        {tag.zahl}
                      </Text>
                    </span>
                    {inhalt.inhalt ? <span className="gitter-inhalt">{inhalt.inhalt}</span> : null}
                  </>
                );

                const beschriftung = inhalt.beschriftung ?? fmtDateLong(tag.datum);

                return (
                  <td key={tag.datum} className={klassen}>
                    {interaktiv ? (
                      <button
                        type="button"
                        data-gittertag={istGesperrt ? undefined : tag.datum}
                        className="gitter-griff"
                        aria-label={beschriftung}
                        aria-pressed={aktiverTag === tag.datum ? true : undefined}
                        disabled={istGesperrt}
                        onPointerDown={(e) => {
                          if (e.button !== 0 || !wahl) return;
                          wahl.beginnen(tag.datum);
                        }}
                        onClick={() => {
                          // Ein Zug endet über `pointerup` und hat seinen
                          // Zeitraum dann schon selbst geöffnet; nur der reine
                          // Klick landet hier.
                          if (wahl && !gewaehlt) return wahl.einzeln(tag.datum);
                          if (!wahl) onTag?.(tag.datum);
                        }}
                      >
                        {kern}
                      </button>
                    ) : (
                      <span className="gitter-feld" title={beschriftung}>
                        {kern}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </span>
  );
}

/**
 * Tage im Gitter auswählen, um eine Abwesenheit daraus zu machen.
 *
 * Diese Geste wohnte bis zum Umbau auf einer eigenen Datumsrinne neben den
 * Bahnen (`tage-waehler.tsx`), und zwar aus einem zwingenden Grund: auf der
 * Bahn selbst wohnt bereits das Ziehen über freie Strecke, das einen Eintrag
 * anlegt. Zwei Ziehgesten auf einer Fläche, unterschieden allein durch die
 * Richtung, wären bei einem leicht schrägen Zug ein Münzwurf zwischen „vier
 * Stunden erfasst" und „eine Woche Urlaub beantragt" gewesen.
 *
 * Im Gitter gibt es diese Kollision nicht: über Kalendertage zu ziehen kann
 * nichts anderes heißen. Damit fällt die Rinne weg, und Anzeige und
 * Eingabefläche sind endlich dasselbe Objekt.
 *
 * Ein Klick allein wählt einen Tag — die Geste darf nichts können, was ohne sie
 * unmöglich wäre, sonst verlöre ein Tastatur- oder Touchgerät eine Fähigkeit.
 */
export function useGitterWahl(basePath = '/abwesenheit') {
  const router = useRouter();
  const [anker, setAnker] = useState<string | null>(null);
  const [bis, setBis] = useState<string | null>(null);
  const zieht = useRef(false);

  const spanne =
    anker && bis ? {von: anker < bis ? anker : bis, bis: anker < bis ? bis : anker} : null;

  const oeffnen = useCallback(
    (von: string, bisISO: string) => {
      router.push(`${basePath}?${new URLSearchParams({von, bis: bisISO}).toString()}`);
    },
    [router, basePath],
  );

  useEffect(() => {
    if (!zieht.current) return;

    const tagUnter = (x: number, y: number): string | null => {
      const el = document.elementFromPoint(x, y);
      const griff = el?.closest<HTMLElement>('[data-gittertag]');
      return griff?.dataset.gittertag ?? null;
    };

    const bewegen = (e: PointerEvent) => {
      const tag = tagUnter(e.clientX, e.clientY);
      if (tag) setBis(tag);
    };
    const loslassen = () => {
      zieht.current = false;
      if (anker) oeffnen(spanne?.von ?? anker, spanne?.bis ?? anker);
      setAnker(null);
      setBis(null);
    };

    window.addEventListener('pointermove', bewegen);
    window.addEventListener('pointerup', loslassen, {once: true});
    window.addEventListener('pointercancel', loslassen, {once: true});
    return () => {
      window.removeEventListener('pointermove', bewegen);
      window.removeEventListener('pointerup', loslassen);
      window.removeEventListener('pointercancel', loslassen);
    };
  }, [anker, bis, spanne?.von, spanne?.bis, oeffnen]);

  return {
    spanne,
    istGewaehlt: (datum: string) => spanne !== null && datum >= spanne.von && datum <= spanne.bis,
    beginnen: (datum: string) => {
      zieht.current = true;
      setAnker(datum);
      setBis(datum);
    },
    einzeln: (datum: string) => oeffnen(datum, datum),
  };
}

/** Was gerade gewählt ist, als Zeile über dem Gitter — sonst zieht man blind. */
export function WahlAnzeige({spanne}: {spanne: {von: string; bis: string} | null}) {
  if (!spanne) return null;
  return (
    <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
      {fmtDateRange(spanne.von, spanne.bis)} – loslassen, um eine Abwesenheit zu erfassen
    </Text>
  );
}

/**
 * Eine Marke in einer Gitterzelle — eine Person, eine Reise, eine Abwesenheit.
 *
 * Die zwei Kanäle des alten Bandes, unverändert: **Füllung** heißt „dieser Tag
 * kostet etwas", **Kante** heißt „das steht fest" (durchgezogen) gegen
 * „beantragt" (gestrichelt).
 *
 * Wovor die Beschriftung steht, ist die dritte Auskunft — und sie ist bewusst
 * kein Farbcode. Wo die Art gezeigt werden darf, steht ihr Sinnbild; wo nicht,
 * ein neutraler Stein. Der Unterschied ist damit sichtbar, statt verschwiegen:
 * eine Marke ohne Zeichen sagt „jemand ist weg", nicht „das war nichts".
 */
export function GitterMarke({
  label,
  zeichen,
  beantragt,
  leer,
  titel,
}: {
  label: string;
  /** Das Sinnbild der Art, wo sie gezeigt werden darf. Ohne Angabe: ein Stein. */
  zeichen?: ReactNode;
  /** Gestrichelte Kante: beantragt, noch nicht entschieden. */
  beantragt?: boolean;
  /** Ohne Füllung: dieser Tag kostet nichts. */
  leer?: boolean;
  titel?: string;
}) {
  return (
    <span
      className={['gitter-marke', beantragt ? 'beantragt' : '', leer ? 'leer' : ''].filter(Boolean).join(' ')}
      title={titel ?? label}
    >
      {zeichen ? (
        <span aria-hidden className="gitter-zeichen">
          {zeichen}
        </span>
      ) : (
        <span aria-hidden className="gitter-punkt" />
      )}
      <span className="gitter-marke-text">{label}</span>
    </span>
  );
}

/** „+3 weitere" — die Auskunft, dass die Zelle gekürzt hat. Nie verschweigen. */
export function GitterMehr({anzahl, titel}: {anzahl: number; titel?: string}) {
  return (
    <span className="gitter-mehr" title={titel}>
      <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
        +{anzahl} weitere
      </Text>
    </span>
  );
}
