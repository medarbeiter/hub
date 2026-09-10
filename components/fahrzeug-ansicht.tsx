'use client';

import {
  Badge,
  Banner,
  Button,
  Card,
  DialogHeader,
  Divider,
  FileInput,
  Heading,
  HStack,
  InputGroup,
  InputGroupText,
  StackItem,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useState, useTransition, type ReactNode} from 'react';
import {
  fahrzeugBelegAbrechnenAction,
  fahrzeugBelegAddAction,
  fahrzeugBelegDeleteAction,
  fahrzeugBelegeAlleAbrechnenAction,
  fahrzeugFallAbrechnenAction,
  fahrzeugFallDeleteAction,
  fahrzeugFallSaveAction,
  fahrzeugFallSchliessenAction,
  fahrzeugFallWiedereroeffnenAction,
} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import type {PersonAngabe} from '@/lib/avatar';
import type {FahrzeugBelegArt, FahrzeugFallStatus} from '@/lib/db';
import {fmtDate, fmtDateRange, fmtEuro, parseEuro} from '@/lib/format';
import {Ausklapp} from './ausklapp';
import {BelegDialog, type BelegArtWahl} from './beleg-felder';
import {DatumFeld} from './datum-feld';
import {useMelde} from './melde';
import {PersonZeichen} from './person-zeichen';
import {Aufklapppfeil, Sinnbild, type Sinn} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';
import {ZeitRahmen} from './zeit-rahmen';

interface BelegZeile {
  id: number;
  art: FahrzeugBelegArt;
  artLabel: string;
  datum: string;
  betragCent: number;
  beschreibung: string | null;
  hatDatei: boolean;
}

/** Ein Tank- oder Ladebeleg, fertig für den Browser — keine Rechte, nur was daraus folgt. */
export interface TankbelegAnsicht extends BelegZeile {
  /** Nur in der Abrechnungsliste gesetzt. */
  person: PersonAngabe | null;
  abgerechnet: boolean;
  darfLoeschen: boolean;
  darfAbrechnen: boolean;
}

