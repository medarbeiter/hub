'use client';

import {Badge, Button, HStack, StatusDot, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {useEffect, useRef, type ReactNode} from 'react';
import {Sinnbild, type Sinn} from './sinnbilder';

/**
 * Was ein Navigationseintrag zeigt, wenn man ihn aufklappt.
 *
 * Kein Überhang, keine schwebende Karte: der Eintrag wächst an Ort und Stelle,
 * und die Einträge darunter rücken nach. Die Bewegung dazu kommt aus Astryx
 * selbst — `SideNavItem` mit `collapsible` blendet seine Kinder über
 * `grid-template-rows: 0fr → 1fr` ein, mit `--duration-medium` und
 * `--ease-standard`. Genau die Technik, die `.bahn-ausklapp` in globals.css
 * beschreibt. Hier wird deshalb keine eigene Animation geschrieben; eine
 * zweite, leicht andere wäre nur eine zweite, leicht andere.
 *
 * Drei Regeln für den Inhalt:
 *
 * 1. **Zuerst der Stand, dann die Handlung.** Der Gewinn beim Aufklappen ist
 *    die Auskunft: „3 eingestempelt", „seit 08:32". Man erfährt etwas, ohne die
 *    Seite zu wechseln.
 * 2. **Höchstens zwei Handlungen, und nur die, die es lohnen.** Eine Handlung
 *    gehört hierher, wenn sie oft gebraucht wird *und* von hier aus schneller
 *    geht als von der Seite. Alles andere ist Navigation, und die kann der
 *    Eintrag selbst. Ein Eintrag ganz ohne Handlung (Team) ist deshalb kein
 *    Mangel, sondern der Normalfall für einen Bereich, über den man nur
 *    Bescheid wissen will.
 * 3. **Nichts lebt nur hier.** Stempeln bleibt in der Stempelleiste, „Reise
 *    erfassen" auf der Spesenseite, die CSV im Kopf der Berichte.
 */

/**
 * Der Faden, an dem die Kinder eines Eintrags hängen — wie ein Diskussionsbaum:
 * eine senkrechte Linie unter dem Zeichen des Eintrags, von der aus ein kurzer
 * Steg zu jedem Kind abgeht.
 *
 * Die Maße sind nicht gegriffen, sondern aus der Leiste abgelesen: das Zeichen
 * eines Eintrags hat seine Mitte bei 24 px, seine Beschriftung beginnt bei
 * 40 px. Astryx rückt die Kinder auf 32 px ein; die −8 px holen den Faden auf
 * die Zeichenmitte zurück, und 2 px Linie plus 14 px Abstand setzen den Inhalt
 * exakt unter die Beschriftung. Der Faden läuft damit genau dort herunter, wo
 * das Zeichen steht, und die Kinder stehen genau dort, wo das Wort steht.
 */
export function NavZweig({offen, children}: {offen: boolean; children: ReactNode}) {
  /* `offen` steuert allein die Bewegung: Astryx hält die Kinder immer im Baum
     (unter `overflow: hidden`), also kann kein Auftritt sie einblenden — sie
     rücken stattdessen gestaffelt aus der Zeichenspalte heraus, sodass das Auge
     dem Faden folgt statt einer Kante. Siehe `.nav-zweig` in globals.css. */
  return (
    <span className="nav-zweig" data-offen={offen ? 'true' : 'false'}>
      {children}
    </span>
  );
}

export interface NavAktion {
  sinn: Sinn;
  label: string;
  /** Entweder ein Ziel … */
  href?: string;
  /** … oder eine Handlung. Genau eines von beidem. */
  onClick?: () => void;
  /** Lädt eine Datei herunter, statt zu navigieren. */
  download?: boolean;
  isDisabled?: boolean;
}

/**
 * Der Stand: ein Punkt, ein Satz, ein leiser Nachsatz. Dieselbe Sprache wie
 * die Stempelleiste, damit derselbe Zustand nicht an zwei Orten zwei
 * verschiedene Namen bekommt.
 */
export function NavStand({
  ton,
  text,
  pulsiert,
  zusatz,
}: {
  ton: 'accent' | 'warning' | 'neutral';
  text: string;
  pulsiert?: boolean;
  zusatz?: string;
}) {
  return (
    <VStack className="nav-zweig-stand" gap={0.5} paddingBlock={1}>
      <HStack gap={2} vAlign="center" wrap="nowrap">
        <StatusDot variant={ton} label={text} isPulsing={pulsiert} />
        <Text type="label" size="sm" weight="medium">
          {text}
        </Text>
      </HStack>
      {zusatz && (
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {zusatz}
        </Text>
      )}
    </VStack>
  );
}

/**
 * Die Handlungen unter dem Stand. Die erste ist die goldene — die, die der
 * Zustand gerade nahelegt.
 */
export function NavAktionen({aktionen}: {aktionen: NavAktion[]}) {
  if (aktionen.length === 0) return null;
  // Ein Bruchstück statt eines Stapels: so hängt jede Schaltfläche mit einem
  // eigenen Steg am Faden. In einem gemeinsamen Behälter zeigte der Steg
  // zwischen die beiden Schaltflächen statt auf sie.
  return (
    <>
      {aktionen.map((a, i) => (
        <NavKnopf key={a.label} aktion={a} betont={i === 0} />
      ))}
    </>
  );
}

function NavKnopf({aktion, betont}: {aktion: NavAktion; betont: boolean}) {
  const knopf = (
    <Button
      label={aktion.label}
      variant={betont ? 'primary' : 'secondary'}
      size="sm"
      width="100%"
      isDisabled={aktion.isDisabled}
      icon={<Sinnbild sinn={aktion.sinn} groesse="zeile" />}
      onClick={aktion.href ? undefined : aktion.onClick}
      style={{
        justifyContent: 'center',
        /* Beide Schaltflächen ziehen ihre eigene Kante: auf dem Papier der
           Leiste schafft weder das Markengold noch Astryx' getönte
           `secondary`-Füllung allein die 3:1, die ein nicht-textliches
           Bedienelement tragen muss. Wie bei .arbeit-flaeche trägt der
           Haarstrich die Abgrenzung, nicht die Füllung — Bronze am Gold, Stein
           am Umriss, weil Stein hier keine Arbeit bezeichnen darf. Beide
           Paarungen stehen in tests/kontrast.test.ts. */
        boxShadow: betont
          ? 'inset 0 0 0 1px var(--color-icon-accent)'
          : 'inset 0 0 0 1px var(--color-icon-secondary)',
      }}
    />
  );

  if (!aktion.href) return knopf;

  // Ein Download braucht ein echtes <a>; Next-Link würde das Attribut schlucken.
  if (aktion.download) {
    return (
      <a href={aktion.href} download style={{textDecoration: 'none', display: 'block'}}>
        {knopf}
      </a>
    );
  }
  return (
    <Link href={aktion.href} style={{textDecoration: 'none', display: 'block'}}>
      {knopf}
    </Link>
  );
}

/**
 * Aufklappen durch Verweilen.
 *
 * Nach einer halben Sekunde über dem Eintrag klappt er von selbst auf. Die
 * halbe Sekunde ist der Punkt: beim bloßen Überqueren der Leiste passiert
 * nichts, erst das Verweilen gilt als Absicht.
 *
 * Zwei Feinheiten, ohne die es ärgerlich wäre:
 *
 *  – Der Zeiger-Bereich umfasst den Eintrag *samt* seiner Kinder. Sonst würde
 *    der Weg hinunter zu den Schaltflächen den Eintrag verlassen und ihn
 *    wieder zuklappen, bevor man ankommt.
 *  – Wer selbst auf das Winkelzeichen geklickt hat, hat sich entschieden: ein
 *    so geöffneter Eintrag bleibt offen, bis er wieder geklickt wird. Nur was
 *    das Verweilen geöffnet hat, schließt das Weggehen auch wieder.
 *
 * Auf Geräten ohne Zeiger bleibt alles beim Klick — `(hover: hover)` schließt
 * das Verweilen dort aus, damit ein Fingertipp nicht als Verweilen zählt.
 */
/**
 * Die Hülle eines Eintrags — und der Ort, an dem ein Ruf überlebt.
 *
 * Eingeklappt lässt Astryx das `endContent` weg: in einer Zeichenspalte ist
 * für eine Marke kein Platz. Damit verschwände aber genau die Auskunft, wegen
 * der die Marke existiert — dass hier etwas auf jemanden wartet. Statt der
 * Zahl steht dort dann ein Punkt an der Ecke des Zeichens: *dass* etwas offen
 * ist, bleibt sichtbar, *wie viel* sagt der Kurzhinweis und die ausgeklappte
 * Leiste. Der Punkt wird in globals.css gezeichnet und erscheint nur in der
 * Schiene.
 */
export function NavEintrag({
  ruft,
  onPointerEnter,
  onPointerLeave,
  children,
}: {
  /** Steht an diesem Eintrag eine Zahl, die eine Handlung verlangt? */
  ruft?: boolean;
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  children: ReactNode;
}) {
  return (
    <span
      className="nav-eintrag"
      data-ruft={ruft ? 'true' : 'false'}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </span>
  );
}

export function NavVerweilen({
  istOffen,
  oeffnen,
  schliessen,
  aus,
  ruft,
  children,
}: {
  istOffen: boolean;
  /** Wird nach dem Verweilen gerufen. */
  oeffnen: () => void;
  /** Wird beim Weggehen gerufen — nur, wenn das Verweilen geöffnet hatte. */
  schliessen: () => void;
  /**
   * Stillgelegt — in der eingeklappten Schiene, wo Astryx den Eintrag als
   * Überhang öffnet und ein zweites Verweilen nur mit ihm ränge.
   */
  aus?: boolean;
  /** Siehe `NavEintrag`. */
  ruft?: boolean;
  children: ReactNode;
}) {
  const auf = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zu = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zeigergeraet = useRef(false);

  useEffect(() => {
    zeigergeraet.current = window.matchMedia('(hover: hover)').matches;
    return () => {
      if (auf.current) clearTimeout(auf.current);
      if (zu.current) clearTimeout(zu.current);
    };
  }, []);

  const betreten = () => {
    if (aus || !zeigergeraet.current) return;
    if (zu.current) clearTimeout(zu.current);
    if (istOffen) return;
    auf.current = setTimeout(oeffnen, 500);
  };

  const verlassen = () => {
    if (aus || !zeigergeraet.current) return;
    if (auf.current) clearTimeout(auf.current);
    zu.current = setTimeout(schliessen, 260);
  };

  return (
    <NavEintrag ruft={ruft} onPointerEnter={betreten} onPointerLeave={verlassen}>
      {children}
    </NavEintrag>
  );
}

/**
 * Die Zahl am Eintrag — und zwar die, die eine Handlung verlangt.
 *
 * Eine Marke ist ein Ruf, kein Etikett. Solange „1 wartet auf Entscheidung"
 * und „1 ist heute abwesend" dieselbe Marke trugen (nur in einer anderen
 * Farbe), musste man jede einzelne lesen, um zu wissen, ob überhaupt etwas zu
 * tun ist — und farbige Marken, die nichts fordern, stumpfen genau die ab, die
 * es tun. Hier steht deshalb nur noch, was jemand tun muss; alles bloß
 * Wissenswerte trägt `NavKunde`.
 *
 * Null erscheint nie — siehe lib/schnellzugriff.ts.
 */
export function NavZahl({wert}: {wert: number}) {
  if (wert <= 0) return null;
  return <Badge variant="warning" label={String(wert)} />;
}

/**
 * Die Auskunft am Eintrag: „3 da", „1 abwesend". Sie fordert nichts, also
 * trägt sie keine Marke, sondern steht als leiser Sekundärtext da, wo die
 * Marke stünde. Das Wort dahinter ist der Unterschied zwischen einer Zahl, die
 * ruft, und einer, die nur Bescheid gibt.
 */
export function NavKunde({wert, wort}: {wert: number; wort: string}) {
  if (wert <= 0) return null;
  return (
    <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
      {wert} {wort}
    </Text>
  );
}
