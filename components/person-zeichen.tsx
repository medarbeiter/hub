'use client';

import {
  Avatar,
  AvatarGroup,
  AvatarGroupOverflow,
  DialogHeader,
  Divider,
  HStack,
  StackItem,
  Text,
  VStack,
} from '@astryxdesign/core';
import {useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode} from 'react';
import {fmtTage} from '@/lib/abwesenheit-arten';
import type {PersonAngabe} from '@/lib/avatar';
import {dauerSeit, fmtDurationSigned, fmtMonth, fmtTime, todayISO} from '@/lib/format';
import type {PersonenKarte, Weg} from '@/lib/personenkarte';
import {Ausklapp} from './ausklapp';
import {KartenGeruest} from './ladegeruest';
import {ProfilKommentare} from './profil-kommentare';
import {ProfilZiele} from './profil-ziele';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';
import {Verweis} from './verweis';
import {Zahlwert} from './zahlwert';

/**
 * **Die eine Stelle, an der eine Person gezeigt wird.**
 *
 * Vor diesem Bau stand das Profilbild an genau zwei Stellen — im Fuß der
 * Seitenleiste und im Bildbogen des Profils — und überall sonst war ein Mensch
 * eine Zeichenkette: in der Personentafel, in beiden Prüfschlangen, im
 * Teamkalender, im Protokoll. Elf Oberflächen zeichneten denselben Gegenstand
 * elfmal, und keine davon konnte man mit einem Blick lesen.
 *
 * ## Das Zeichen ist ein Wiedererkennungshilfe, nie eine Kennung
 *
 * Es gibt zehn Tierfiguren und mehr als zehn Konten — **zwei Menschen tragen
 * unweigerlich dasselbe Bild.** Daraus folgt die Regel, an der sich jede
 * Verwendung messen lassen muss: *ein Gesicht trägt immer seinen Namen mit.*
 * Auf drei Wegen, in dieser Reihenfolge:
 *
 * 1. **Sichtbar daneben** (`mitName`) — überall, wo Platz ist. Das Bild ist
 *    dann Beschleunigung, nicht Auskunft, und eine Dopplung kostet nichts.
 * 2. **Beim Zeigen und beim Tabben** — Astryx' `Avatar` hängt an `name` von
 *    sich aus eine Sprechblase, die auch der Tastaturfokus auslöst.
 * 3. **Im Barrierebaum** — immer, unabhängig von 1 und 2.
 *
 * Wo der Name nicht sichtbar steht, muss die Umgebung ihn zusätzlich führen
 * (die Gitterzelle nennt in ihrer `aria-label` alle Namen, die Reihe klappt
 * ihre Liste auf). Grund: eine Sprechblase gibt es auf dem Telefon nicht, und
 * genau dort darf die Auskunft nicht verschwinden.
 *
 * Wer eindeutige Zeichen will, lädt ein Foto hoch — die Tierfiguren sind der
 * Rückfall, kein Namensraum.
 */

/** Die Größenstufen der Anwendung auf Astryx' Maße. */
const MASS = {
  winzig: 16, //    16px — in einer Gittermarke, wo das Sinnbild 14 px misst
  zeile: 'sm', //   24px — Tabellen- und Listenzeile
  karte: 'md', //   36px — Entscheidungsleiste, Karte
  gross: 'lg', //   48px — Kopf einer Person
  bogen: 'xl', //  128px — Bildbogen im Profil
} as const;

export type PersonGroesse = keyof typeof MASS;

