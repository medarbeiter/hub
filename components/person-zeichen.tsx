'use client';

import {
  Avatar,
  AvatarGroup,
  AvatarGroupOverflow,
  DialogHeader,
  HStack,
  StackItem,
  Text,
  VStack,
} from '@astryxdesign/core';
import {useEffect, useState, type ReactNode} from 'react';
import type {PersonAngabe} from '@/lib/avatar';
import {istRolle, ROLLEN} from '@/lib/rechte';
import {Ausklapp} from './ausklapp';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';
import {Verweis} from './verweis';

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
      onClick={oeffnet ? () => setKarteOffen(true) : undefined}
    />
  );

  const bild = oeffnet ? (
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
 * Die Personenkarte: das Bild groß, die Angaben daneben.
 *
 * Was drinsteht, entscheidet der Server, nicht dieser Dialog — er zeigt, was
 * die Angabe trägt (siehe `PersonAngabe`). Vertragsdaten stehen bewusst nicht
 * darin: Wochenstunden und Zeitkonto gehören den Seiten, die dafür ein Recht
 * verlangen. Was hier steht, weiß im Haus ohnehin jeder.
 *
 * ## Nachladen statt Mitschleppen
 *
 * Die meisten Listen tragen nur Kennung, Name und Bild — die Personenangabe
 * ist dort die Zeichenlast einer Zeile, und Rolle und Adresse an jede Zelle
 * jeder Tabelle zu hängen hieße, sie tausendfach zu senden, damit sie einmal
 * gelesen wird. Fehlt etwas, holt die Karte es beim Öffnen nach
 * (`/api/person/<id>`, angemeldet wie das Profilbild). Schlägt der Abruf fehl,
 * bleibt stehen, was schon da war — eine Karte mit Bild und Namen ist immer
 * noch die Auskunft, für die sie geöffnet wurde.
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
  const [nachgeladen, setNachgeladen] = useState<PersonAngabe | null>(null);
  const vollstaendig = Boolean(person.rolle && person.email);

  useEffect(() => {
    // Nur beim Öffnen, nur wenn etwas fehlt, und nur für ein echtes Konto:
    // die Anmeldeseite kennt eine Person ohne Kennung (id 0), und hinter der
    // stünde niemand zum Nachschlagen.
    if (!isOpen || vollstaendig || nachgeladen || person.id <= 0) return;
    const abbruch = new AbortController();
    fetch(`/api/person/${person.id}`, {signal: abbruch.signal})
      .then((antwort) => (antwort.ok ? antwort.json() : null))
      .then((angabe: PersonAngabe | null) => angabe && setNachgeladen(angabe))
      .catch(() => {});
    return () => abbruch.abort();
  }, [isOpen, vollstaendig, nachgeladen, person.id]);

  const angabe = nachgeladen ?? person;
  const rolle = angabe.rolle && istRolle(angabe.rolle) ? ROLLEN[angabe.rolle].label : null;

  return (
    <TafelDialog isOpen={isOpen} onOpenChange={onOpenChange} width={520}>
      {/* Die Karte hat keine Fußleiste, aus der man sie schließen könnte —
          deshalb trägt die Kopfzeile das Kreuz. Escape und der Schleier tun
          dasselbe, aber ein Finger hat kein Escape. */}
      <DialogHeader title={angabe.name} subtitle={rolle ?? undefined} onOpenChange={onOpenChange} />
      <HStack className="tafel-rumpf" gap={4} padding={4} vAlign="start" wrap="wrap">
        {/* Das Bild in der eigenen Karte öffnet keine zweite: es ist schon die
            Antwort auf die Frage, mit der jemand hier gelandet ist. */}
        <PersonZeichen person={angabe} groesse="bogen" karte={false} />
        <StackItem size="fill">
          <VStack gap={3}>
            {rolle && <KartenZeile sinn="mitarbeiter" beschriftung="Rolle" wert={rolle} />}
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
            {blattHref && (
              <Verweis href={blattHref} onClick={() => onOpenChange(false)}>
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
    </TafelDialog>
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
  /** Wohin ein einzelnes Gesicht führt, falls es irgendwohin führt. */
  href?: (person: PersonAngabe) => string;
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
  href,
}: PersonenReiheProps) {
  const [offen, setOffen] = useState(false);
  if (personen.length === 0) return null;

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
            <PersonZeichen key={p.id} person={p} groesse={groesse} href={href?.(p)} />
          ))}
          {rest > 0 && (
            <AvatarGroupOverflow count={rest} onClick={() => setOffen((o) => !o)} />
          )}
        </AvatarGroup>
      </HStack>

      {/* Nur gehängt, wenn es etwas zu verschweigen gäbe. */}
      {rest > 0 && (
        <Ausklapp offen={offen}>
          <VStack gap={1}>
            {personen.map((p) => (
              <StackItem key={p.id}>
                <PersonZeichen person={p} groesse="winzig" mitName href={href?.(p)} />
              </StackItem>
            ))}
          </VStack>
        </Ausklapp>
      )}
    </VStack>
  );
}
