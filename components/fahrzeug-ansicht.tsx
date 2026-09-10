'use client';

import {
  Badge,
  Banner,
  Button,
  Card,
  DialogHeader,
  Divider,
  Heading,
  HStack,
  StackItem,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition, type ReactNode} from 'react';
import {
  fahrzeugBelegAddAction,
  fahrzeugBelegDeleteAction,
  fahrzeugFallAbrechnenAction,
  fahrzeugFallDeleteAction,
  fahrzeugFallSaveAction,
  fahrzeugFallSchliessenAction,
  fahrzeugFallWiedereroeffnenAction,
  type ActionState,
} from '@/app/actions';
import {sicher, sicheresFormular} from '@/lib/aktion';
import type {PersonAngabe} from '@/lib/avatar';
import type {FahrzeugBelegArt, FahrzeugFallStatus} from '@/lib/db';
import {fmtDate, fmtDateRange, fmtEuro} from '@/lib/format';
import {Ausklapp} from './ausklapp';
import {BelegDialog, type BelegArtWahl} from './beleg-felder';
import {DatumFeld} from './datum-feld';
import {useMelde} from './melde';
import {PersonZeichen} from './person-zeichen';
import {Aufklapppfeil, Sinnbild, type Sinn} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';
import {ZeitRahmen} from './zeit-rahmen';

/** Ein Fall, fertig für den Browser — keine Rechte, nur was daraus folgt. */
export interface FallAnsicht {
  id: number;
  titel: string;
  kennzeichen: string | null;
  von: string;
  bis: string | null;
  status: FahrzeugFallStatus;
  statusLabel: string;
  summeCent: number;
  belege: Array<{
    id: number;
    art: FahrzeugBelegArt;
    artLabel: string;
    datum: string;
    betragCent: number;
    beschreibung: string | null;
    hatDatei: boolean;
  }>;
  /** Nur in der Abrechnungsliste gesetzt. */
  person: PersonAngabe | null;
  /** Offen und eigener Fall (oder Prüfrecht): Belege, Titel, Schließen. */
  darfBearbeiten: boolean;
  /** Geschlossen und Prüfrecht. */
  darfAbrechnen: boolean;
}

export const FALL_STATUS_SINN: Record<FahrzeugFallStatus, Sinn> = {
  offen: 'bearbeiten',
  geschlossen: 'abschluss',
  abgerechnet: 'abrechnen',
};

const STATUS_VARIANT: Record<FahrzeugFallStatus, 'neutral' | 'info' | 'success'> = {
  offen: 'info',
  geschlossen: 'neutral',
  abgerechnet: 'success',
};

const BELEG_ARTEN: BelegArtWahl[] = [
  {value: 'tanken', label: 'Tanken', sinn: 'tanken'},
  {value: 'laden', label: 'Laden', sinn: 'laden'},
  {value: 'service', label: 'Service', sinn: 'service'},
];

const SPALTE_ZEITRAUM = 148;
const SPALTE_SUMME = 88;
const SPALTE_STATUS = 120;

interface FahrzeugAnsichtProps {
  userId: number;
  faelle: FallAnsicht[];
  heute: string;
  /** `eigen`: meine Fälle. `abrechnung`: die geschlossenen Fälle aller, zum Übernehmen. */
  modus: 'eigen' | 'abrechnung';
  /** Aus der Seitenleiste: den Fall-Dialog gleich öffnen. */
  neu?: boolean;
  nav?: ReactNode;
  figur: string;
  figurEinheit: string;
  stand: string;
}

/**
 * Das privat genutzte Dienstfahrzeug im selben Rahmen wie Reisen & Spesen:
 * ein Fall je Zeile, aufgeklappt seine Belege. Keine Bühne — ein Fall hat
 * keine Zeitform, er sammelt.
 */
