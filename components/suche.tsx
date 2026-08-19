'use client';

import {Button, HStack, Kbd, Tab, TabList, Text, VStack} from '@astryxdesign/core';
import {CommandPalette, CommandPaletteInput, useCommandPaletteContext} from '@astryxdesign/core/CommandPalette';
import type {SearchSource, SearchableItem} from '@astryxdesign/core/Typeahead';
import {useRouter} from 'next/navigation';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {Treffer} from '@/lib/suche';
import {TrefferGeruest} from './ladegeruest';
import {PersonZeichen} from './person-zeichen';
import {Sinnbild} from './sinnbilder';

type SuchItem = SearchableItem<Omit<Treffer, 'id' | 'label'> & {group: string}>;

/**
 * Wie lange die Suche wartet, bevor sie fragt.
 *
 * Getippt wird in Schüben, nicht in Buchstaben: „urlaub" wären sechs Fragen an
 * die Datenbank, von denen fünf niemand liest. Eine knappe Fünftelsekunde nach
 * dem letzten Anschlag ist kürzer als der Blick zur Liste und spart die
 * fünf. Solange gewartet wird, filtert die Palette die vorigen Treffer selbst
 * weiter — die Liste steht also nie still und blinkt nie leer.
 */
const RUHE_MS = 180;

/**
 * Der Reiter, der nicht zuschneidet — und die eine Gruppe, die nie einer wird.
 *
 * „Weitersuchen" steht in jeder Antwort und hat immer genau eine Zeile; ein
 * Reiter dafür wäre eine Kategorie, die nichts kategorisiert. Der Wortlaut ist
 * `GRUPPE_WEITER` in `lib/suche.ts` — von dort importierbar ist er nicht, das
 * Modul hängt an der Datenbank.
 */
const ALLE = 'alle';
const WEITER = 'Weitersuchen';

/** Ein Wartezeitraum, den ein neuer Anschlag abbrechen kann. */
function ruhe(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((weiter, abbrechen) => {
    const uhr = setTimeout(weiter, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(uhr);
        abbrechen(signal.reason);
      },
      {once: true},
    );
  });
}

/**
 * Die Suche über das ganze Haus: ein Feld, das Wege, Personen und Vorgänge
 * findet — und nur die, die der Suchende auch sehen darf.
 *
 * Sie weiß selbst von keinem einzigen Recht. Jede Zeile kommt fertig
 * geschnitten und fertig sortiert vom Server (`lib/suche.ts`), samt ihrer
 * Adresse; hier wird getippt, gezeichnet und navigiert. Das ist kein Detail:
 * eine Suche, die clientseitig filtert, hat die Antwort vorher schon
 * ausgeliefert.
 *
 * Ihr Ort ist der Anfang der Stempelleiste: ganz links, vor deren erster
 * Angabe, auf jeder Route dieselbe Stelle — unabhängig davon, ob die
 * Seitenleiste gerade offen, schmal oder auf dem Telefon eingeklappt ist. In
 * der Seitenleiste war sie ein Weg unter Wegen; hier ist sie das, was sie ist —
 * die Abkürzung zu jedem von ihnen. Sie trägt dabei nichts Eigenes: derselbe
 * Knopf wie die Stempelhandlungen am anderen Ende derselben Leiste. Sie ist nie
 * der einzige Weg: alles, was sie findet, steht auch auf einer Seite, die man
 * erklicken kann.
 *
 * Das Blatt ist immer gleich hoch (`.suche-blatt` in globals.css). Eine
 * Palette, die mit jedem Buchstaben wächst und schrumpft, verschiebt die Zeile
 * unter dem Zeiger, während man auf sie zielt.
 */