/** Ein Servicefall, fertig für den Browser. */
export interface FallAnsicht {
  id: number;
  titel: string;
  von: string;
  bis: string | null;
  status: FahrzeugFallStatus;
  statusLabel: string;
  summeCent: number;
  belege: BelegZeile[];
  person: PersonAngabe | null;
  /** Offen und eigener Fall (oder Abrechnungsrecht): Belege, Titel, Schließen. */
  darfBearbeiten: boolean;
  /** Geschlossen und Abrechnungsrecht. */
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

const TANK_ARTEN: BelegArtWahl[] = [
  {value: 'tanken', label: 'Tanken', sinn: 'tanken'},
  {value: 'laden', label: 'Laden', sinn: 'laden'},
];
const SERVICE_ARTEN: BelegArtWahl[] = [{value: 'service', label: 'Service', sinn: 'service'}];

const SPALTE_DATUM = 148;
const SPALTE_ART = 104;
const SPALTE_SUMME = 88;
const SPALTE_STATUS = 120;
const MAX_MB = 10;

interface FahrzeugAnsichtProps {
  tankbelege: TankbelegAnsicht[];
  faelle: FallAnsicht[];
  heute: string;
  /** `eigen`: meine Belege und Fälle. `abrechnung`: die aller, zum Übernehmen. */
  modus: 'eigen' | 'abrechnung';
  /** Aus der Seitenleiste oder Suche: den Upload-Dialog gleich öffnen. */
  neu?: 'tanken' | 'service';
  nav?: ReactNode;
  figur: string;
  figurEinheit: string;
  stand: string;
  /** Abrechnung: wie viele Tankbelege der Sammelknopf übernehmen würde. */
  tankOffen?: number;
}

/**
 * Das privat genutzte Dienstfahrzeug im selben Rahmen wie Reisen & Spesen.
 * Oben die Tank- und Ladebelege als flache Zeilen — hochladen, fertig —,
 * darunter die Servicefälle, die mehrere Rechnungen sammeln. Keine Bühne:
 * ein Beleg hat keine Zeitform.
 */
export function FahrzeugAnsicht(props: FahrzeugAnsichtProps) {
  const [tankOffen, setTankOffen] = useState(props.neu === 'tanken');
  const [fallOffen, setFallOffen] = useState(props.neu === 'service');
  const [bearbeitet, setBearbeitet] = useState<FallAnsicht | null>(null);
  const [offen, setOffen] = useState<number | null>(null);
  const eigen = props.modus === 'eigen';

  return (
    <>
      <ZeitRahmen
        titel={eigen ? 'Dienstfahrzeug' : 'Fahrzeugbelege abrechnen'}
        sinn={eigen ? 'fahrzeug' : 'abrechnen'}
        figur={props.figur}
        figurEinheit={props.figurEinheit}
        stand={props.stand}
        nav={props.nav}
        werkzeuge={
          eigen ? (
            <HStack gap={2} wrap="wrap">
              <Button
                label="Servicefall anlegen"
                variant="secondary"
                size="sm"
                icon={<Sinnbild sinn="service" />}
                onClick={() => {
                  setBearbeitet(null);
                  setFallOffen(true);
                }}
              />
              <Button
                label="Tankbeleg hochladen"
                variant="primary"
                size="sm"
                icon={<Sinnbild sinn="tanken" />}
                onClick={() => setTankOffen(true)}
              />
            </HStack>
          ) : (
            <AlleAbrechnenKnopf anzahl={props.tankOffen ?? 0} />
          )
        }
        belege={
          <VStack gap={6}>
            <VStack gap={2}>
              <Abschnitt sinn="tanken" text="Tank- und Ladebelege" />
              <TankStapel
                belege={props.tankbelege}
                leer={eigen ? 'Noch kein Tankbeleg. Ein Foto vom Beleg genügt – Betrag und Datum dazu, fertig.' : 'Keine Tankbelege in dieser Auswahl.'}
              />
            </VStack>
            <VStack gap={2}>
              <Abschnitt sinn="service" text="Servicefälle" />
              <FallStapel
                faelle={props.faelle}
                heute={props.heute}
                offenId={offen}
                onOffen={setOffen}
                onBearbeiten={(fall) => {
                  setBearbeitet(fall);
                  setFallOffen(true);
                }}
                leer={
                  eigen
                    ? 'Noch kein Servicefall. Reparatur, Inspektion, Reifen: ein Fall sammelt die Rechnungen dazu, bis du ihn schließt.'
                    : 'Keine Servicefälle in dieser Auswahl.'
                }
              />
            </VStack>
          </VStack>
        }
        kontext={
          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                <Heading level={3}>Zwei Wege</Heading>
              </HStack>
              <Text type="supporting" color="secondary">
                Tanken und Laden: Beleg fotografieren, hochladen, fertig. Jeder Beleg steht für sich
                und geht einzeln in die Abrechnung.
              </Text>
              <Text type="supporting" color="secondary">
                Service: eine Reparatur bringt oft mehrere Rechnungen. Ein Fall sammelt sie, solange
                er offen ist. Schließen heißt: fertig gesammelt – die Verwaltung übernimmt den Fall
                als Ganzes.
              </Text>
            </VStack>
          </Card>
        }
      />

      {tankOffen && (
        <BelegDialog
          isOpen={tankOffen}
          onOpenChange={setTankOffen}
          vonISO="0000-00-00"
          bisISO={props.heute}
          arten={TANK_ARTEN}
          action={fahrzeugBelegAddAction}
          felder={{}}
          untertitel="Tanken oder Laden"
          dateiPflicht
        />
      )}
      {fallOffen && (
        <FallEditor isOpen={fallOffen} onOpenChange={setFallOffen} fall={bearbeitet} heute={props.heute} />
      )}
    </>
  );
}

function Abschnitt({sinn, text}: {sinn: Sinn; text: string}) {
  return (
    <HStack gap={1.5} vAlign="center">
      <Sinnbild sinn={sinn} groesse="zeile" ton="sekundaer" />
      <Text type="label" color="secondary">
        {text}
      </Text>
    </HStack>
  );
}

function useLauf() {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, start] = useTransition();
  const lauf = (fn: () => Promise<{error: string | null}>, danach?: () => void) =>
    start(async () => {
      const {error} = await sicher(fn)();
      if (error) melde({ton: 'fehler', titel: error, dauerhaft: true});
      else danach?.();
      router.refresh();
    });
  return {lauf, isPending};
}