export function FahrzeugAnsicht(props: FahrzeugAnsichtProps) {
  const [editorOffen, setEditorOffen] = useState(props.neu === true);
  const [bearbeitet, setBearbeitet] = useState<FallAnsicht | null>(null);
  const [offen, setOffen] = useState<number | null>(null);

  const neu = () => {
    setBearbeitet(null);
    setEditorOffen(true);
  };

  return (
    <>
      <ZeitRahmen
        titel={props.modus === 'eigen' ? 'Dienstfahrzeug' : 'Fahrzeugbelege abrechnen'}
        sinn={props.modus === 'eigen' ? 'fahrzeug' : 'abrechnen'}
        figur={props.figur}
        figurEinheit={props.figurEinheit}
        stand={props.stand}
        nav={props.nav}
        werkzeuge={
          props.modus === 'eigen' ? (
            <Button
              label="Fall anlegen"
              variant={props.faelle.some((f) => f.status === 'offen') ? 'secondary' : 'primary'}
              size="sm"
              icon={<Sinnbild sinn="hinzufuegen" />}
              onClick={neu}
            />
          ) : null
        }
        belege={
          <FallStapel
            faelle={props.faelle}
            heute={props.heute}
            offenId={offen}
            onOffen={setOffen}
            onBearbeiten={(fall) => {
              setBearbeitet(fall);
              setEditorOffen(true);
            }}
            leer={
              props.modus === 'eigen'
                ? 'Noch kein Fall angelegt. Lege einen an – etwa „Tanken September“ oder „Inspektion“ – und sammle darin die Belege, bis du ihn schließt.'
                : 'Nichts in dieser Auswahl.'
            }
          />
        }
        kontext={
          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                <Heading level={3}>So läuft ein Fall</Heading>
              </HStack>
              <Text type="supporting" color="secondary">
                Ein Fall sammelt Belege über einen Zeitraum: Tank- und Ladebelege eines Monats, oder
                die Rechnungen eines Servicefalls. Solange er offen ist, kommen Belege dazu – am
                besten sofort als Foto.
              </Text>
              <Text type="supporting" color="secondary">
                Schließen heißt: fertig gesammelt. Die Verwaltung übernimmt den geschlossenen Fall in
                die Abrechnung; bis dahin lässt er sich wieder öffnen.
              </Text>
            </VStack>
          </Card>
        }
      />

      {editorOffen && (
        <FallEditor
          isOpen={editorOffen}
          onOpenChange={setEditorOffen}
          userId={props.userId}
          fall={bearbeitet}
          heute={props.heute}
        />
      )}
    </>
  );
}

function FallStapel({
  faelle,
  heute,
  offenId,
  onOffen,
  onBearbeiten,
  leer,
}: {
  faelle: FallAnsicht[];
  heute: string;
  offenId: number | null;
  onOffen: (id: number | null) => void;
  onBearbeiten: (fall: FallAnsicht) => void;
  leer: string;
}) {
  if (faelle.length === 0) {
    return (
      <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="fahrzeug" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          {leer}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack gap={0}>
      <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2} className="spannen-achse">
        <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
          <Text type="label" size="sm" color="secondary">
            Zeitraum
          </Text>
        </span>
        <StackItem size="fill">
          <Text type="label" size="sm" color="secondary">
            Fall
          </Text>
        </StackItem>
        <span style={{inlineSize: SPALTE_SUMME, flexShrink: 0}} />
        <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}} />
        <span style={{inlineSize: 16, flexShrink: 0}} />
      </HStack>
      <Divider />

      <VStack as="ol" gap={0} className="bahn-stapel">
        {faelle.map((fall) => {
          const istOffen = offenId === fall.id;
          return (
            <VStack as="li" key={fall.id} gap={0} className="bahn-reihe">
              <button
                type="button"
                className="eintrag-zeile zeile-interaktiv"
                aria-expanded={istOffen}
                onClick={() => onOffen(istOffen ? null : fall.id)}
                style={{
                  background: istOffen ? 'var(--color-accent-muted)' : undefined,
                  borderRadius: 'var(--radius-inner)',
                }}
              >
                <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2} className="spannen-zeile">
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}}>
                    <Text type="label" size="sm" color="secondary" hasTabularNumbers>
                      {fall.bis ? fmtDateRange(fall.von, fall.bis) : `seit ${fmtDate(fall.von)}`}
                    </Text>
                  </span>
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      {fall.person && <PersonZeichen person={fall.person} groesse="zeile" mitName />}
                      <Text type="body" size="sm">
                        {fall.titel}
                      </Text>
                      {fall.kennzeichen && (
                        <Text type="supporting" size="sm" color="secondary">
                          {fall.kennzeichen}
                        </Text>
                      )}
                      <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                        {fall.belege.length} {fall.belege.length === 1 ? 'Beleg' : 'Belege'}
                      </Text>
                    </HStack>
                  </StackItem>
                  <HStack gap={1} vAlign="center" justify="end" wrap="nowrap" width={SPALTE_SUMME}>
                    <Text type="body" size="sm" hasTabularNumbers>
                      {fmtEuro(fall.summeCent)}
                    </Text>
                  </HStack>
                  <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
                    <Badge
                      variant={STATUS_VARIANT[fall.status]}
                      label={fall.statusLabel}
                      icon={<Sinnbild sinn={FALL_STATUS_SINN[fall.status]} groesse="zeile" />}
                    />
                  </span>
                  <Aufklapppfeil offen={istOffen} />
                </HStack>
              </button>

              <Ausklapp offen={istOffen}>
                <HStack gap={3} paddingInline={2} paddingBlock={3} align="start">
                  <span style={{inlineSize: SPALTE_ZEITRAUM, flexShrink: 0}} />
                  <StackItem size="fill">
                    <FallTafel fall={fall} heute={heute} onBearbeiten={onBearbeiten} />
                  </StackItem>
                </HStack>
              </Ausklapp>
              <Divider />
            </VStack>
          );
        })}
      </VStack>
    </VStack>
  );
}

