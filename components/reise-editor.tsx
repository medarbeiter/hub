'use client';

import {
  Banner,
  Button,
  DialogHeader,
  Divider,
  HStack,
  StackItem,
  Text,
  TextInput,
  TimeInput,
  VStack,
} from '@astryxdesign/core';
import {createISOTimeString} from '@astryxdesign/core/utils';
import {useActionState, useEffect, useRef, useState} from 'react';
import {reiseSaveAction, type ActionState} from '@/app/actions';
import {sicheresFormular} from '@/lib/aktion';
import {
  fmtDateLong,
  fmtDuration,
  fmtEuro,
  fmtTime,
  fmtWeekdayShort,
  isoToMin,
} from '@/lib/format';
import {berechneSpesen, pruefeSpanne, type SatzStufe} from '@/lib/pauschale';
import {DatumFeld} from './datum-feld';
import {Sinnbild, TAGART_SINN} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

const INITIAL: ActionState = {error: null};

export interface ReiseEntwurf {
  id: number;
  startDate: string;
  startMin: number;
  endDate: string;
  endMin: number;
  zweck: string;
  ziel: string | null;
}

interface ReiseEditorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userId: number;
  /** Bestehende Reise zum Korrigieren, sonst null. */
  reise: ReiseEntwurf | null;
  /** Vorbelegung für eine neue Reise, z. B. aus „Als Dienstreise abrechnen". */
  startDatum: string;
  /**
   * Die datierte Satztabelle. Bewusst die ganze Tabelle und nicht eine Stufe:
   * ändert sich der Abfahrtstag, muss der Vorschau-Betrag mitwechseln.
   */
  saetze: SatzStufe[];
  /** Erster Einstempel- und letzter Ausstempelzeitpunkt je Tag. */
  stempelZeiten: Record<string, {vonMin: number; bisMin: number}>;
}

/**
 * Der Editor, der die Handrechnung ersetzt: Abfahrt und Rückkehr genügen, alles
 * andere entsteht darunter, Tag für Tag mit der Regel, die ihn ergeben hat.
 *
 * Die Stempelzeiten werden angeboten, nie übernommen: die Abwesenheit beginnt
 * an der Wohnung und nicht am Arbeitsplatz, also entscheidet ein Mensch.
 */