function AlleAbrechnenKnopf({anzahl}: {anzahl: number}) {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, start] = useTransition();
  if (anzahl === 0) return null;
  return (
    <Button
      label={`Alle Tankbelege übernehmen (${anzahl})`}
      variant="primary"
      size="sm"
      isLoading={isPending}
      icon={<Sinnbild sinn="abrechnen" />}
      onClick={() =>
        start(async () => {
          const {abgerechnet, error} = await sicher(fahrzeugBelegeAlleAbrechnenAction)();
          if (error) melde({ton: 'fehler', titel: error, dauerhaft: true});
          else melde({ton: 'erfolg', titel: `${abgerechnet} ${abgerechnet === 1 ? 'Beleg' : 'Belege'} in die Abrechnung übernommen.`});
          router.refresh();
        })
      }
    />
  );
}

function DateiVerweis({href}: {href: string}) {
  return (
    <Link href={href} target="_blank" style={{textDecoration: 'none'}}>
      <HStack gap={1} vAlign="center">
        <Sinnbild sinn="datei" groesse="zeile" ton="akzent" />
        <Text type="supporting" size="sm" color="accent">
          Beleg öffnen
        </Text>
      </HStack>
    </Link>
  );
}

/** Eine Belegzeile — dieselbe für den Tankbeleg und den Servicebeleg im Fall. */
function BelegZeileAnsicht({beleg, vorn, hinten}: {beleg: BelegZeile; vorn?: ReactNode; hinten?: ReactNode}) {
  return (
    <HStack gap={3} vAlign="center" paddingInline={2} paddingBlock={2} wrap="wrap">
      <span style={{inlineSize: 96, flexShrink: 0}}>
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {fmtDate(beleg.datum)}
        </Text>
      </span>
      <span style={{inlineSize: SPALTE_ART, flexShrink: 0}}>
        <HStack gap={1.5} vAlign="center">
          <Sinnbild sinn={beleg.art} groesse="zeile" ton="sekundaer" />
          <Text type="body" size="sm">
            {beleg.artLabel}
          </Text>
        </HStack>
      </span>
      <StackItem size="fill">
        <HStack gap={2} vAlign="center" wrap="wrap">
          {vorn}
          <Text type="supporting" size="sm" color="secondary">
            {beleg.beschreibung ?? '—'}
          </Text>
          {beleg.hatDatei && <DateiVerweis href={`/api/fahrzeug-beleg/${beleg.id}`} />}
        </HStack>
      </StackItem>
      <span style={{inlineSize: SPALTE_SUMME, flexShrink: 0, textAlign: 'end'}}>
        <Text type="body" size="sm" hasTabularNumbers>
          {fmtEuro(beleg.betragCent)}
        </Text>
      </span>
      {hinten}
    </HStack>
  );
}

