'use client';

import {Button, HStack, IconButton, Tab, TabList, Text} from '@astryxdesign/core';
import Link from 'next/link';
import {createContext, useContext, type ComponentProps} from 'react';
import {LinkPuls} from './verweis';
import {addDays, addMonths, fmtDateLong, fmtMonth, fmtWeekRange, mondayOf, monthOf} from '@/lib/format';
import {
  BEREICHE,
  BEREICH_LABELS,
  MONAT_JAHR_BEREICHE,
  MONAT_JAHR_LABELS,
  type Bereich,
  type MonatJahrBereich,
} from '@/lib/bereiche';
import {WECHSEL_ARTEN} from './seiten-wechsel';
import {Sinnbild, type Sinn} from './sinnbilder';

type WechselArt = keyof typeof WECHSEL_ARTEN;

/**
 * Welche Bewegung ein Verweis auslöst, nach Ziel-Adresse geschlüsselt.
 *
 * Über einen Kontext, weil Astryx' `Tab` sein Anker-Element über `as` erzeugt
 * und keine eigenen Zusatz-Eigenschaften durchreicht: der Verweis kann seine
 * Bewegungsart nicht als Eigenschaft bekommen, wohl aber selbst nachschlagen.
 * Der Navigator ist die einzige Stelle, die diesen Kontext füllt.
 */
const Bewegungen = createContext<Record<string, WechselArt>>({});

/**
 * Der eine Verweis des Navigators — für die Tabs (über `as`) wie für das
 * Schrittwerk. Er hängt der Navigation ihre Bewegungsart an (`transitionTypes`,
 * das React über `addTransitionType` an `SeitenWechsel` weiterreicht) und sagt,
 * solange der Server antwortet, dass er arbeitet.
 */
function BereichsLink(props: ComponentProps<'a'>) {
  const bewegungen = useContext(Bewegungen);
  const art = typeof props.href === 'string' ? bewegungen[props.href] : undefined;
  return (
    <Link {...(props as ComponentProps<typeof Link>)} transitionTypes={art ? [art] : undefined}>
      <LinkPuls />
      {props.children}
    </Link>
  );
}

interface NavigatorProps {
  aktiv: string;
  /**
   * Die Bereichsnamen sind zugleich Schlüssel des Zeichenvokabulars
   * (`tag`, `woche`, `monat`, `konto`, `jahr`), deshalb braucht der Navigator
   * keine Übersetzungstabelle — er reicht den Wert selbst weiter.
   *
   * `art` benennt, wie sich die Seite dabei bewegt: ein Wechsel der
   * Vergrößerung ist ein Zoom, kein Schritt.
   */
  tabs: Array<{value: string; label: string; href: string; sinn: Sinn; art?: WechselArt}>;
  /** Null blendet den jeweiligen Schritt aus, ohne die Reihe umbrechen zu lassen. */
  zurueckHref: string | null;
  weiterHref: string | null;
  /** Der Zeitraum in Worten — die einzige Beschriftung der Reihe. */
  label: string | null;
  /** Der Sprung zurück in die Gegenwart; null, wenn er nichts täte. */
  jetzt: {href: string; label: string; art: WechselArt} | null;
  /** Ranges ohne eigene Bewegung (Konto) zeigen nur die Tabs und die Beschriftung. */
  hatSchritte?: boolean;
}

/**
 * Der Zoom zwischen zwei Zeiträumen: hin zu einem weiteren tritt man zurück,
 * hin zu einem engeren tritt man heran. Beide Bereichslisten stehen bereits in
 * Zoom-Reihenfolge (siehe lib/bereiche.ts), also genügt der Vergleich der
 * Plätze — und wer denselben Bereich noch einmal anklickt, bewegt nichts.
 */
function zoomArt(ordnung: readonly string[], von: string, nach: string): WechselArt {
  const a = ordnung.indexOf(von);
  const b = ordnung.indexOf(nach);
  if (a < 0 || b < 0 || a === b) return 'default';
  return b > a ? 'zoom-weit' : 'zoom-nah';
}

/**
 * Das Gerüst des einen Navigators: Tabs links, Schrittwerk rechts. Die beiden
 * Bereiche der App — Meine Zeit und Reisen & Spesen — füllen es unterschiedlich,
 * bewegen sich aber sichtbar gleich.
 */