interface PersonZeichenProps {
  /**
   * Wer. `null` heißt: hinter diesem Namen steht kein abrufbares Konto mehr —
   * ein gelöschter Akteur im Protokoll. Dann bleiben die Initialen aus
   * `ersatzName`, und das ist die ehrliche Antwort statt eines fremden Bildes.
   */
  person: PersonAngabe | null;
  /** Der eingefrorene Name, wenn `person` fehlt. */
  ersatzName?: string | null;
  groesse?: PersonGroesse;
  /** Den Namen sichtbar danebenstellen. */
  mitName?: boolean;
  /**
   * Was statt des vollen Namens dasteht — der Nachname in einer 120-px-Zelle.
   * Die Sprechblase und der Barrierebaum führen weiter den vollen Namen: die
   * Kürzung ist eine Platzfrage, keine Auskunftsfrage.
   */
  label?: string;
  /** Die zweite Zeile unter dem Namen. */
  unterzeile?: ReactNode;
  /**
   * Wohin dieses Zeichen führt. Steht der Name sichtbar daneben, trägt **er**
   * den Verweis (mit dem Puls jedes Hausverweises); das Bild gehört der Karte.
   * Ohne sichtbaren Namen wandert das Ziel in die Karte — dort ist es eine
   * Zeile mit Beschriftung statt eines Klicks, den niemand ankündigt.
   */
  href?: string;
  /** Wie das Ziel in der Karte heißt, wenn „Zum Blatt dieser Person" falsch wäre. */
  zielText?: string;
  /** Astryx' Ecke am Bild: ein Anwesenheitspunkt. */
  status?: ReactNode;
  /** Ein Zusatz rechts neben dem Namen — „(Du)", eine Marke. */
  zusatz?: ReactNode;
  /** Hebt den Namen hervor: die eigene Zeile im Team- oder Kalenderblatt. */
  betont?: boolean;
  /**
   * Das **Bild** ist der Knopf, der die Personenkarte öffnet — überall, nicht
   * nur dort, wo eine Fläche zufällig frei war. Der Name daneben behält seinen
   * `href`: zwei Ziele, zwei Flächen — das Gesicht sagt „wer ist das", der
   * Name führt zum Blatt dieser Person.
   *
   * Auf `false` nur, wo das Zeichen selbst schon in einem Knopf oder Verweis
   * steckt und sich das nicht auflösen lässt (der Fuß der Seitenleiste führt
   * als Ganzes ins Profil) oder wo es keine Person zum Nachschlagen gibt (die
   * Anmeldeseite kennt niemanden, sie erinnert sich nur). Ein Knopf im Knopf
   * ist kein gültiges HTML.
   */
  karte?: boolean;
  /**
   * Unterdrückt Astryx' eigene Namens-Sprechblase am Bild. Für den einen Fall,
   * in dem außen herum schon eine steht: die Marke im Teamkalender, deren
   * Sprechblase den Namen **und** den Grund trägt. Zwei Blasen an einem Bild
   * sind eine zu viel — die Regel „ein Gesicht nennt beim Zeigen seinen Namen"
   * bricht das nicht, sie erfüllt sie an der äußeren Blase.
   */
  ohneBlase?: boolean;
  /**
   * Die Karte woanders öffnen. In einer `AvatarGroup` reicht Astryx das Maß
   * der Gruppe per React-Kontext an **jedes** Bild darunter weiter — auch an
   * die Karte, die dieses Zeichen sonst selbst aufhängt, samt dem großen Bild
   * darin. Die Reihe hängt die Karte deshalb außerhalb der Gruppe auf und gibt
   * dem Zeichen nur den Griff.
   */
  oeffneKarte?: () => void;
}