export function Suche() {
  const [offen, setOffen] = useState(false);
  const router = useRouter();

  /** id → Adresse. Die Palette gibt beim Auswählen nur die Kennung zurück. */
  const wege = useRef(new Map<string, string>());

  /** Zum Zurückgeben des Schreibrechts, nachdem ein Reiter angeklickt wurde. */
  const feld = useRef<HTMLInputElement>(null);

  /**
   * Die Reiterleiste: welche Kategorien die *ungeschnittene* Antwort hatte, und
   * welche gerade offen ist (`null` = alle). Der Zuschnitt selbst geschieht auf
   * dem Server — der Reiter ist eine zweite Frage, keine zweite Ansicht auf
   * dieselbe Antwort: je Kategorie legt die Suche sonst nur ihre besten vier
   * vor, und „Personen" soll mehr zeigen als das, wenn man es anklickt.
   *
   * Deshalb auch der Ref neben dem Zustand: die Quelle wird einmal gebaut und
   * liest beim Abruf, was gerade gilt.
   */
  const [gruppen, setGruppen] = useState<string[]>([]);
  const [bereich, setBereich] = useState<string | null>(null);
  const bereichRef = useRef<string | null>(null);

  // Strg/Cmd + K, wie überall. Nicht die einzige Tür: die Pille selbst ist ein
  // Knopf, damit ein Gerät ohne Tastatur nichts verliert.
  useEffect(() => {
    const horcher = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOffen((zu) => !zu);
      }
    };
    window.addEventListener('keydown', horcher);
    return () => window.removeEventListener('keydown', horcher);
  }, []);

  const quelle = useMemo<SearchSource<SuchItem>>(() => {
    let abbruch: AbortController | null = null;
    let letzteFrage: string | null = null;
    const hole = async (frage: string, warten: boolean): Promise<SuchItem[]> => {
      abbruch?.abort();
      const eigen = new AbortController();
      abbruch = eigen;
      // Ein neuer Wortlaut ist eine neue Antwort, und der Reiter der vorigen
      // gehört ihr nicht: „Personen" zu „mül" kann zu „müller" leer sein.
      // Dieselbe Frage noch einmal heißt darum: der Reiter hat gewechselt.
      if (frage !== letzteFrage) {
        letzteFrage = frage;
        bereichRef.current = null;
        setBereich(null);
      }
      const zuschnitt = bereichRef.current;
      try {
        if (warten) await ruhe(RUHE_MS, eigen.signal);
        const adresse = `/api/suche?q=${encodeURIComponent(frage)}${
          zuschnitt ? `&bereich=${encodeURIComponent(zuschnitt)}` : ''
        }`;
        const antwort = await fetch(adresse, {signal: eigen.signal});
        if (!antwort.ok) return [];
        const treffer: Treffer[] = await antwort.json();
        // Welche Reiter es gibt, weiß nur die ungeschnittene Antwort.
        if (!zuschnitt) {
          setGruppen([...new Set(treffer.map((t) => t.gruppe))].filter((g) => g !== WEITER));
        }
        return treffer.map(({id, label, gruppe, ...rest}) => {
          wege.current.set(id, rest.href);
          return {id, label, auxiliaryData: {...rest, gruppe, group: gruppe}};
        });
      } catch {
        // Ein abgebrochener Abruf ist der Normalfall beim Weitertippen, und
        // ein fehlgeschlagener sagt „nichts gefunden" — eine Suche ist kein
        // Ort für eine Fehlermeldung über sich selbst.
        return [];
      }
    };
    return {
      search: (frage) => hole(frage, true),
      // Das leere Blatt kommt sofort: es hängt an keinem Anschlag.
      bootstrap: () => hole('', false),
      cancel: () => abbruch?.abort(),
    };
  }, []);

  const gehe = useCallback(
    (id: string) => {
      const ziel = wege.current.get(id);
      if (!ziel) return;
      // Was kein Seitenweg ist, holt der Browser selbst — der Router kennt
      // die CSV-Ausgabe nicht als Route.
      if (ziel.startsWith('/api/')) window.location.href = ziel;
      else router.push(ziel);
    },
    [router],
  );

  return (
    <>
      {/* Zeichen, Wort, Tastenkürzel — in dieser Reihenfolge zu lesen und in
          dieser Reihenfolge zu benutzen. Sonst nichts: kein eigener Schatten,
          keine eigene Form. Was in der Leiste steht, sieht aus wie die Leiste. */}
      <Button
        className="suche-knopf"
        label="Suchen"
        variant="secondary"
        icon={<Sinnbild sinn="suchen" />}
        endContent={<Kbd keys="mod+k" />}
        onClick={() => setOffen(true)}
      />
      <CommandPalette<SuchItem>
        isOpen={offen}
        onOpenChange={setOffen}
        searchSource={quelle}
        onValueChange={gehe}
        label="Suche"
        className="suche-blatt"
        input={
          <>
            <CommandPaletteInput ref={feld} placeholder="Wonach suchst du?" label="Suche" />
            <Reiterleiste
              gruppen={gruppen}
              aktiv={bereich}
              waehle={(g) => {
                bereichRef.current = g;
                setBereich(g);
                // Der Reiter fragt noch einmal — und gibt danach das
                // Schreibrecht zurück: wer weitertippt, tippt ins Feld.
                feld.current?.focus();
              }}
            />
          </>
        }
        emptyBootstrapText="Tippe einen Namen, ein Wort oder ein Datum"
        emptySearchText="Nichts gefunden — andere Schreibweise?"
        footer={
          <>
            <LadeSchicht />
            {/* Ränder, damit die Hinweise nicht in den Ecken des Blattes
                kleben — sie sind eine Fußnote, keine Kante. */}
            <HStack gap={6} vAlign="center" hAlign="center" paddingBlock={2} paddingInline={4}>
              <Hinweis text="Bewegen">
                <Kbd keys="up" />
                <Kbd keys="down" />
              </Hinweis>
              <Hinweis text="Öffnen">
                <Kbd keys="enter" />
              </Hinweis>
              <Hinweis text="Schließen">
                <Kbd keys="escape" />
              </Hinweis>
            </HStack>
          </>
        }
        renderItem={(item) => <Zeile item={item} />}
      />
    </>
  );
}