function Navigator(props: NavigatorProps) {
  const hatSchritte = props.hatSchritte ?? true;
  // Eine Leiste ohne Zooms (Team, Monatsabschluss, Berichte) zeigt nur das
  // Schrittwerk; eine ohne Schritte (die Prüf-Warteschlangen) nur die Reiter.
  // Beides ist dieselbe Leiste, nicht ein drittes und viertes Gerät.
  const hatTabs = props.tabs.length > 0;

  /* Ein Verweis, eine Bewegung. Der Schritt läuft auf der Zeitachse — auf jeder
     Bahn dieser Anwendung von links nach rechts, also auch hier: der nächste
     Zeitraum kommt von rechts herein, der vorige weicht nach rechts. Der Zoom
     wechselt dagegen nur die Vergrößerung und schiebt darum nichts. */
  const bewegungen: Record<string, WechselArt> = {};
  // Reiter ohne eigene Bewegung (die Prüf-Warteschlangen wechseln keinen
  // Zeitraum) laufen unter `default` — sie schieben nichts.
  for (const t of props.tabs) bewegungen[t.href] = t.art ?? 'default';
  if (props.zurueckHref) bewegungen[props.zurueckHref] = 'schritt-zurueck';
  if (props.weiterHref) bewegungen[props.weiterHref] = 'schritt-vor';
  if (props.jetzt) bewegungen[props.jetzt.href] = props.jetzt.art;

  return (
    <Bewegungen value={bewegungen}>
      <HStack justify="between" vAlign="center" gap={4} wrap="wrap">
        {/* Der offene Bereich trägt sein Zeichen gefüllt — dieselbe Sprache, in
            der die Seitennavigation ihre Auswahl zeigt. */}
        {hatTabs ? (
          <TabList value={props.aktiv} onChange={() => {}}>
            {props.tabs.map((t) => (
              <Tab
                key={t.value}
                value={t.value}
                label={t.label}
                href={t.href}
                as={BereichsLink}
                icon={<Sinnbild sinn={t.sinn} groesse="zeile" form="umriss" />}
                selectedIcon={<Sinnbild sinn={t.sinn} groesse="zeile" />}
              />
            ))}
          </TabList>
        ) : (
          /* Ohne Reiter bleibt der Platz links leer, damit das Schrittwerk
             an derselben Stelle steht wie überall sonst. */
          <span />
        )}

        <HStack gap={2} vAlign="center">
          {hatSchritte &&
            (props.zurueckHref ? (
              <BereichsLink href={props.zurueckHref} aria-label="Vorheriger Zeitraum">
                <IconButton label="Vorheriger Zeitraum" tooltip="Zurück" size="sm" icon={<Sinnbild sinn="zurueck" />} />
              </BereichsLink>
            ) : (
              <IconButton label="Vorheriger Zeitraum" size="sm" icon={<Sinnbild sinn="zurueck" />} isDisabled />
            ))}

          {props.label !== null && (
            <Text type="label" weight="semibold" hasTabularNumbers>
              {props.label}
            </Text>
          )}

          {hatSchritte && (
            <>
              {props.weiterHref ? (
                <BereichsLink href={props.weiterHref} aria-label="Nächster Zeitraum">
                  <IconButton label="Nächster Zeitraum" tooltip="Weiter" size="sm" icon={<Sinnbild sinn="weiter" />} />
                </BereichsLink>
              ) : (
                <IconButton label="Nächster Zeitraum" size="sm" icon={<Sinnbild sinn="weiter" />} isDisabled />
              )}
              {/* Only offered when it does something — a permanent "Heute" that is
                  already true is noise on the one control row that must stay calm. */}
              {props.jetzt && (
                <BereichsLink href={props.jetzt.href} style={{textDecoration: 'none'}}>
                  <Button
                    label={props.jetzt.label}
                    variant="ghost"
                    size="sm"
                    icon={<Sinnbild sinn="jetzt" />}
                  />
                </BereichsLink>
              )}
            </>
          )}
        </HStack>
      </HStack>
    </Bewegungen>
  );
}