function FallTafel({
  fall,
  heute,
  onBearbeiten,
}: {
  fall: FallAnsicht;
  heute: string;
  onBearbeiten: (fall: FallAnsicht) => void;
}) {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, start] = useTransition();
  const [belegOffen, setBelegOffen] = useState(false);
  const [loeschen, setLoeschen] = useState(false);

  const lauf = (fn: () => Promise<{error: string | null}>) =>
    start(async () => {
      const {error} = await sicher(fn)();
      if (error) melde({ton: 'fehler', titel: error, dauerhaft: true});
      else setLoeschen(false);
      router.refresh();
    });

  return (
    <VStack gap={4}>
      <VStack gap={2}>
        <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
          <HStack gap={1.5} vAlign="center">
            <Sinnbild sinn="beleg" groesse="zeile" ton="sekundaer" />
            <Text type="label" color="secondary">
              Belege
            </Text>
          </HStack>
          {fall.darfBearbeiten && (
            <Button
              label="Beleg hinzufügen"
              variant="primary"
              size="sm"
              icon={<Sinnbild sinn="hinzufuegen" />}
              onClick={() => setBelegOffen(true)}
            />
          )}
        </HStack>

        {fall.belege.length === 0 ? (
          <HStack gap={3} vAlign="start" paddingBlock={2} wrap="nowrap">
            <Sinnbild sinn="tanken" groesse="leer" ton="sekundaer" />
            <Text type="supporting" color="secondary">
              Noch kein Beleg. Tanken, Laden oder Service – am besten gleich als Foto.
            </Text>
          </HStack>
        ) : (
          <VStack gap={0} role="list">
            <Divider />
            {fall.belege.map((beleg) => (
              <VStack key={beleg.id} gap={0} role="listitem">
                <HStack gap={3} vAlign="center" paddingBlock={2} wrap="wrap">
                  <span style={{inlineSize: 96, flexShrink: 0}}>
                    <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                      {fmtDate(beleg.datum)}
                    </Text>
                  </span>
                  <span style={{inlineSize: 116, flexShrink: 0}}>
                    <HStack gap={1.5} vAlign="center">
                      <Sinnbild sinn={beleg.art} groesse="zeile" ton="sekundaer" />
                      <Text type="body" size="sm">
                        {beleg.artLabel}
                      </Text>
                    </HStack>
                  </span>
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      <Text type="supporting" size="sm" color="secondary">
                        {beleg.beschreibung ?? '—'}
                      </Text>
                      {beleg.hatDatei && (
                        <Link href={`/api/fahrzeug-beleg/${beleg.id}`} target="_blank" style={{textDecoration: 'none'}}>
                          <HStack gap={1} vAlign="center">
                            <Sinnbild sinn="datei" groesse="zeile" ton="akzent" />
                            <Text type="supporting" size="sm" color="accent">
                              Beleg öffnen
                            </Text>
                          </HStack>
                        </Link>
                      )}
                    </HStack>
                  </StackItem>
                  <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
                    <Text type="body" size="sm" hasTabularNumbers>
                      {fmtEuro(beleg.betragCent)}
                    </Text>
                  </span>
                  {fall.darfBearbeiten && (
                    <Button
                      label="Entfernen"
                      variant="ghost"
                      size="sm"
                      isLoading={isPending}
                      onClick={() => lauf(() => fahrzeugBelegDeleteAction(beleg.id))}
                    />
                  )}
                </HStack>
                <Divider />
              </VStack>
            ))}
            <HStack justify="between" gap={3} paddingBlock={2}>
              <Text type="body" weight="semibold">
                Summe
              </Text>
              <Text type="body" weight="semibold" hasTabularNumbers>
                {fmtEuro(fall.summeCent)}
              </Text>
            </HStack>
          </VStack>
        )}
      </VStack>

      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
        <HStack gap={2} vAlign="center" wrap="wrap">
          {fall.darfBearbeiten && (
            <Button
              label="Bearbeiten"
              variant="ghost"
              size="sm"
              icon={<Sinnbild sinn="bearbeiten" />}
              onClick={() => onBearbeiten(fall)}
            />
          )}
          {(fall.darfBearbeiten || fall.darfAbrechnen) &&
            (loeschen ? (
              <HStack gap={2} vAlign="center">
                <Text type="supporting">Wirklich löschen – samt Belegen?</Text>
                <Button
                  label="Löschen"
                  variant="destructive"
                  size="sm"
                  isLoading={isPending}
                  icon={<Sinnbild sinn="entfernen" />}
                  onClick={() => lauf(() => fahrzeugFallDeleteAction(fall.id))}
                />
                <Button label="Abbrechen" variant="ghost" size="sm" onClick={() => setLoeschen(false)} />
              </HStack>
            ) : (
              <Button
                label="Fall löschen"
                variant="ghost"
                size="sm"
                style={{color: 'var(--color-error)'}}
                icon={<Sinnbild sinn="entfernen" />}
                onClick={() => setLoeschen(true)}
              />
            ))}
        </HStack>
        <HStack gap={2} vAlign="center" wrap="wrap">
          {fall.status === 'offen' && fall.darfBearbeiten && (
            <Button
              label="Fall schließen"
              variant="secondary"
              size="sm"
              isLoading={isPending}
              icon={<Sinnbild sinn="abschluss" />}
              onClick={() => lauf(() => fahrzeugFallSchliessenAction(fall.id))}
            />
          )}
          {fall.status === 'geschlossen' && (fall.darfBearbeiten || fall.darfAbrechnen) && (
            <Button
              label="Wieder öffnen"
              variant="ghost"
              size="sm"
              isLoading={isPending}
              icon={<Sinnbild sinn="zurueckziehen" />}
              onClick={() => lauf(() => fahrzeugFallWiedereroeffnenAction(fall.id))}
            />
          )}
          {fall.darfAbrechnen && (
            <Button
              label="In die Abrechnung übernehmen"
              variant="primary"
              size="sm"
              isLoading={isPending}
              icon={<Sinnbild sinn="abrechnen" />}
              onClick={() => lauf(() => fahrzeugFallAbrechnenAction(fall.id))}
            />
          )}
          {fall.status === 'abgerechnet' && (
            <Text type="supporting" size="sm" color="secondary">
              In die Abrechnung übernommen.
            </Text>
          )}
        </HStack>
      </HStack>

      {belegOffen && (
        <BelegDialog
          isOpen={belegOffen}
          onOpenChange={setBelegOffen}
          vonISO={fall.von}
          bisISO={heute}
          arten={BELEG_ARTEN}
          action={fahrzeugBelegAddAction}
          felder={{fallId: String(fall.id)}}
          untertitel={fall.titel}
        />
      )}
    </VStack>
  );
}

