'use client';

import {Button, HStack, StackItem, StatusDot, Text} from '@astryxdesign/core';
import {usePathname, useSearchParams} from 'next/navigation';
import {useEffect, useRef, useState, useTransition, type ReactNode} from 'react';
import {zeitAusUrl} from '@/lib/bereiche';
import {fmtDuration, fmtDurationSigned, fmtTime} from '@/lib/format';
import {useClock, type StampAction} from './clock-provider';
import {useKopfImBild} from './kopf-deckung';
import {useMelde} from './melde';
import {Sinnbild, type Sinn} from './sinnbilder';
import {Zahlwert} from './zahlwert';

/** Muss zu `--takt-bogen` in globals.css passen. */
const TAKT_BOGEN_MS = 620;

/**
 * Eine Tatsache der Leiste: Zeichen und Zahl gehören zusammen und dürfen beim
 * Umbruch auf dem Telefon nicht auseinanderfallen (`wrap="nowrap"`). Erst das
 * macht aus der Leiste eine Reihe abtastbarer Angaben statt eines Fließtexts.
 */
function Angabe({zeichen, children}: {zeichen: Sinn | ReactNode; children: ReactNode}) {
  return (
    <HStack gap={1} vAlign="center" wrap="nowrap">
      {typeof zeichen === 'string' ? <Sinnbild sinn={zeichen as Sinn} groesse="zeile" ton="sekundaer" /> : zeichen}
      {children}
    </HStack>
  );
}

/**
 * The persistent clock strip on every authenticated route: the stamp actions,
 * and — only where nothing else is saying them — today's live facts.
 *
 * Was hier *nicht* mehr steht, ist so wichtig wie was steht. „Nicht
 * eingestempelt" stand eine Handbreit neben einem Knopf mit der Aufschrift
 * „Einstempeln"; „Eingestempelt" neben „Ausstempeln". Der Zustand war nie die
 * fehlende Angabe — er ist an der Handlung ablesbar, die als Nächstes dran
 * ist. Was fehlte, war alles andere: seit wann, wie lange schon, wie lange
 * noch, und ob das Arbeitszeitgesetz gerade etwas dazu zu sagen hat.
 *
 * Und diese Angaben treten zurück, sobald die Seite sie selbst trägt (siehe
 * `kopf-deckung.tsx`): auf „Meine Zeit / Tag" steht die Zahl in Anzeigegröße im
 * Kopf, der Beginn auf der Bahn, der Feierabend als Marke auf der Achse. Die
 * Leiste räumt dann das Feld und ist nur noch das, was sie überall ist — die
 * Stelle zum Stempeln. Scrollt der Kopf aus dem Bild, kommen sie zurück.
 *
 * Die gesetzliche Warnung und ein Stempelfehler stehen nicht mehr in der
 * Leiste selbst, sondern als Meldung (`components/melde.tsx`) — dieselbe
 * Fläche wie jede andere Meldung im Haus, statt einer eigenen roten/orangen
 * Zeile hier. Die ArbZG-Lage feuert kantengetrieben: einmal je Übergang in
 * einen neuen Zustand (nähert sich / überschritten / Pausenpflicht), nicht
 * bei jedem Tick der Uhr, und bleibt stehen, solange der Zustand anhält
 * (dieselbe `uniqueID` ersetzt die Meldung an Ort und Stelle statt eine
 * zweite zu stapeln). Ein Fehler ist ohnehin ein einzelnes Ereignis und
 * bekommt jedes Mal eine eigene.
 */
