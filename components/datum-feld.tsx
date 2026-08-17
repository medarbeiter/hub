'use client';

import {HStack, IconButton, StackItem, Text, TextInput, VStack} from '@astryxdesign/core';
import {Popover} from '@astryxdesign/core/Popover';
import {useEffect, useMemo, useState} from 'react';
import {
  addMonths,
  fmtDate,
  fmtDateLong,
  fmtMonth,
  monthOf,
  parseDatumEingabe,
  todayISO,
} from '@/lib/format';
import {WOCHENENDE, kalendergitter} from '@/lib/kalendergitter';
import {Monatsgitter} from './monatsgitter';
import {Sinnbild} from './sinnbilder';

/**
 * Das Datumsfeld dieses Hauses — Textfeld plus **das** Monatsgitter.
 *
 * Es steht hier, weil Astryx' `DateInput` einen Kalender aufklappt, dessen
 * Woche am **Sonntag** beginnt: `Calendar` nimmt `weekStartsOn` (0 = So) als
 * Eigenschaft entgegen, `DateInput` reicht sie aber nicht durch — es rendert
 * `<Calendar mode="single" … />` ohne diese Zeile (siehe
 * `node_modules/@astryxdesign/core/src/DateInput/DateInput.tsx`). Von außen
 * war der Wochenanfang damit nicht erreichbar: keine Prop, kein Kontext, und
 * die Spaltenköpfe („Su Mo Tu…") kommen aus einer festen englischen Liste in
 * `useCalendarDays`, nicht aus `Intl` — `lib/intl-de.ts` konnte sie deshalb
 * auch nicht eindeutschen.
 *
 * Drei Auswege wurden verworfen:
 *
 *   1. `astryx swizzle Calendar` — kopiert 1100 Zeilen fremden Code samt
 *      StyleX-Innereien in dieses Verzeichnis, die bei jedem `astryx upgrade`
 *      von Hand nachzuziehen wären, und zwar für **eine** Zahl.
 *   2. Die Spalten per CSS umsortieren — der Wochenanfang ist Rechnung, nicht
 *      Anordnung: verschoben würden die Köpfe, nicht die Tage darunter.
 *   3. `patch-package` o. ä. am `node_modules`-Baum — ein stiller Eingriff,
 *      den ein frisches `bun install` in einem anderen Arbeitsverzeichnis
 *      wortlos verliert.
 *
 * Der Umweg ist stattdessen der kürzeste, den dieses Haus überhaupt gehen
 * kann: Die Anwendung **hat** bereits genau ein Monatsgitter, das an der
 * Wochengrenze faltet (`components/monatsgitter.tsx` über
 * `lib/kalendergitter.ts`), es beginnt seit jeher am Montag, es trägt die
 * Kalenderwoche, den deutschen Wochentag und die Ruhetagsstruktur. Der
 * Datumswähler bekommt keinen zweiten Kalender — er bekommt denselben, in
 * seiner kompakten Auflösung. Damit sieht ein Datumsfeld aus wie der
 * Abwesenheitsmonat daneben, statt wie ein Gast aus einer anderen Anwendung.
 *
 * Getippt werden darf weiterhin: „4.8.", „04.08.2026", „4/8" — das liest
 * `parseDatumEingabe` in `lib/format.ts`. Was nicht als Tag lesbar ist, ändert
 * nichts; das Feld fällt beim Verlassen auf den geltenden Wert zurück, statt
 * still auf einen erfundenen zu springen.
 */
interface DatumFeldProps {
  label: string;
  /** Der geltende Tag als ISO-Datum. Dieses Feld kennt keinen leeren Zustand. */
  value: string;
  onChange: (datum: string) => void;
  /** Frühester bzw. spätester wählbarer Tag, jeweils einschließlich. */
  min?: string;
  max?: string;
  placeholder?: string;
  description?: string;
  isDisabled?: boolean;
  width?: number | string;
}