/**
 * Die Reiter unter dem Feld: „Alle" und je eine gefundene Kategorie.
 *
 * Sie erscheinen erst, wenn es etwas zu trennen gibt — bei einer einzigen
 * Kategorie wäre „Alle | Personen" zweimal dasselbe Wort für dieselbe Liste.
 * Angeklickt wird nicht gefiltert, sondern **neu gefragt**: die Antwort legt je
 * Kategorie nur ihre besten vier vor, und ein Reiter, der vier von zwanzig
 * Personen zeigt, verspricht mehr als er hält. Den Zuschnitt macht darum der
 * Server (`bereich=` in `lib/suche.ts`), und dort fällt die Grenze je Gruppe
 * weg, weil es nur noch eine gibt.
 *
 * Der Wortlaut der Frage bleibt dabei stehen; `setSearch` derselben Frage ist
 * genau das Zeichen, an dem die Quelle einen Reiterwechsel erkennt.
 */
function Reiterleiste({
  gruppen,
  aktiv,
  waehle,
}: {
  gruppen: string[];
  aktiv: string | null;
  waehle: (gruppe: string | null) => void;
}) {
  const ctx = useCommandPaletteContext();
  if (gruppen.length < 2) return null;
  return (
    <HStack className="suche-reiter" vAlign="center" paddingInline={3}>
      <TabList
        size="sm"
        value={aktiv ?? ALLE}
        onChange={(wahl) => {
          waehle(wahl === ALLE ? null : wahl);
          ctx?.setSearch(ctx.search);
        }}
      >
        <Tab value={ALLE} label="Alle" />
        {gruppen.map((g) => (
          <Tab key={g} value={g} label={g} />
        ))}
      </TabList>
    </HStack>
  );
}