export function ClockBar() {
  const clock = useClock();

  /**
   * Gedeckt ist eine Aussage aus zwei Teilen, und beide werden gebraucht:
   * *welche* Ansicht steht da (die URL weiß es, und zwar schon auf dem Server —
   * die Leiste kommt darum von Anfang an richtig heraus und blitzt beim
   * Hydrieren nicht auf), und steht ihr Kopf *noch im Bild* (das weiß nur der
   * Browser, siehe `kopf-deckung.tsx`). Nur die Tagesansicht auf heute spricht
   * heute aus; jeder andere Zeitraum trägt eine andere Zahl.
   */
  const pfad = usePathname();
  const suche = useSearchParams();
  const {ansicht, tag} = zeitAusUrl(
    {
      ansicht: suche.get('ansicht') ?? undefined,
      monat: suche.get('monat') ?? undefined,
      tag: suche.get('tag') ?? undefined,
    },
    clock.today,
  );
  const imBild = useKopfImBild();
  const gedeckt = pfad === '/' && ansicht === 'tag' && tag === clock.today && imBild;

  const melde = useMelde();
  const [isPending, startTransition] = useTransition();
  const [quittiert, setQuittiert] = useState(false);

  /**
   * Schwebt die Leiste? In Ruhe ist sie das oberste Stück des Kopfbands und
   * trägt dessen Goldwäsche ohne eigene Kante; erst wenn sie beim Rollen über
   * fremdem Inhalt steht, bekommt sie Haarstrich und Schatten zurück (siehe
   * `.stempel-leiste[data-schwebt]` in globals.css). Der Fühler ist ein
   * unsichtbares Element unmittelbar über der Leiste: verlässt es das Bild,
   * ist die Leiste festgeklebt. Dieselbe Technik wie in `kopf-deckung.tsx` —
   * kein Scroll-Horchen, keine Layout-Rechnung pro Frame.
   */
  const fuehler = useRef<HTMLSpanElement>(null);
  const [schwebt, setSchwebt] = useState(false);
  useEffect(() => {
    const ziel = fuehler.current;
    if (!ziel) return;
    const beobachter = new IntersectionObserver(([eintrag]) => {
      setSchwebt(!eintrag!.isIntersecting);
    });
    beobachter.observe(ziel);
    return () => beobachter.disconnect();
  }, []);

  const run = (action: StampAction) =>
    startTransition(async () => {
      const result = await clock.stamp(action);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
    });

  /**
   * Die Quittung: ein goldener Strich läuft einmal unter der Leiste durch, wenn
   * der Server eine Stempelung angenommen hat. Er hängt am Zähler der Uhr, nicht
   * am Klick auf diese Leiste — es wird auch aus dem aufgeklappten
   * Navigationseintrag heraus gestempelt, und beide Wege haben dieselbe Folge.
   *
   * Der Zähler startet bei 0, deshalb quittiert das erste Rendern nichts.
   */
  useEffect(() => {
    if (clock.stempelungen === 0) return;
    setQuittiert(true);
    const zeit = setTimeout(() => setQuittiert(false), TAKT_BOGEN_MS);
    return () => clearTimeout(zeit);
  }, [clock.stempelungen]);

  // Advisory only. The cap is named before it is crossed, and stated plainly
  // after — but nothing here stops the clock or refuses a record.
  const c = clock.compliance;
  const hint =
    clock.status === 'aus'
      ? null
      : c.capExceeded
        ? 'Über 10 Std. – Höchstarbeitszeit überschritten (§3 ArbZG)'
        : c.capApproaching
          ? 'Bald 10 Std. – das ist die Höchstarbeitszeit (§3 ArbZG)'
          : c.deficitMin > 0 && c.requiredMin > 0
            ? `Pause: noch ${c.deficitMin} Min. gesetzlich nötig`
            : c.dueSoon
              ? 'Ab 6 Std. Arbeit sind 30 Min. Pause Pflicht'
              : null;

  // Kantengetrieben: die Meldung steht neu, wenn sich der Text ändert (ein
  // neuer Zustand oder eine neue Minute im Countdown), und ersetzt sich dabei
  // an Ort und Stelle (`uniqueID`) statt sich zu stapeln. Wird die Lage
  // gegenstandslos, geht sie weg — dafür merkt sich dieser Verweis, wie man
  // sie schließt.
  const hinweisSchliessen = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (hint) {
      hinweisSchliessen.current = melde({
        ton: 'warnung',
        titel: hint,
        dauerhaft: true,
        uniqueID: 'stempelleiste-arbzg',
      });
    } else {
      hinweisSchliessen.current?.();
      hinweisSchliessen.current = null;
    }
  }, [hint, melde]);

  const laeuft = clock.status !== 'aus';
  const gearbeitet = clock.summary.workedMin;
  const rest = clock.sollMin - gearbeitet;

  return (
    <>
      <span ref={fuehler} className="stempel-fuehler" aria-hidden />
      <HStack
        className="stempel-leiste"
        data-quittung={quittiert ? 'true' : 'false'}
        data-schwebt={schwebt ? 'true' : 'false'}
        gap={3}
        vAlign="center"
        paddingInline={5}
        paddingBlock={2}
        wrap="wrap"
      >
        {/* Die gedeckten Angaben fahren nicht weg, sie werden schmal: das
            umschließende Raster geht von 1fr auf 0fr, der Inhalt schneidet an
            seiner eigenen Kante ab. Dieselbe Bewegung wie beim aufklappenden
            Navigationseintrag, nur in der anderen Achse — es ist keine dritte
            Bewegung, es ist dieselbe. `aria-hidden`, solange sie zu ist: was
            zugeschnitten ist, soll auch nicht vorgelesen werden, und die Seite
            sagt es in diesem Moment ohnehin selbst. */}
        <HStack className="stempel-angaben" data-gedeckt={gedeckt ? 'true' : 'false'} aria-hidden={gedeckt}>
          {/* `wrap="wrap"` gilt dem Telefon: dort faltet sich der Bereich in der
              Höhe zusammen, und drei Angaben passen nie in eine Zeile. Auf dem
              Schreibtisch überschreibt globals.css das wieder auf `nowrap` — dort
              läuft die Breite, und eine Reihe, die beim Schrumpfen umbricht,
              ließe die Leiste in der Höhe zucken. */}
          <HStack key={clock.status} className="stempel-stand" gap={3} vAlign="center" wrap="wrap">
            {/* Seit wann. Der Punkt ist hier das Zeichen der Angabe — er trägt
                den Zustand (ruhend, pulsend, akzent- oder warnfarben) und die
                Zeit daneben trägt die Aussage. Ein zweites Zeichen davor wäre
                eine zweite Stimme für dieselbe Sache. */}
            {laeuft && clock.since !== null && (
              <Angabe
                zeichen={
                  clock.status === 'arbeit' ? (
                    <StatusDot variant="accent" label="Eingestempelt" tooltip="Eingestempelt" isPulsing />
                  ) : (
                    <StatusDot variant="warning" label="In der Pause" tooltip="In der Pause" isPulsing />
                  )
                }
              >
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {clock.status === 'pause' && 'Pause '}
                  seit {clock.sinceYesterday ? 'gestern ' : ''}
                  {fmtTime(clock.since)}
                </Text>
              </Angabe>
            )}
            {/* No separator characters: the bar wraps to two or three rows on a
                phone, and a leading "·" at the start of a line reads as debris. */}
            {gearbeitet > 0 && (
              <Angabe zeichen="dauer">
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {/* Die einzige Zahl der Leiste, die von selbst weiterläuft — sie
                      rollt bei jeder neuen Minute herein, statt umzuspringen. */}
                  <Zahlwert wert={fmtDuration(gearbeitet)} /> Std. heute
                </Text>
              </Angabe>
            )}
            {/* Wie lange noch. Läuft die Uhr, ist das die Uhrzeit, zu der man
                gehen kann — das ist die Frage, die man sich wirklich stellt.
                Steht sie, ist es die Zeit, die zum Soll noch fehlt: die Zahl,
                nach der man entscheidet, ob man sich heute noch einmal
                einstempelt. Beides ist dieselbe Angabe in der Form, die im
                jeweiligen Zustand etwas nützt. */}
            {laeuft && clock.prognose && (
              <Angabe zeichen="feierabend">
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  Feierabend ca. {fmtTime(clock.prognose.atMin)}
                  {clock.prognose.outstandingBreakMin > 0 && (
                    <> (inkl. {clock.prognose.outstandingBreakMin} Min. Pause)</>
                  )}
                </Text>
              </Angabe>
            )}
            {!laeuft && clock.sollMin > 0 && (
              <Angabe zeichen={gearbeitet > 0 ? 'feierabend' : 'dauer'}>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {gearbeitet === 0 ? (
                    <>
                      Soll heute <Zahlwert wert={fmtDuration(clock.sollMin)} /> Std.
                    </>
                  ) : rest > 0 ? (
                    <>
                      noch <Zahlwert wert={fmtDuration(rest)} /> Std. bis zum Soll
                    </>
                  ) : rest < 0 ? (
                    <>
                      <Zahlwert wert={fmtDurationSigned(-rest)} /> Std. über Soll
                    </>
                  ) : (
                    'Soll erfüllt'
                  )}
                </Text>
              </Angabe>
            )}
          </HStack>
        </HStack>
        <StackItem size="fill" />
        {/* Die Zeichen der vier Stempelhandlungen: hinein, hinaus, Kaffee, zurück
            an die Arbeit. „Pause beenden" trägt bewusst dasselbe Zeichen wie
            Arbeit — es heißt genau das.

            Die Reihe hängt am Zustand: aus „Einstempeln" wird beim Klick nicht
            eine umbeschriftete Schaltfläche, sondern die Handlung, die jetzt dran
            ist — und sie steigt sichtbar an die Stelle der alten. Seit die Leiste
            den Zustand nicht mehr ausschreibt, ist diese Reihe die Stelle, an der
            er steht: was hier zu tun ist, sagt, wo man steht. */}
        <HStack key={clock.status} className="stempel-handlungen" gap={3} vAlign="center" wrap="nowrap">
          {clock.status === 'aus' && (
            <Button
              label="Einstempeln"
              variant="primary"
              isLoading={isPending}
              icon={<Sinnbild sinn="einstempeln" />}
              onClick={() => run('einstempeln')}
            />
          )}
          {clock.status === 'arbeit' && (
            <>
              <Button
                label="Pause starten"
                variant="secondary"
                isLoading={isPending}
                icon={<Sinnbild sinn="pause" />}
                onClick={() => run('pause')}
              />
              <Button
                label="Ausstempeln"
                variant="primary"
                isLoading={isPending}
                icon={<Sinnbild sinn="ausstempeln" />}
                onClick={() => run('ausstempeln')}
              />
            </>
          )}
          {clock.status === 'pause' && (
            <>
              <Button
                label="Ausstempeln"
                variant="secondary"
                isLoading={isPending}
                icon={<Sinnbild sinn="ausstempeln" />}
                onClick={() => run('ausstempeln')}
              />
              <Button
                label="Pause beenden"
                variant="primary"
                isLoading={isPending}
                icon={<Sinnbild sinn="arbeit" />}
                onClick={() => run('fortsetzen')}
              />
            </>
          )}
        </HStack>
      </HStack>
    </>
  );
}
