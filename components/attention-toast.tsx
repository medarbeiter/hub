'use client';

import {Button, HStack, Text, VStack} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {usePathname} from 'next/navigation';
import {useEffect, useRef} from 'react';
import {fmtDate} from '@/lib/format';
import type {Issue} from '@/lib/attention';
import {useMelde} from './melde';
import {Sinnbild} from './sinnbilder';

interface AttentionToastProps {
  issues: Issue[];
  /** Dates needing correction, most recent first. */
  queue: string[];
}

/** Dismissal lasts for the browser session — payroll data should keep asking. */
const DISMISS_KEY = 'medarbeiter.korrekturen.ausgeblendet';

/** Ein Ort für diese Meldung, egal wie oft sie neu gestellt wird. */
const TOAST_ID = 'medarbeiter.korrekturen';

/** Wie viele Tage die Meldung beim Namen nennt, bevor sie zählt statt aufzählt. */
const HOECHSTENS = 3;

function dayLink(date: string): string {
  return `/?ansicht=tag&tag=${date}`;
}

/**
 * „Ihr Datensatz hat Löcher" — als Meldung unten rechts, nicht als Band über
 * der Seite.
 *
 * Warum kein Band mehr: das Band saß zwischen der Stempelleiste und dem Kopf
 * der Seite und schob beides nach unten, auf jeder Route, bis jemand es
 * wegklickte. Es kostete damit dauerhaft Platz an der Stelle, an der die Seite
 * ihre eigene Überschrift sagt — für eine Nachricht, die zwar wichtig ist, aber
 * keine ist, die man beim Ankommen als Erstes liest. Als Meldung steht sie
 * neben dem Inhalt statt vor ihm.
 *
 * Was gleich bleibt: sie geht nicht von selbst weg (`isAutoHide: false` — eine
 * Lohnzahl, die man verpassen kann, wäre keine Nachricht wert), sie muss
 * weggeklickt werden, und das Wegklicken hält nur für diese Browsersitzung.
 * Kommt ein Tag hinzu, ändert sich die Signatur und sie steht wieder da.
 *
 * Der Auftritt ist Astryx' eigener (`@starting-style`, `--duration-fast`,
 * `--ease-standard`) und damit keine dritte gestaltete Bewegung — er ist
 * dieselbe 0fr↔1fr-Faltung, die auch der Navigationseintrag und die Deckung
 * der Stempelleiste fahren.
 *
 * Der Ort ist `components/melde.tsx` — dasselbe Tor wie jede andere Meldung
 * im Haus. Der eigene, mehrzeilige Inhalt (die Tagesliste) bleibt bestehen
 * und wird als `body` durchgereicht; Ton, Fläche und die Voreinstellung
 * fürs Stehenbleiben kommen von dort.
 */
export function AttentionToast({issues, queue}: AttentionToastProps) {
  const pathname = usePathname();
  const melde = useMelde();

  // Signature of the current problem set: a new issue un-dismisses the notice.
  const signature = issues.map((i) => `${i.kind}:${i.date}`).join('|');

  // "Meine Zeit" states the same thing three times over already — the count in
  // its Kopf, a badge on every affected day row, a banner inside the open day.
  // A fourth copy is noise, so the standing notice is for the routes that
  // cannot say it themselves.
  const zeigen = issues.length > 0 && pathname !== '/';

  // Ein Wegräumen von uns (Routenwechsel, Abmelden) meldet Astryx als
  // `manual` — dieselbe Ursache wie ein Klick auf das Kreuz. Nur der Klick darf
  // die Meldung für die Sitzung verstummen lassen, also merkt sich dieser
  // Schalter, wer geschlossen hat.
  const vomBenutzer = useRef(true);

  useEffect(() => {
    if (!zeigen) return;
    if (sessionStorage.getItem(DISMISS_KEY) === signature) return;

    vomBenutzer.current = true;
    const schliessen = melde({
      ton: queue.length > 0 ? 'warnung' : 'hinweis',
      dauerhaft: true,
      uniqueID: TOAST_ID,
      body: <Meldungstext issues={issues} queue={queue} />,
      onHide: (grund) => {
        if (grund === 'manual' && vomBenutzer.current) {
          sessionStorage.setItem(DISMISS_KEY, signature);
        }
      },
    });

    return () => {
      vomBenutzer.current = false;
      schliessen();
    };
    // Abhängig von der Signatur, nicht von `issues`/`queue`: die beiden Felder
    // kommen bei jedem Seitenaufbau als neue Objekte vom Server, während der
    // Sachverhalt derselbe ist. An ihnen zu hängen hieße, die Meldung bei jeder
    // Navigation neu zu stellen.
  }, [zeigen, signature, melde]);

  return null;
}