export function PersonZeichen({
  person,
  ersatzName,
  groesse = 'zeile',
  mitName = false,
  label,
  unterzeile,
  href,
  zielText,
  status,
  zusatz,
  betont = false,
  karte = true,
  ohneBlase = false,
  oeffneKarte,
}: PersonZeichenProps) {
  const [karteOffen, setKarteOffen] = useState(false);
  const name = person?.name ?? ersatzName ?? '';

  /* Ein Bild ohne Konto dahinter (ein gelöschter Akteur) öffnet nichts — die
     Karte hätte nichts zu zeigen als die Initialen, die schon dastehen. */
  const oeffnet = karte && person !== null;

  const rohbild = (
    <Avatar
      size={MASS[groesse]}
      name={name || undefined}
      src={person?.bild}
      /* Der Barrierebaum sagt, was der Klick tut; die Sprechblase bleibt beim
         bloßen Namen — sie ist eine Auskunft, keine Aufforderung. */
      alt={oeffnet && name ? `${name} – Profil ansehen` : name}
      status={status}
      /* Die Sprechblase trägt **immer** den Namen: zehn Figuren auf mehr als
         zehn Konten heißt, dass zwei Menschen dasselbe Bild tragen, und dann
         ist der Name die eigentliche Auskunft. Auch neben dem sichtbaren Namen
         bleibt sie stehen — eine Dopplung kostet nichts, eine Verwechslung
         schon. Nur wo außen herum schon eine Blase hängt, schweigt sie. */
      tooltip={ohneBlase ? false : true}
      onClick={oeffnet ? (oeffneKarte ?? (() => setKarteOffen(true))) : undefined}
    />
  );

  const bild = oeffnet && !oeffneKarte ? (
    <>
      {rohbild}
      <PersonKarte
        person={person}
        isOpen={karteOffen}
        onOpenChange={setKarteOffen}
        blattHref={href}
        blattText={zielText}
      />
    </>
  ) : (
    rohbild
  );

  const namensblock = (
    <VStack gap={0}>
      <HStack gap={1.5} vAlign="center" wrap="nowrap">
        <Text type="label" size="sm" weight={betont ? 'semibold' : 'medium'} maxLines={1}>
          {label ?? name}
        </Text>
        {zusatz}
      </HStack>
      {unterzeile && (
        <Text type="supporting" size="sm" color="secondary">
          {unterzeile}
        </Text>
      )}
    </VStack>
  );

  const kern = mitName ? (
    <HStack gap={2} vAlign="center" wrap="nowrap">
      {bild}
      {/* Zwei Ziele, zwei Flächen: das Gesicht öffnet die Karte, der Name führt
          zum Blatt. Deshalb liegt der Verweis hier und nicht um beides. */}
      {href && oeffnet ? (
        <Verweis href={href} className="tafel-verweis">
          {namensblock}
        </Verweis>
      ) : (
        namensblock
      )}
    </HStack>
  ) : (
    bild
  );

  /* Mit Karte bleibt der Verweis beim Text: sonst läge er über dem Knopf. Steht
     kein Name daneben, trägt die Karte das Ziel als beschriftete Zeile. */
  return href && !oeffnet ? (
    <Verweis href={href} className="tafel-verweis" aria-label={mitName ? undefined : name}>
      {kern}
    </Verweis>
  ) : (
    kern
  );
}

/**
 * Die Personenkarte: das Bild groß, die Angaben daneben — und darunter, was
 * der Betrachter darüber hinaus wissen darf.
 *
 * Was drinsteht, entscheidet der Server, nicht dieser Dialog: `personenKarte()`
 * in `lib/personenkarte.ts` schneidet **eine** Antwort je Recht des Fragenden
 * zu. Ein Kollege bekommt Steckbrief, Ziele und Kommentare; wer `zeit.team`
 * oder `abwesenheit.pruefen` trägt — oder auf der eigenen Karte steht —,
 * bekommt dazu den `einblick`: Zeitkonto, Resturlaub, offene Tage, der laufende
 * Eintrag, und die Wege dorthin, wo man handeln kann. Fehlt der Schlüssel,
 * fehlt der Abschnitt; der Browser lernt kein Recht und hat nichts zu
 * verbergen.
 *
 * ## Einmal wachsen statt dreimal springen
 *
 * Vorher holte die Karte drei Adressen und hängte jeden Abschnitt, sobald
 * seiner da war. Jetzt steht beim Öffnen sofort das Gerüst (`KartenGeruest`,
 * dieselben Bänder wie der Inhalt), die eine Antwort kommt, und der Rumpf
 * läuft **animiert** von der Höhe des Gerüsts auf die des Inhalts
 * (`useWuchs`) — die Abschnitte kommen gestaffelt herein, wie die Suchtreffer.
 * Ein Wechsel, kein Umbau; und weil der Kopf die Rolle nicht mehr als
 * Untertitel trägt, ändert er seine Höhe nie.
 */