const INITIAL: ActionState = {error: null};

function FallEditor(props: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userId: number;
  fall: FallAnsicht | null;
  heute: string;
}) {
  const [state, formAction, isSaving] = useActionState(sicheresFormular(fahrzeugFallSaveAction), INITIAL);
  const lastState = useRef(state);
  const [titel, setTitel] = useState(props.fall?.titel ?? '');
  const [kennzeichen, setKennzeichen] = useState(props.fall?.kennzeichen ?? '');
  const [von, setVon] = useState(props.fall?.von ?? props.heute);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null && props.isOpen) props.onOpenChange(false);
    }
  }, [state, props]);

  return (
    <TafelDialog isOpen={props.isOpen} onOpenChange={props.onOpenChange} purpose="form" width={440}>
      <DialogHeader
        title={props.fall ? 'Fall bearbeiten' : 'Fall anlegen'}
        subtitle="Ein Fall sammelt Belege, bis du ihn schließt."
      />
      <form action={formAction} className="tafel-rumpf">
        <input type="hidden" name="fallId" value={props.fall?.id ?? 0} />
        <input type="hidden" name="userId" value={props.userId} />
        <input type="hidden" name="von" value={von} />
        <input type="hidden" name="titel" value={titel} />
        <input type="hidden" name="kennzeichen" value={kennzeichen} />
        <VStack gap={4} padding={4}>
          {state.error && <Banner status="error" title={state.error} />}
          <TextInput
            label="Bezeichnung"
            value={titel}
            onChange={setTitel}
            placeholder="z. B. Tanken September oder Inspektion"
          />
          <TextInput
            label="Kennzeichen"
            value={kennzeichen}
            onChange={setKennzeichen}
            placeholder="z. B. HH-MA 123"
            description="Freiwillig – hilft, wenn es mehr als einen Wagen gibt."
          />
          <DatumFeld label="Beginn" value={von} onChange={setVon} max={props.heute} width="100%" />
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => props.onOpenChange(false)} />
            <Button
              type="submit"
              label={props.fall ? 'Speichern' : 'Fall anlegen'}
              variant="primary"
              isLoading={isSaving}
              isDisabled={titel.trim() === ''}
              icon={<Sinnbild sinn="fahrzeug" />}
            />
          </HStack>
        </VStack>
      </form>
    </TafelDialog>
  );
}