/**
 * Der Text der Meldung. Er steht auf der umgekehrten Fläche der Meldung, also
 * auf dunkler Tinte: `MediaTheme` dreht dort `color-scheme`, und weil jede
 * Farbe dieses Themas ein `light-dark()`-Paar ist, findet Sekundärton,
 * Akzentton und Warnton von selbst seine helle Fassung. Nichts davon wird hier
 * von Hand gesetzt — die Paarungen stehen in tests/kontrast.test.ts.
 */
function Meldungstext({issues, queue}: AttentionToastProps) {
  const advisory = issues.filter((i) => !i.needsCorrection);
  const titel =
    queue.length === 1
      ? `Ein Tag benötigt deine Korrektur: ${fmtDate(queue[0]!)}`
      : queue.length > 1
        ? `${queue.length} Tage benötigen deine Korrektur`
        : `${advisory.length} ${advisory.length === 1 ? 'Hinweis' : 'Hinweise'} zur Arbeitszeit`;

  const gezeigt = issues.slice(0, HOECHSTENS);

  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="start" wrap="nowrap">
        <Sinnbild
          sinn="warnung"
          groesse="zeile"
          ton={queue.length > 0 ? 'warnung' : 'akzent'}
        />
        <Text type="label" weight="medium">
          {titel}
        </Text>
      </HStack>

      {/* Datum über der Meldung statt daneben: auf 400 px bricht die Zeile bei
          langen Meldungen ohnehin um, und dann steht ein Tag umgebrochen neben
          zwei anderen, die es nicht sind. Untereinander lesen sich alle drei
          gleich — und der Verweis bleibt ein eigener, ganzer Klickbereich. */}
      <VStack gap={1.5}>
        {gezeigt.map((issue) => (
          <VStack key={`${issue.kind}-${issue.date}`} gap={0}>
            <Link href={dayLink(issue.date)} style={{color: 'var(--color-text-accent)'}}>
              <HStack gap={1} vAlign="center" wrap="nowrap">
                <Sinnbild sinn="tag" groesse="zeile" />
                <Text type="supporting" color="inherit" weight="medium" hasTabularNumbers>
                  {fmtDate(issue.date)}
                </Text>
              </HStack>
            </Link>
            <Text type="supporting" color="secondary">
              {issue.message}
            </Text>
          </VStack>
        ))}
        {issues.length > gezeigt.length && (
          <Text type="supporting" color="secondary">
            … und {issues.length - gezeigt.length} weitere.
          </Text>
        )}
      </VStack>

      {/* Die Handlung steht unter dem Text und nicht im `endContent` der
          Meldung: dort läge sie neben einem mehrzeiligen Block und würde ihn
          auf die halbe Breite drücken. Im `endContent` bleibt nur das Kreuz —
          das, was die Meldung wegklickt. */}
      {queue.length > 0 && (
        <Link href={dayLink(queue[0]!)} style={{textDecoration: 'none'}}>
          <Button
            label="Jetzt korrigieren"
            variant="secondary"
            size="sm"
            icon={<Sinnbild sinn="bearbeiten" groesse="zeile" />}
            /* Dieselbe Notwehr wie bei der Schaltfläche im aufgeklappten
               Navigationseintrag: Astryx' getönte Füllung ist auf der Tinte
               weiß bei 10 % und erreicht damit keine 3:1 gegen ihren eigenen
               Grund. Die Kante trägt die Abgrenzung, nicht die Füllung —
               hier in Stein, weil Gold gearbeitete Zeit heißt. */
            style={{boxShadow: 'inset 0 0 0 1px var(--color-icon-secondary)'}}
          />
        </Link>
      )}
    </VStack>
  );
}