export function PersonKarte({
  person,
  isOpen,
  onOpenChange,
  blattHref,
  blattText,
}: {
  person: PersonAngabe;
  isOpen: boolean;
  onOpenChange: (offen: boolean) => void;
  /** Das Blatt dieser Person, wenn die aufrufende Fläche eines kennt. */
  blattHref?: string;
  /** Wie das Ziel heißt, wenn es kein Personenblatt ist. */
  blattText?: string;
}) {
  const [karte, setKarte] = useState<PersonenKarte | null>(null);
  const rumpf = useRef<HTMLElement>(null);

  // Jede Öffnung beginnt beim Gerüst — noch im Render, nicht erst im Effekt:
  // sonst stünde beim zweiten Mal für ein Bild der alte Stand, der Beobachter
  // in `useWuchs` merkte sich dessen Höhe, und die Karte wüchse vom falschen
  // Ausgangswert (gemessen: 575 → 582 statt Gerüst → Inhalt).
  const [offenZuvor, setOffenZuvor] = useState(isOpen);
  if (isOpen !== offenZuvor) {
    setOffenZuvor(isOpen);
    if (isOpen) setKarte(null);
  }

  const laden = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const antwort = await fetch(`/api/person/${person.id}`, {signal});
        const daten: PersonenKarte | null = antwort.ok ? await antwort.json() : null;
        if (!daten) return;
        // Zwei Bilder warten, ehe der Inhalt kommt: die Antwort von localhost ist
        // schneller als das erste Bild nach dem Öffnen, und erst nach einem
        // gezeichneten Bild hat der Beobachter die Höhe des Gerüsts gesehen —
        // die, von der die Karte wachsen soll.
        await new Promise(requestAnimationFrame);
        await new Promise(requestAnimationFrame);
        if (!signal?.aborted) setKarte(daten);
      } catch {
        /* abgebrochen oder ohne Netz: das Gerüst bleibt stehen */
      }
    },
    [person.id],
  );

  useEffect(() => {
    // Nur beim Öffnen und nur für ein echtes Konto: die Anmeldeseite kennt eine
    // Person ohne Kennung (id 0), und hinter der stünde niemand zum Nachschlagen.
    if (!isOpen || person.id <= 0) return;
    const abbruch = new AbortController();
    laden(abbruch.signal);
    return () => abbruch.abort();
  }, [isOpen, person.id, laden]);

  useWuchs(rumpf, karte !== null);

  return (
    <TafelDialog isOpen={isOpen} onOpenChange={onOpenChange} width={560}>
      {/* Die Karte hat keine Fußleiste, aus der man sie schließen könnte —
          deshalb trägt die Kopfzeile das Kreuz. Escape und der Schleier tun
          dasselbe, aber ein Finger hat kein Escape. Kein Untertitel: die Rolle
          käme erst mit der Antwort, und ein Kopf, der dann eine Zeile wächst,
          verschöbe alles darunter. */}
      <DialogHeader title={karte?.person.name ?? person.name} onOpenChange={onOpenChange} />
      {/* Der Rollbereich liegt um alles: die Karte wächst mit den Kommentaren,
          und Astryx deckelt den Dialog bei 75vh — die Regel für rechnende
          Dialoge, hier aus demselben Grund. */}
      <VStack ref={rumpf} className="tafel-rumpf karte-rumpf" gap={0}>
        {karte ? (
          <KartenInhalt
            karte={karte}
            bild={person.bild}
            blattHref={blattHref}
            blattText={blattText}
            schliessen={() => onOpenChange(false)}
            nachladen={laden}
          />
        ) : (
          <KartenGeruest />
        )}
      </VStack>
    </TafelDialog>
  );
}

/** Muss zu `--takt-zug` in globals.css passen — der Rückfall, falls kein transitionend kommt. */
const TAKT_ZUG_MS = 360;

/**
 * Lässt den Rumpf beim Wechsel vom Gerüst zum Inhalt von der einen Höhe auf
 * die andere *laufen* statt zu springen.
 *
 * Die alte Höhe muss vor dem Wechsel bekannt sein, und ein Layout-Effekt sieht
 * sie erst, wenn der Inhalt schon steht. Deshalb hält ein ResizeObserver die
 * zuletzt gemessene Höhe fest — er läuft nach dem Layout und damit nach dem
 * Effekt, der sie beim Wechsel liest. Danach wird die Höhe wieder freigegeben,
 * damit ein neuer Kommentar die Karte wie gewohnt wachsen lässt.
 */