/**
 * Was steht, solange gefragt wird.
 *
 * Unter dieser Schicht liegt bis zum letzten Augenblick die Antwort auf die
 * *vorige* Frage — Astryx filtert sie beim Tippen weiter, damit die Liste nicht
 * leer blinkt. Nur: gefiltert heißt nicht beantwortet. „urlau" ließe die
 * Personen stehen, die „urlaub" nie zurückgäbe, und wer nicht bis zum Ende
 * liest, hält sie für das Ergebnis. Also wird nichts Halbes gezeigt, sondern
 * die Form dessen, was kommt (`TrefferGeruest`) — dieselbe Antwort auf dieselbe
 * Frage wie überall im Haus, nur hier in einem Dialog statt auf einer Seite.
 *
 * `isBusy` kommt aus der Palette selbst und nicht aus einem eigenen Zustand:
 * es ist genau dann falsch, wenn die neuen Zeilen eingehängt *sind*. Ein
 * eigenes Merkmal wäre einen Bildaufbau früher fertig — und dieser eine
 * Bildaufbau zeigt die alten Zeilen.
 *
 * Sie liegt über der Liste statt an ihrer Stelle (`.suche-lade` in
 * globals.css): die Liste behält ihre feste Höhe, das Blatt also seine.
 */
function LadeSchicht() {
  const laedt = useCommandPaletteContext()?.isBusy ?? false;

  // Und solange sie steht, tut die Eingabetaste nichts. Die Auswahl zeigt noch
  // auf eine Zeile der vorigen Frage; ein Anschlag, der nichts tut, ist besser
  // als einer, der irgendwohin führt. Im Fangmodus, damit er vor der Palette
  // ankommt, und nur solange die Schicht hängt.
  useEffect(() => {
    if (!laedt) return;
    const halten = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('keydown', halten, true);
    return () => document.removeEventListener('keydown', halten, true);
  }, [laedt]);

  if (!laedt) return null;
  // Angesagt wird das Warten von der Palette selbst („Wird gesucht", über die
  // höfliche Meldezone); das Gerüst ist die Form dazu und sonst nichts.
  return (
    <VStack className="suche-lade" gap={0} aria-hidden>
      <TrefferGeruest />
    </VStack>
  );
}

function Hinweis({text, children}: {text: string; children: React.ReactNode}) {
  return (
    <HStack gap={2} vAlign="center" wrap="nowrap">
      <HStack gap={1} vAlign="center" wrap="nowrap">
        {children}
      </HStack>
      <Text type="supporting" size="sm" color="secondary">
        {text}
      </Text>
    </HStack>
  );
}

/**
 * Eine Trefferzeile: Zeichen, Name, und darunter das, was ihn von seinen
 * Geschwistern unterscheidet.
 *
 * Ein Mensch trägt sein Gesicht statt eines Piktogramms — die dritte Stelle
 * im Haus, an der es die Personenkarte *nicht* öffnet: ein Knopf in einer
 * Auswahlzeile wäre ein zweites Ziel in einem Element, das als Ganzes
 * ausgewählt wird. Verloren geht dabei nichts, im Gegenteil: die Zeile führt
 * zur Person selbst, und das ist mehr, als die Karte zeigt.
 */
function Zeile({item}: {item: SuchItem}) {
  const daten = item.auxiliaryData;
  // Die Frage, zu der diese Zeile gehört — und damit der Schlüssel ihres
  // Auftritts: eine neue Antwort heißt neuer Schlüssel, heißt neues Element,
  // heißt die Animation läuft (dieselbe Mechanik wie der wechselnde Zugangscode
  // — ein Übergang auf einem bestehenden Element spielte hier nicht, weil die
  // Zeilen mit gleicher Kennung ihre DOM-Knoten behalten).
  const frage = useCommandPaletteContext()?.search ?? '';
  return (
    <HStack key={frage} className="suche-treffer" gap={3} vAlign="center" wrap="nowrap">
      {daten?.person ? (
        <PersonZeichen person={daten.person} groesse="zeile" karte={false} />
      ) : (
        daten?.sinn && <Sinnbild sinn={daten.sinn} ton="sekundaer" />
      )}
      <VStack gap={0}>
        <Text type="label" size="sm" maxLines={1}>
          {item.label}
        </Text>
        {daten?.zusatz && (
          <Text type="supporting" size="sm" color="secondary" maxLines={1}>
            {daten.zusatz}
          </Text>
        )}
      </VStack>
    </HStack>
  );
}