interface BereichsLeisteProps {
  ansicht: Bereich;
  /** The selected day — the anchor every range is derived from. */
  tag: string;
  today: string;
  /** "/" for the employee's own time, "/team/7" for a manager looking at one. */
  basePath?: string;
}

/**
 * One navigator for the whole surface: the four ranges and the stepper that
 * moves whichever range is open. Previously these were four components — a
 * TabList plus three near-identical pagers — which is why the day zoom had no
 * way to reach yesterday at all.
 */
export function BereichsLeiste({ansicht, tag, today, basePath = '/'}: BereichsLeisteProps) {
  const href = (target: Bereich, day: string): string => {
    const search = new URLSearchParams({ansicht: target, tag: day});
    return `${basePath}?${search.toString()}`;
  };

  // Each range steps by its own unit; the anchor day always travels with it so
  // switching range afterwards lands on the period you were looking at.
  const step = (delta: number): string | null => {
    if (ansicht === 'tag') return addDays(tag, delta);
    if (ansicht === 'woche') return addDays(mondayOf(tag), delta * 7);
    if (ansicht === 'monat') return `${addMonths(monthOf(tag), delta)}-01`;
    return null;
  };

  const prev = step(-1);
  const next = step(1);
  // Nothing after today can be recorded, so the forward step stops there.
  const nextAllowed =
    next != null &&
    (ansicht === 'tag' ? next <= today : ansicht === 'woche' ? next <= today : monthOf(next) <= monthOf(today));

  const label =
    ansicht === 'tag'
      ? tag === today
        ? 'Heute'
        : fmtDateLong(tag)
      : ansicht === 'woche'
        ? fmtWeekRange(mondayOf(tag))
        : ansicht === 'monat'
          ? fmtMonth(monthOf(tag))
          : `bis ${fmtDateLong(addDays(today, -1))}`;

  const isNow =
    ansicht === 'tag'
      ? tag === today
      : ansicht === 'woche'
        ? mondayOf(tag) === mondayOf(today)
        : monthOf(tag) === monthOf(today);

  return (
    <Navigator
      aktiv={ansicht}
      tabs={BEREICHE.map((a) => ({
        value: a,
        label: BEREICH_LABELS[a],
        href: href(a, tag),
        sinn: a,
        art: zoomArt(BEREICHE, ansicht, a),
      }))}
      zurueckHref={prev ? href(ansicht, prev) : null}
      weiterHref={nextAllowed && next ? href(ansicht, next) : null}
      label={label}
      // „Heute" springt immer nach vorn: nach hinten kann der Anker nicht
      // stehen, weil kein Zeitraum hinter heute geöffnet werden darf.
      jetzt={isNow ? null : {href: href(ansicht, today), label: 'Heute', art: 'schritt-vor'}}
      hatSchritte={ansicht !== 'konto'}
    />
  );
}

interface MonatJahrLeisteProps {
  /** Die Route, auf der die Leiste blättert — `/spesen` oder `/abwesenheit`. */
  route: string;
  ansicht: MonatJahrBereich;
  /** Der Anker beider Zeiträume, immer als YYYY-MM. */
  monat: string;
  today: string;
  /**
   * Ob über den laufenden Zeitraum hinaus geblättert werden darf. Für Spesen
   * nicht: eine Reise wird nach der Rückkehr abgerechnet, vorn steht nichts.
   * Für Abwesenheit schon — ein Urlaub wird beantragt, bevor er stattfindet,
   * und ein Navigator, der an heute endet, verstellte genau den Weg dorthin.
   */
  nachVorn?: boolean;
}

/**
 * Der Tagesschritt ohne Zooms — für Seiten, die genau einen Tag zeigen (Team).
 *
 * Bis zum Umbau hatte diese Bewegung eine eigene Komponente (`DaySwitcher`),
 * die Monatsbewegung eine zweite (`MonthSwitcher`) und die Prüf-Warteschlangen
 * eine dritte (`PruefFilter`). Vier Geräte für eine Bewegung, mit vier
 * verschiedenen Knopfformen und ohne den Puls, der auf jeder anderen Seite
 * sagt, dass der Server antwortet.
 */