function useWuchs(ref: React.RefObject<HTMLElement | null>, bereit: boolean) {
  const zuletzt = useRef(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const beobachter = new ResizeObserver(() => {
      zuletzt.current = element.offsetHeight;
    });
    beobachter.observe(element);
    return () => beobachter.disconnect();
  }, [ref, bereit]);

  useLayoutEffect(() => {
    const element = ref.current;
    const von = zuletzt.current;
    if (!bereit || !element || von === 0) return;
    const bis = element.scrollHeight;
    if (von === bis || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    element.style.blockSize = `${von}px`;
    element.classList.add('karte-waechst');
    void element.offsetHeight; // den Ausgangswert festschreiben, bevor das Ziel kommt
    element.style.blockSize = `${bis}px`;

    const fertig = () => {
      element.style.blockSize = '';
      element.classList.remove('karte-waechst');
    };
    const beiEnde = (ereignis: TransitionEvent) => ereignis.target === element && fertig();
    element.addEventListener('transitionend', beiEnde);
    const zeit = setTimeout(fertig, TAKT_ZUG_MS + 50);
    return () => {
      clearTimeout(zeit);
      element.removeEventListener('transitionend', beiEnde);
      fertig();
    };
  }, [ref, bereit]);
}

const WEG_SINN: Record<Weg['art'], Parameters<typeof Sinnbild>[0]['sinn']> = {
  zeitblatt: 'tag',
  konto: 'konto',
  protokoll: 'protokoll',
  bearbeiten: 'bearbeiten',
  profil: 'person',
  ziele: 'ziele',
};

/** Der Abschnitt Nummer n kommt n × 40 ms später herein (`.karte-abschnitt`). */
const reihe = (n: number) => ({'--reihe': n}) as CSSProperties;