export function ReiseEditor(props: ReiseEditorProps) {
  const [state, formAction, isSaving] = useActionState(sicheresFormular(reiseSaveAction), INITIAL);
  const lastState = useRef(state);

  const [startDate, setStartDate] = useState(props.startDatum);
  const [endDate, setEndDate] = useState(props.startDatum);
  const [start, setStart] = useState('');
  const [ende, setEnde] = useState('');
  const [zweck, setZweck] = useState('');
  const [ziel, setZiel] = useState('');

  // Re-sync when a different trip (or a fresh one) is opened.
  useEffect(() => {
    if (!props.isOpen) return;
    const r = props.reise;
    setStartDate(r ? r.startDate : props.startDatum);
    setEndDate(r ? r.endDate : props.startDatum);
    setStart(r ? fmtTime(r.startMin) : '');
    setEnde(r ? fmtTime(r.endMin) : '');
    setZweck(r?.zweck ?? '');
    setZiel(r?.ziel ?? '');
  }, [props.reise, props.startDatum, props.isOpen]);

  // Close after a successful save.
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null && props.isOpen) props.onOpenChange(false);
    }
  }, [state, props]);

  const startMin = isoToMin(start);
  const endMin = isoToMin(ende);

  const spanne =
    startMin !== null && endMin !== null && startDate !== '' && endDate !== ''
      ? {startDate, startMin, endDate, endMin}
      : null;
  const spannenFehler = spanne ? pruefeSpanne(spanne) : null;
  const rechnung = spanne && !spannenFehler ? berechneSpesen(spanne, props.saetze) : null;

  const stempel = props.stempelZeiten[startDate];
  const uebernehmen = () => {
    if (!stempel) return;
    setStart(fmtTime(stempel.vonMin));
    if (endDate === startDate) setEnde(fmtTime(stempel.bisMin));
  };

  return (
    <TafelDialog isOpen={props.isOpen} onOpenChange={props.onOpenChange} purpose="form" width={560}>
      <DialogHeader
        title={props.reise ? 'Reise bearbeiten' : 'Reise erfassen'}
        subtitle="Abfahrt und Rückkehr genügen – die Pauschale rechnet sich daraus."
      />
      {/* Wächst um eine Zeile je Reisetag; die Klasse gehört an das Element,
          das im Dialog neben dem Kopf steht — siehe .tafel-rumpf in globals.css. */}
      <form action={formAction} className="tafel-rumpf">
        <VStack gap={4} padding={4}>
          {state.error && <Banner status="error" title={state.error} />}

          <TextInput
            label="Anlass der Reise"
            value={zweck}
            onChange={setZweck}
            placeholder="z. B. Fotoshooting Klinik Nord"
            htmlName="zweck"
          />
          <TextInput
            label="Reiseziel"
            value={ziel}
            onChange={setZiel}
            placeholder="z. B. Hamburg"
            htmlName="ziel"
          />

          <VStack gap={1.5}>
            <HStack gap={3} vAlign="start">
              <StackItem size="fill">
                <DatumFeld
                  label="Abfahrt am"
                  value={startDate}
                  onChange={(neu) => {
                    setStartDate(neu);
                    if (endDate < neu) setEndDate(neu);
                  }}
                  placeholder="Datum wählen"
                  width="100%"
                />
              </StackItem>
              {/* 168 statt 130: bei 130 blieben dem Textfeld nach Zeichen und
                  Innenabstand 88 px, der Platzhalter „Uhrzeit wählen" braucht
                  93 — er stand hart abgeschnitten als „Uhrzeit wähle". */}
              <TimeInput
                label="um"
                hourFormat="24h"
                value={start ? (createISOTimeString(start) ?? undefined) : undefined}
                onChange={(v) => setStart(v ?? '')}
                width={168}
              />
            </HStack>

            <HStack gap={3} vAlign="start">
              <StackItem size="fill">
                <DatumFeld
                  label="Rückkehr am"
                  value={endDate}
                  onChange={setEndDate}
                  min={startDate}
                  placeholder="Datum wählen"
                  width="100%"
                />
              </StackItem>
              <TimeInput
                label="um"
                hourFormat="24h"
                value={ende ? (createISOTimeString(ende) ?? undefined) : undefined}
                onChange={(v) => setEnde(v ?? '')}
                width={168}
              />
            </HStack>

            {stempel && (
              <HStack justify="start">
                {/* Als Ghost las sich die Zeile wie eine Bildunterschrift:
                    „Aus Stempelzeiten: 07:58 – 17:00" sah aus wie ein Hinweis
                    auf etwas, das man nun abtippen soll — obwohl ein Klick
                    genügt. Der Umriss macht daraus wieder eine Handlung, und
                    das Verb steht jetzt vorn. */}
                <Button
                  label={`Stempelzeiten übernehmen (${fmtTime(stempel.vonMin)} – ${fmtTime(stempel.bisMin)})`}
                  variant="secondary"
                  size="sm"
                  icon={<Sinnbild sinn="uhrzeit" />}
                  onClick={uebernehmen}
                />
              </HStack>
            )}
          </VStack>

          {/* Die Rechnung, während getippt wird. Genau das ist die Arbeit, die
              bisher von Hand gemacht wurde. */}
          <VStack gap={2}>
            <Divider />
            {spannenFehler ? (
              <HStack gap={1.5} vAlign="center">
                <Sinnbild sinn="fehler" groesse="zeile" ton="fehler" />
                <Text type="supporting" color="inherit">
                  <span style={{color: 'var(--color-error)'}}>{spannenFehler}</span>
                </Text>
              </HStack>
            ) : rechnung ? (
              <VStack gap={1}>
                {rechnung.tage.map((tag) => (
                  <HStack key={tag.datum} gap={3} vAlign="center" justify="between">
                    <span style={{inlineSize: 92, flexShrink: 0}}>
                      <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                        {fmtWeekdayShort(tag.datum)} {Number(tag.datum.slice(8))}.
                      </Text>
                    </span>
                    <StackItem size="fill">
                      <HStack gap={1.5} vAlign="center" wrap="nowrap">
                        <Sinnbild sinn={TAGART_SINN[tag.art]} groesse="zeile" ton="sekundaer" />
                        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                          {fmtDuration(tag.abwesenheitMin)} Std. · {tag.grund}
                        </Text>
                      </HStack>
                    </StackItem>
                    <Text type="body" size="sm" hasTabularNumbers>
                      {fmtEuro(tag.satzCent)}
                    </Text>
                  </HStack>
                ))}
                <Divider />
                <HStack justify="between" gap={3} vAlign="center">
                  <HStack gap={1.5} vAlign="center">
                    <Sinnbild sinn="verpflegung" ton="sekundaer" />
                    <Text type="body" weight="semibold" hasTabularNumbers>
                      Verpflegungspauschale · {fmtDuration(rechnung.abwesenheitMin)} Std. abwesend
                    </Text>
                  </HStack>
                  <Text type="body" weight="semibold" hasTabularNumbers>
                    {fmtEuro(rechnung.pauschaleCent)}
                  </Text>
                </HStack>
                <Text type="supporting" size="sm" color="secondary">
                  Sätze ab {fmtDateLong(rechnung.stufe.ab)}: {fmtEuro(rechnung.stufe.halbCent)} halber Tag,{' '}
                  {fmtEuro(rechnung.stufe.vollCent)} voller Tag. Belege wie Übernachtung oder Parken
                  kommen nach dem Speichern dazu.
                </Text>
              </VStack>
            ) : (
              <HStack gap={3} vAlign="center" paddingBlock={2} wrap="nowrap">
                <Sinnbild sinn="herleitung" groesse="leer" ton="sekundaer" />
                <Text type="supporting" color="secondary">
                  Sobald Abfahrt und Rückkehr stehen, erscheint hier die Abrechnung Tag für Tag.
                </Text>
              </HStack>
            )}
          </VStack>

          <input type="hidden" name="reiseId" value={props.reise?.id ?? ''} />
          <input type="hidden" name="userId" value={props.userId} />
          <input type="hidden" name="startDate" value={startDate} />
          <input type="hidden" name="endDate" value={endDate} />
          <input type="hidden" name="startTime" value={start} />
          <input type="hidden" name="endTime" value={ende} />

          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => props.onOpenChange(false)} />
            <Button
              label="Speichern"
              variant="primary"
              type="submit"
              isLoading={isSaving}
              isDisabled={rechnung === null || zweck.trim() === ''}
            />
          </HStack>
        </VStack>
      </form>
    </TafelDialog>
  );
}