export function TagLeiste({route, tag, today}: {route: string; tag: string; today: string}) {
  const href = (d: string) => `${route}?${new URLSearchParams({tag: d}).toString()}`;
  const next = addDays(tag, 1);
  return (
    <Navigator
      aktiv=""
      tabs={[]}
      zurueckHref={href(addDays(tag, -1))}
      // Nach vorn gibt es nichts zu sehen: was hinter heute liegt, ist nicht erfasst.
      weiterHref={next <= today ? href(next) : null}
      label={tag === today ? 'Heute' : fmtDateLong(tag)}
      jetzt={tag === today ? null : {href: href(today), label: 'Heute', art: 'schritt-vor'}}
    />
  );
}

/** Der Monatsschritt ohne Zooms — Monatsabschluss und Berichte. */
export function MonatLeiste({
  route,
  monat,
  today,
  params,
  jetztLabel = 'Dieser Monat',
}: {
  route: string;
  monat: string;
  today: string;
  /** Weitere Adressparameter, die der Schritt mitnehmen muss. */
  params?: Record<string, string>;
  jetztLabel?: string;
}) {
  const href = (m: string) => `${route}?${new URLSearchParams({...params, monat: m}).toString()}`;
  const heuteMonat = monthOf(today);
  const next = addMonths(monat, 1);
  return (
    <Navigator
      aktiv=""
      tabs={[]}
      zurueckHref={href(addMonths(monat, -1))}
      weiterHref={next <= heuteMonat ? href(next) : null}
      label={fmtMonth(monat)}
      jetzt={
        monat === heuteMonat
          ? null
          : {
              href: href(heuteMonat),
              label: jetztLabel,
              art: monat < heuteMonat ? 'schritt-vor' : 'schritt-zurueck',
            }
      }
    />
  );
}

/**
 * Die Reiter ohne Schrittwerk — die beiden Prüf-Warteschlangen.
 *
 * Sie blättern nicht durch die Zeit, sondern durch Zustände; die Leiste ist
 * aber dieselbe, mit demselben gefüllten Zeichen für den offenen Reiter und
 * demselben Puls am angeklickten Verweis.
 */
export function StatusLeiste({
  aktiv,
  tabs,
}: {
  aktiv: string;
  tabs: Array<{value: string; label: string; href: string; sinn: Sinn}>;
}) {
  return <Navigator aktiv={aktiv} tabs={tabs} zurueckHref={null} weiterHref={null} label={null} jetzt={null} hatSchritte={false} />;
}

/** Derselbe Navigator für Reisen & Spesen wie für Abwesenheit: Monat │ Jahr statt der vier Zooms. */
export function MonatJahrLeiste({route, ansicht, monat, today, nachVorn}: MonatJahrLeisteProps) {
  const href = (target: MonatJahrBereich, m: string): string =>
    `${route}?${new URLSearchParams({ansicht: target, monat: m}).toString()}`;

  const heuteMonat = monthOf(today);
  const step = (delta: number): string =>
    ansicht === 'monat' ? addMonths(monat, delta) : addMonths(monat, delta * 12);

  const prev = step(-1);
  const next = step(1);
  const weiterErlaubt =
    nachVorn || (ansicht === 'monat' ? next <= heuteMonat : next.slice(0, 4) <= heuteMonat.slice(0, 4));
  const istJetzt =
    ansicht === 'monat' ? monat === heuteMonat : monat.slice(0, 4) === heuteMonat.slice(0, 4);

  return (
    <Navigator
      aktiv={ansicht}
      tabs={MONAT_JAHR_BEREICHE.map((a) => ({
        value: a,
        label: MONAT_JAHR_LABELS[a],
        href: href(a, monat),
        sinn: a,
        art: zoomArt(MONAT_JAHR_BEREICHE, ansicht, a),
      }))}
      zurueckHref={href(ansicht, prev)}
      weiterHref={weiterErlaubt ? href(ansicht, next) : null}
      label={ansicht === 'monat' ? fmtMonth(monat) : monat.slice(0, 4)}
      jetzt={
        istJetzt
          ? null
          : {
              href: href(ansicht, heuteMonat),
              label: ansicht === 'monat' ? 'Dieser Monat' : 'Dieses Jahr',
              art: monat < heuteMonat ? 'schritt-vor' : 'schritt-zurueck',
            }
      }
    />
  );
}