function KartenInhalt({
  karte,
  bild,
  blattHref,
  blattText,
  schliessen,
  nachladen,
}: {
  karte: PersonenKarte;
  bild: string;
  blattHref?: string;
  blattText?: string;
  schliessen: () => void;
  nachladen: () => Promise<unknown>;
}) {
  // Das Bild bleibt das der Zeile: es kam frisch vom Server, und die Karte
  // holte sonst ein gerade ersetztes Profilbild aus dem Bildspeicher zurück.
  const angabe = {...karte.person, bild};
  const {einblick} = karte;
  const heute = todayISO();

  // Heute: eine Abwesenheit sagt mehr als der Stempel — und ist für jeden
  // sichtbar, den der Server dafür freigegeben hat; der Stempelstand nur im
  // Einblick.
  let heuteSinn: Parameters<typeof Sinnbild>[0]['sinn'] | null = null;
  let heuteText: string | null = null;
  if (karte.heute) {
    heuteSinn = 'abwesenheit';
    heuteText = karte.heute;
  } else if (einblick?.status) {
    const {status, since, sinceYesterday} = einblick.status;
    const seit = since === null ? '' : ` seit ${fmtTime(since)}${sinceYesterday ? ' (gestern)' : ''} Uhr`;
    heuteSinn = status === 'arbeit' ? 'einstempeln' : status === 'pause' ? 'pause' : 'ausstempeln';
    heuteText = status === 'arbeit' ? `Eingestempelt${seit}` : status === 'pause' ? `In Pause${seit}` : 'Nicht eingestempelt';
  }

  const zahlen: {beschriftung: string; wert: string}[] = [];
  if (einblick?.zeitkontoMin !== undefined) zahlen.push({beschriftung: 'Zeitkonto', wert: `${fmtDurationSigned(einblick.zeitkontoMin)} Std.`});
  if (einblick?.resturlaub !== undefined) zahlen.push({beschriftung: 'Resturlaub', wert: fmtTage(einblick.resturlaub)});
  if (einblick?.offeneTage !== undefined) zahlen.push({beschriftung: 'Offene Tage', wert: String(einblick.offeneTage)});

  // Kennt der Einblick den Weg schon, steht er nicht zweimal auf der Karte —
  // verglichen am Pfad, denn die Zeile hängt ihren Tag als `?tag=` an.
  const pfad = (href: string) => href.split('?')[0];
  const blatt = blattHref && !einblick?.wege.some((w) => pfad(w.href) === pfad(blattHref)) ? blattHref : null;

  return (
    <>
      <HStack gap={4} padding={4} vAlign="start" wrap="wrap" className="karte-abschnitt" style={reihe(0)}>
        {/* Das Bild in der eigenen Karte öffnet keine zweite: es ist schon die
            Antwort auf die Frage, mit der jemand hier gelandet ist. */}
        <PersonZeichen person={angabe} groesse="bogen" karte={false} />
        <StackItem size="fill">
          <VStack gap={3}>
            {angabe.rolle && <KartenZeile sinn="rolle" beschriftung="Rolle" wert={angabe.rolle} />}
            {angabe.email && (
              <KartenZeile
                sinn="email"
                beschriftung="E-Mail"
                wert={
                  /* Kein next/link: eine mailto-Adresse verlässt den Router. */
                  <a href={`mailto:${angabe.email}`}>
                    <Text type="body" color="accent">
                      {angabe.email}
                    </Text>
                  </a>
                }
              />
            )}
            {karte.eintritt && (
              <KartenZeile
                sinn="teamleben"
                beschriftung="Im Team seit"
                wert={`${fmtMonth(karte.eintritt.slice(0, 7))} · ${dauerSeit(karte.eintritt, heute)}`}
              />
            )}
            {heuteSinn && heuteText && <KartenZeile sinn={heuteSinn} beschriftung="Heute" wert={heuteText} />}
            {blatt && (
              <Verweis href={blatt} onClick={schliessen}>
                <HStack gap={1.5} vAlign="center">
                  <Sinnbild sinn="weiter" groesse="zeile" ton="akzent" />
                  <Text type="label" color="accent">
                    {blattText ?? 'Zum Blatt dieser Person'}
                  </Text>
                </HStack>
              </Verweis>
            )}
          </VStack>
        </StackItem>
      </HStack>

      {einblick && (zahlen.length > 0 || einblick.wege.length > 0) && (
        <>
          <Divider />
          <VStack gap={3} padding={4} className="karte-abschnitt" style={reihe(1)}>
            <HStack gap={1.5} vAlign="center">
              <Sinnbild sinn="berichte" groesse="zeile" ton="sekundaer" />
              <Text type="label" size="sm" color="secondary">
                {karte.selbst ? 'Dein Stand' : 'Einblick'}
              </Text>
            </HStack>
            {zahlen.length > 0 && (
              <HStack gap={6} wrap="wrap">
                {zahlen.map((z) => (
                  <VStack key={z.beschriftung} gap={0}>
                    <Text type="supporting" size="sm" color="secondary">
                      {z.beschriftung}
                    </Text>
                    <Text type="body" weight="semibold" hasTabularNumbers>
                      <Zahlwert wert={z.wert} />
                    </Text>
                  </VStack>
                ))}
              </HStack>
            )}
            {einblick.wege.length > 0 && (
              <HStack gap={4} wrap="wrap">
                {einblick.wege.map((w) => (
                  <Verweis key={w.art} href={w.href} onClick={schliessen}>
                    <HStack gap={1} vAlign="center" wrap="nowrap">
                      <Sinnbild sinn={WEG_SINN[w.art]} groesse="zeile" ton="akzent" />
                      <Text type="label" color="accent">
                        {w.text}
                      </Text>
                    </HStack>
                  </Verweis>
                ))}
              </HStack>
            )}
          </VStack>
        </>
      )}

      <Divider />
      <VStack gap={0} className="karte-abschnitt" style={reihe(2)}>
        <ProfilZiele ziele={karte.ziele} />
      </VStack>
      <Divider />
      <VStack gap={0} className="karte-abschnitt" style={reihe(3)}>
        <ProfilKommentare personId={karte.person.id} stand={karte.kommentare} nachladen={nachladen} />
      </VStack>
    </>
  );
}