function TankStapel({belege, leer}: {belege: TankbelegAnsicht[]; leer: string}) {
  const {lauf, isPending} = useLauf();
  if (belege.length === 0) {
    return (
      <HStack paddingBlock={3} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="tanken" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          {leer}
        </Text>
      </HStack>
    );
  }
  return (
    <VStack gap={0} role="list">
      <Divider />
      {belege.map((beleg) => (
        <VStack key={beleg.id} gap={0} role="listitem">
          <BelegZeileAnsicht
            beleg={beleg}
            vorn={beleg.person && <PersonZeichen person={beleg.person} groesse="zeile" mitName />}
            hinten={
              <HStack gap={2} vAlign="center" wrap="nowrap">
                <span style={{inlineSize: SPALTE_STATUS, flexShrink: 0}}>
                  <Badge
                    variant={beleg.abgerechnet ? 'success' : 'info'}
                    label={beleg.abgerechnet ? 'Abgerechnet' : 'Offen'}
                    icon={<Sinnbild sinn={beleg.abgerechnet ? 'abrechnen' : 'einreichen'} groesse="zeile" />}
                  />
                </span>
                {beleg.darfAbrechnen && (
                  <Button
                    label="Übernehmen"
                    variant="secondary"
                    size="sm"
                    isLoading={isPending}
                    icon={<Sinnbild sinn="abrechnen" />}
                    onClick={() => lauf(() => fahrzeugBelegAbrechnenAction(beleg.id))}
                  />
                )}
                {beleg.darfLoeschen && (
                  <Button
                    label="Entfernen"
                    variant="ghost"
                    size="sm"
                    isLoading={isPending}
                    onClick={() => lauf(() => fahrzeugBelegDeleteAction(beleg.id))}
                  />
                )}
              </HStack>
            }
          />
          <Divider />
        </VStack>
      ))}
    </VStack>
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
      <HStack paddingBlock={3} gap={3} vAlign="start" wrap="nowrap">
        <Sinnbild sinn="service" groesse="leer" ton="sekundaer" />
        <Text type="body" color="secondary">
          {leer}
        </Text>
      </HStack>
    );
  }

  return (
    <VStack gap={0}>
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
                  <span style={{inlineSize: SPALTE_DATUM, flexShrink: 0}}>
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
                  <span style={{inlineSize: SPALTE_DATUM, flexShrink: 0}} />
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

function FallTafel({fall, heute, onBearbeiten}: {fall: FallAnsicht; heute: string; onBearbeiten: (fall: FallAnsicht) => void}) {
  const {lauf, isPending} = useLauf();
  const [belegOffen, setBelegOffen] = useState(false);
  const [loeschen, setLoeschen] = useState(false);

  return (
    <VStack gap={4}>
      <VStack gap={2}>
        <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
          <Abschnitt sinn="beleg" text="Rechnungen" />
          {fall.darfBearbeiten && (
            <Button
              label="Rechnung hinzufügen"
              variant="primary"
              size="sm"
              icon={<Sinnbild sinn="hinzufuegen" />}
              onClick={() => setBelegOffen(true)}
            />
          )}
        </HStack>
        <VStack gap={0} role="list">
          <Divider />
          {fall.belege.map((beleg) => (
            <VStack key={beleg.id} gap={0} role="listitem">
              <BelegZeileAnsicht
                beleg={beleg}
                hinten={
                  fall.darfBearbeiten && (
                    <Button
                      label="Entfernen"
                      variant="ghost"
                      size="sm"
                      isLoading={isPending}
                      onClick={() => lauf(() => fahrzeugBelegDeleteAction(beleg.id))}
                    />
                  )
                }
              />
              <Divider />
            </VStack>
          ))}
          <HStack justify="between" gap={3} paddingInline={2} paddingBlock={2}>
            <Text type="body" weight="semibold">
              Summe
            </Text>
            <Text type="body" weight="semibold" hasTabularNumbers>
              {fmtEuro(fall.summeCent)}
            </Text>
          </HStack>
        </VStack>
      </VStack>

      <HStack justify="between" vAlign="center" gap={2} wrap="wrap">
        <HStack gap={2} vAlign="center" wrap="wrap">
          {fall.darfBearbeiten && (
            <Button label="Bearbeiten" variant="ghost" size="sm" icon={<Sinnbild sinn="bearbeiten" />} onClick={() => onBearbeiten(fall)} />
          )}
          {(fall.darfBearbeiten || fall.darfAbrechnen) &&
            (loeschen ? (
              <HStack gap={2} vAlign="center">
                <Text type="supporting">Wirklich löschen – samt Rechnungen?</Text>
                <Button
                  label="Löschen"
                  variant="destructive"
                  size="sm"
                  isLoading={isPending}
                  icon={<Sinnbild sinn="entfernen" />}
                  onClick={() => lauf(() => fahrzeugFallDeleteAction(fall.id), () => setLoeschen(false))}
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
          arten={SERVICE_ARTEN}
          action={fahrzeugBelegAddAction}
          felder={{fallId: String(fall.id)}}
          untertitel={fall.titel}
          dateiPflicht
        />
      )}
    </VStack>
  );
}

/**
 * Anlegen und Bearbeiten in einem Dialog. Beim Anlegen kommt die erste
 * Rechnung gleich mit — ein Servicefall entsteht, weil eine da ist. Wie der
 * Belegdialog kein `<form action>`: die Datei liegt als File im State.
 */
function FallEditor(props: {isOpen: boolean; onOpenChange: (isOpen: boolean) => void; fall: FallAnsicht | null; heute: string}) {
  const router = useRouter();
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);
  const [titel, setTitel] = useState(props.fall?.titel ?? '');
  const [von, setVon] = useState(props.fall?.von ?? props.heute);
  const [datum, setDatum] = useState(props.heute);
  const [betrag, setBetrag] = useState('');
  const [beschreibung, setBeschreibung] = useState('');
  const [datei, setDatei] = useState<File | null>(null);
  const neu = props.fall === null;
  const betragCent = parseEuro(betrag);

  const speichern = () =>
    start(async () => {
      setFehler(null);
      const fd = new FormData();
      fd.set('fallId', String(props.fall?.id ?? 0));
      fd.set('titel', titel);
      fd.set('von', von);
      if (neu) {
        fd.set('art', 'service');
        fd.set('datum', datum);
        fd.set('betrag', betrag);
        fd.set('beschreibung', beschreibung);
        if (datei) fd.set('datei', datei);
      }
      const {error} = await sicher(fahrzeugFallSaveAction)({error: null}, fd);
      if (error) {
        setFehler(error);
        return;
      }
      props.onOpenChange(false);
      router.refresh();
    });

  const bereit = titel.trim() !== '' && (!neu || (betragCent !== null && datei !== null && datum >= von));

  return (
    <TafelDialog isOpen={props.isOpen} onOpenChange={props.onOpenChange} purpose="form" width={480}>
      <DialogHeader
        title={neu ? 'Servicefall anlegen' : 'Servicefall bearbeiten'}
        subtitle={neu ? 'Mit der ersten Rechnung – weitere kommen dazu, bis du den Fall schließt.' : undefined}
      />
      <VStack gap={4} padding={4} className="tafel-rumpf">
        {fehler && <Banner status="error" title={fehler} />}
        <TextInput label="Bezeichnung" value={titel} onChange={setTitel} placeholder="z. B. Inspektion, Reifenwechsel, Unfallreparatur" />
        <DatumFeld label="Beginn" value={von} onChange={setVon} max={props.heute} width="100%" />
        {neu && (
          <>
            <Divider />
            <Abschnitt sinn="beleg" text="Erste Rechnung" />
            <HStack gap={3} vAlign="start">
              <DatumFeld label="Rechnungsdatum" value={datum} onChange={setDatum} min={von} max={props.heute} width="100%" />
              <InputGroup label="Betrag">
                <TextInput label="Betrag" isLabelHidden value={betrag} onChange={setBetrag} placeholder="249,00" />
                <InputGroupText>€</InputGroupText>
              </InputGroup>
            </HStack>
            <TextInput label="Beschreibung" value={beschreibung} onChange={setBeschreibung} placeholder="z. B. Werkstatt Meier, Bremsen vorn" />
            <FileInput
              label="Rechnung als Datei"
              description={`JPG, PNG, WEBP oder PDF, höchstens ${MAX_MB} MB. Ein Foto vom Handy genügt.`}
              placeholder="Datei wählen"
              mode="dropzone"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              maxSize={MAX_MB * 1024 * 1024}
              value={datei}
              onChange={(files) => setDatei(Array.isArray(files) ? (files[0] ?? null) : files)}
            />
          </>
        )}
        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => props.onOpenChange(false)} />
          <Button
            label={neu ? 'Fall anlegen' : 'Speichern'}
            variant="primary"
            isLoading={isPending}
            isDisabled={!bereit}
            icon={<Sinnbild sinn="service" />}
            onClick={speichern}
          />
        </HStack>
      </VStack>
    </TafelDialog>
  );
}