export function DatumFeld({
  label,
  value,
  onChange,
  min,
  max,
  placeholder,
  description,
  isDisabled,
  width,
}: DatumFeldProps) {
  const [offen, setOffen] = useState(false);
  /** Der Tippzustand. `null` heißt: das Feld zeigt den geltenden Wert an. */
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const [monat, setMonat] = useState(() => monthOf(value));

  // Heute erst im Browser: auf dem Server ist es der Tag der Maschine, und die
  // beiden auseinanderlaufen zu lassen wäre ein Hydrationsfehler an jedem
  // Datumsfeld der Anwendung.
  const [heute, setHeute] = useState<string | null>(null);
  useEffect(() => setHeute(todayISO()), []);

  // Wer das Gitter öffnet, will den geltenden Monat sehen — auch wenn er beim
  // letzten Mal woanders geblättert hat.
  useEffect(() => {
    if (offen) setMonat(monthOf(value));
  }, [offen, value]);

  const gitter = useMemo(() => kalendergitter(monat), [monat]);
  // Nur Wochenenden: welche Feiertage gelten, weiß das Bundesland, und das
  // hängt am Datensatz der Person — ein allgemeines Datumsfeld darf das nicht
  // erfinden. Die Ruhetagsstruktur bleibt trotzdem sichtbar.
  const ruhetage = useMemo(
    () =>
      new Set(
        gitter.wochen.flatMap((w) => w.tage.filter((t) => WOCHENENDE.has(t.spalte)).map((t) => t.datum)),
      ),
    [gitter],
  );

  const ausserhalb = (datum: string) =>
    (min !== undefined && datum < min) || (max !== undefined && datum > max);

  /** Den Tippzustand auflösen: lesbar und erlaubt heißt übernehmen, sonst zurück. */
  const uebernehmen = () => {
    if (entwurf === null) return;
    const gelesen = parseDatumEingabe(entwurf, value);
    if (gelesen && !ausserhalb(gelesen)) onChange(gelesen);
    setEntwurf(null);
  };

  const waehlen = (datum: string) => {
    if (ausserhalb(datum)) return;
    onChange(datum);
    setEntwurf(null);
    setOffen(false);
  };

  return (
    <HStack gap={1} vAlign="end" width={width}>
      <StackItem size="fill">
        <TextInput
          label={label}
          description={description}
          value={entwurf ?? fmtDateLong(value)}
          onChange={setEntwurf}
          onFocus={() => setEntwurf(fmtDate(value))}
          onBlur={uebernehmen}
          onEnter={uebernehmen}
          placeholder={placeholder}
          isDisabled={isDisabled}
          width="100%"
        />
      </StackItem>
      <Popover
        isOpen={offen}
        onOpenChange={setOffen}
        placement="below"
        alignment="end"
        label={`${label} im Kalender wählen`}
        width={320}
        content={
          offen ? (
            <VStack gap={2}>
              {/* Das Schrittwerk des Wählers. Bewusst nicht `MonatLeiste`: die
                  ist der Navigator der *Seite* und darf nie über den laufenden
                  Monat hinaus — ein Datum in der Zukunft zu wählen muss aber
                  genau das können. */}
              <HStack justify="between" vAlign="center" gap={2}>
                <IconButton
                  label="Vorheriger Monat"
                  size="sm"
                  variant="ghost"
                  icon={<Sinnbild sinn="zurueck" />}
                  onClick={() => setMonat(addMonths(monat, -1))}
                />
                <Text type="label" weight="semibold" hasTabularNumbers>
                  {fmtMonth(monat)}
                </Text>
                <IconButton
                  label="Nächster Monat"
                  size="sm"
                  variant="ghost"
                  icon={<Sinnbild sinn="weiter" />}
                  onClick={() => setMonat(addMonths(monat, 1))}
                />
              </HStack>
              <Monatsgitter
                kompakt
                gitter={gitter}
                ruhetage={ruhetage}
                heute={heute}
                aktiverTag={value}
                gesperrt={ausserhalb}
                zelle={() => ({})}
                onTag={waehlen}
              />
            </VStack>
          ) : null
        }
      >
        <IconButton
          label="Kalender öffnen"
          tooltip="Kalender"
          size="md"
          icon={<Sinnbild sinn="monat" />}
          isDisabled={isDisabled}
        />
      </Popover>
    </HStack>
  );
}