function KartenZeile({
  sinn,
  beschriftung,
  wert,
}: {
  sinn: Parameters<typeof Sinnbild>[0]['sinn'];
  beschriftung: string;
  wert: ReactNode;
}) {
  return (
    <HStack gap={2} vAlign="start" wrap="nowrap">
      <Sinnbild sinn={sinn} groesse="zeile" ton="sekundaer" />
      <VStack gap={0}>
        <Text type="supporting" size="sm" color="secondary">
          {beschriftung}
        </Text>
        {typeof wert === 'string' ? <Text type="body">{wert}</Text> : wert}
      </VStack>
    </HStack>
  );
}

interface PersonenReiheProps {
  personen: PersonAngabe[];
  /** Wie viele Gesichter stehen, bevor „+N" übernimmt. */
  max?: number;
  groesse?: PersonGroesse;
  /**
   * Was der Barrierebaum über die ganze Reihe sagt — „3 Personen anwesend".
   * Die Einzelnamen hängen an den Bildern selbst.
   */
  beschriftung?: string;
  /**
   * Wohin ein einzelnes Gesicht führt, falls es irgendwohin führt — als
   * Muster mit `:id`, nicht als Funktion: die Reihe steht auch in
   * Serverkomponenten, und eine Funktion überquert diese Grenze nicht.
   */
  hrefMuster?: string;
}

/**
 * Mehrere Personen als überlappende Reihe, mit „+N" am Ende.
 *
 * Das „+N" ist ein Knopf, kein Schild: es klappt die vollständige Liste mit
 * Namen darunter auf. Das ist der Weg, den ein Telefon braucht — dort gibt es
 * kein Zeigen und damit keine Sprechblase, und eine Reihe, die drei von zwölf
 * Gesichtern zeigt und die übrigen neun verschweigt, wäre eine Auskunft, die
 * sich selbst zurücknimmt.
 */
export function PersonenReihe({
  personen,
  max = 5,
  groesse = 'zeile',
  beschriftung,
  hrefMuster,
}: PersonenReiheProps) {
  const [offen, setOffen] = useState(false);
  const [karte, setKarte] = useState<PersonAngabe | null>(null);
  const [karteOffen, setKarteOffen] = useState(false);
  if (personen.length === 0) return null;

  const ziel = (p: PersonAngabe) => hrefMuster?.replace(':id', String(p.id));
  const zeigen = (p: PersonAngabe) => { setKarte(p); setKarteOffen(true); };

  const gezeigt = personen.slice(0, max);
  const rest = personen.length - gezeigt.length;

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="center" wrap="nowrap" aria-label={beschriftung}>
        <AvatarGroup size={MASS[groesse]}>
          {/* Auch hier öffnet das Gesicht die Karte — ein Bild in einer Reihe
              ist dasselbe Bild. Wohin die Person führt, steht dann in der
              Karte; die Reihe selbst hat für einen zweiten Klick keinen Platz.
              Die Gruppe zieht Maß und Überlappung über ihren Kontext, auch
              durch das Zeichen hindurch. */}
          {gezeigt.map((p) => (
            <PersonZeichen key={p.id} person={p} groesse={groesse} href={ziel(p)} oeffneKarte={() => zeigen(p)} />
          ))}
          {rest > 0 && (
            <AvatarGroupOverflow count={rest} onClick={() => setOffen((o) => !o)} />
          )}
        </AvatarGroup>
      </HStack>

      {/* Eine Karte für die ganze Reihe, außerhalb der Gruppe — siehe `oeffneKarte`. */}
      {karte && <PersonKarte person={karte} isOpen={karteOffen} onOpenChange={setKarteOffen} blattHref={ziel(karte)} />}

      {/* Nur gehängt, wenn es etwas zu verschweigen gäbe. */}
      {rest > 0 && (
        <Ausklapp offen={offen}>
          <VStack gap={1}>
            {personen.map((p) => (
              <StackItem key={p.id}>
                <PersonZeichen person={p} groesse="winzig" mitName href={ziel(p)} />
              </StackItem>
            ))}
          </VStack>
        </Ausklapp>
      )}
    </VStack>
  );
}
