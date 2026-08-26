'use client';

import {
  Badge,
  Banner,
  Button,
  CheckboxInput,
  DialogHeader,
  Divider,
  HStack,
  Item,
  MultiSelector,
  RadioList,
  RadioListItem,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {useRouter, useSearchParams} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {
  zugangscodeAendernAction,
  zugangscodeAnlegenAction,
  zugangscodeImportAction,
  zugangscodeLoeschungAnfordernAction,
  zugangscodePinAction,
  zugangscodeSammelLoeschungAction,
  zugangscodePinKreisAction,
  type ActionState,
} from '@/app/actions';
import {sicher, sicheresFormular} from '@/lib/aktion';
import {migrationParsen, migrationSammeln} from '@/lib/otp-migration';
import {DienstZeichen, markeFuer} from './dienst-zeichen';
import {useMelde} from './melde';
import {QrLeser} from './qr-leser';
import type {PersonAngabe} from '@/lib/avatar';
import {PersonenReihe} from './person-zeichen';
import {Sinnbild, umriss} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

/**
 * Was der Server der Seite gibt: der fertige Code samt Ablauf — nie das
 * Geheimnis, aus dem er entsteht (siehe lib/zugangscodes.ts).
 */
export interface ZugangscodeZeile {
  id: number;
  dienst: string;
  konto: string | null;
  code: string | null;
  gueltigBisMs: number;
  periode: number;
  /** Der Leserkreis als Schild an der Zeile; `null`, wenn alle ihn sehen. */
  sichtbar: string | null;
  /** Derselbe Kreis als Gesichter — leer, wo keine Namensliste dahintersteht. */
  kreisGesichter: PersonAngabe[];
  gruppe: 'angepinnt' | 'selbst' | 'geteilt' | 'alle';
  /** Der Pin-Zustand: der eigene Pin fürs Umschalten, der ganze Kreis nur für Verwaltende. */
  pin: {selbst: boolean; breite: {alle: boolean; rollen: string[]; personen: number[]} | null};
  darfBearbeiten: boolean;
  /** Der rohe Kreis fürs Bearbeiten-Formular — nur, wenn Bearbeiten erlaubt ist. */
  kreis: {sichtbarkeit: 'alle' | 'rolle' | 'personen'; rollen: string[]; personen: number[]} | null;
}

export interface PersonWahl {
  value: string;
  label: string;
}

interface KreisProps {
  /** Wer das Formular bedient — für „Nur für mich" und den eigenen Kreis. */
  selbstId: number;
  /** Nur wer verwaltet, gibt für alle oder für Rollen frei. */
  darfVerwalten: boolean;
  personenWahl: PersonWahl[];
  /** Die Rollen aus der Datenbank — leer, wenn die Person nicht verwaltet (dann steht der Kreis „Rollen" nicht zur Wahl). */
  rollenWahl: PersonWahl[];
}

const INITIAL: ActionState = {error: null};

/** „123 456" liest sich, „123456" wird abgezählt. Kopiert wird ohne Lücke. */
function gruppiert(code: string): string {
  const mitte = Math.ceil(code.length / 2);
  return `${code.slice(0, mitte)} ${code.slice(mitte)}`;
}

const RING_RADIUS = 7;
const RING_UMFANG = 2 * Math.PI * RING_RADIUS;

/**
 * Die Restzeit eines Codes als schwindender Bogen — wann er wechselt, nicht
 * als tickende Zahl. Der Bogen beginnt oben und nimmt im Uhrzeigersinn ab;
 * die letzten fünf Sekunden warnt Orange davor, jetzt noch abzutippen. Die
 * Geometrie ist SVG-eigenes Maß (keine Gestaltungsgröße, die ein Token sagen
 * könnte); die Farben sind Tokens und kontrastgeprüft.
 */
function CodeRing({restMs, periode}: {restMs: number; periode: number}) {
  const restS = Math.max(0, Math.ceil(restMs / 1000));
  const anteil = Math.max(0, Math.min(1, restMs / (periode * 1000)));
  const knapp = restMs <= 5000;
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 18 18"
      role="img"
      aria-label={restS === 0 ? 'Der Code wird gerade erneuert' : `Der Code wechselt in ${restS} Sekunden`}
      style={{flexShrink: 0}}
    >
      <circle cx={9} cy={9} r={RING_RADIUS} fill="none" stroke="var(--color-border)" strokeWidth={2} />
      <circle
        className="code-ring-bogen"
        cx={9}
        cy={9}
        r={RING_RADIUS}
        fill="none"
        stroke={knapp ? 'var(--color-warning)' : 'var(--color-icon-secondary)'}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray={RING_UMFANG}
        strokeDashoffset={RING_UMFANG * (1 - anteil)}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

/**
 * Der Leserkreis als Feldgruppe samt versteckter Formularfelder — einmal
 * geschrieben, zweimal gebraucht: im Zugang-Formular und im Import aus
 * Google Authenticator (dort ein Kreis für alle gewählten Konten).
 */
function KreisWahl({
  selbstId,
  darfVerwalten,
  personenWahl,
  rollenWahl,
  vorgabe,
  rollenVorgabe,
  personenVorgabe,
}: KreisProps & {vorgabe: string; rollenVorgabe?: string[]; personenVorgabe?: string[]}) {
  const [kreis, setKreis] = useState<string>(vorgabe);
  const [rollen, setRollen] = useState<string[]>(rollenVorgabe ?? []);
  const [personen, setPersonen] = useState<string[]>(personenVorgabe ?? []);
  return (
    <>
      <RadioList label="Sichtbar für" value={kreis} onChange={setKreis}>
        {darfVerwalten && (
          <RadioListItem
            value="alle"
            label="Alle Angemeldeten"
            description="Der gemeinsame Firmenzugang – jeder liest den Code."
          />
        )}
        {darfVerwalten && (
          <RadioListItem value="rolle" label="Rollen auswählen" description="Alle Konten der gewählten Rollen." />
        )}
        <RadioListItem
          value="personen"
          label={darfVerwalten ? 'Bestimmte Personen' : 'Mit Personen teilen'}
          description={darfVerwalten ? undefined : 'Du bleibst immer selbst im Kreis.'}
        />
        <RadioListItem
          value="selbst"
          label="Nur für mich"
          description="Ein privater Schlüssel – niemand sonst sieht ihn."
        />
      </RadioList>
      {kreis === 'rolle' && (
        <MultiSelector
          label="Rollen"
          options={rollenWahl}
          value={rollen}
          onChange={setRollen}
          placeholder="Rollen wählen"
        />
      )}
      {kreis === 'personen' && (
        <MultiSelector
          label="Personen"
          options={personenWahl.filter((p) => p.value !== String(selbstId))}
          value={personen}
          onChange={setPersonen}
          placeholder="Personen wählen"
          hasSearch
        />
      )}
      <input type="hidden" name="sichtbarkeit" value={kreis} />
      {kreis === 'rolle' && rollen.map((r) => <input key={r} type="hidden" name="rollen" value={r} />)}
      {kreis === 'personen' &&
        personen.map((id) => <input key={id} type="hidden" name="personen" value={id} />)}
    </>
  );
}

/**
 * Ein Formular für Anlegen und Bearbeiten — dieselben Felder, dieselbe
 * Reihenfolge: erst der Schlüssel (Scan oder Handeingabe), dann der Name,
 * dann der Leserkreis. Beim Bearbeiten darf der Schlüssel leer bleiben; das
 * gespeicherte Geheimnis bleibt dann und ist ohnehin nie wieder ablesbar.
 * Liest der Scanner statt eines einzelnen otpauth-Links den Übertragungscode
 * aus Google Authenticator, wechselt das Anlegen in eine Import-Ansicht: die
 * gefundenen Konten mit Abwahl, ein Leserkreis für alle.
 */
function ZugangForm({
  zeile,
  selbstId,
  darfVerwalten,
  personenWahl,
  rollenWahl,
  bestehend,
  onDone,
}: KreisProps & {
  zeile: ZugangscodeZeile | null;
  /** Die schon hinterlegten Namen — die Import-Ansicht kündigt Nummerierung an. */
  bestehend?: Array<{dienst: string; konto: string | null}>;
  onDone: () => void;
}) {
  const [eingabe, setEingabe] = useState('');
  const [dienst, setDienst] = useState(zeile?.dienst ?? '');
  const [konto, setKonto] = useState(zeile?.konto ?? '');
  const [scanne, setScanne] = useState(false);
  const [scanFehler, setScanFehler] = useState<string | null>(null);
  const [gelesen, setGelesen] = useState(false);

  // Der eigene Kreis mit genau einem Eintrag ist im Formular „Nur für mich".
  const kreisVorgabe =
    zeile?.kreis == null
      ? darfVerwalten
        ? 'alle'
        : 'selbst'
      : zeile.kreis.sichtbarkeit === 'personen' &&
          zeile.kreis.personen.length === 1 &&
          zeile.kreis.personen[0] === selbstId
        ? 'selbst'
        : zeile.kreis.sichtbarkeit;

  const [state, formAction, isPending] = useActionState(
    sicheresFormular(zeile ? zugangscodeAendernAction : zugangscodeAnlegenAction),
    INITIAL,
  );
  const lastState = useRef(state);
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) onDone();
    }
  }, [state, onDone]);

  // Der Import aus Google Authenticator: die rohen Übertragungslinks und die
  // abgewählten Indizes. Die Kontenliste wird je Render aus den Links
  // gerechnet — mit derselben Funktion, die auch die Server-Aktion ruft, damit
  // ein Abwahl-Index auf beiden Seiten dasselbe Konto meint.
  const [importUris, setImportUris] = useState<string[]>([]);
  const [abwahl, setAbwahl] = useState<ReadonlySet<number>>(new Set());
  const [importState, importFormAction, importPendet] = useActionState(
    sicheresFormular(zugangscodeImportAction),
    INITIAL,
  );
  const lastImport = useRef(importState);
  useEffect(() => {
    if (importState !== lastImport.current) {
      lastImport.current = importState;
      if (importState.error === null) onDone();
    }
  }, [importState, onDone]);

  /**
   * Was die Kamera oder ein Bild hergibt. Zwei Treffer: der otpauth-Link eines
   * einzelnen Dienstes, und der Übertragungscode aus Google Authenticator
   * („Konten übertragen"), der gleich eine ganze Liste bringt — jeder andere
   * QR-Code (eine URL, eine Visitenkarte) wird benannt, und weitergesucht wird
   * trotzdem.
   */
  const erkannt = (text: string) => {
    if (text.toLowerCase().startsWith('otpauth-migration://')) {
      if (zeile) {
        setScanFehler('Ein Übertragungscode gehört zum Anlegen – hier wird ein einzelner Zugang bearbeitet.');
        return;
      }
      const probe = migrationParsen(text);
      if (typeof probe === 'string') {
        setScanFehler(probe);
        return;
      }
      if (probe.konten.length === 0) {
        setScanFehler('Dieser Übertragungscode enthält keine zeitbasierten Codes.');
        return;
      }
      setImportUris((alt) => (alt.includes(text) ? alt : [...alt, text]));
      setScanFehler(null);
      setScanne(false);
      return;
    }
    if (text.toLowerCase().startsWith('otpauth://')) {
      setEingabe(text);
      setGelesen(true);
      setScanFehler(null);
      setScanne(false);
    } else {
      setScanFehler('Der gelesene QR-Code ist kein Einrichtungscode (otpauth-Link).');
    }
  };

  if (scanne) {
    return (
      <VStack gap={4} padding={4} className="tafel-rumpf">
        <QrLeser onErkannt={erkannt} fehler={scanFehler} />
        <HStack gap={2} justify="end">
          <Button
            label={importUris.length > 0 ? 'Zurück zur Liste' : 'Von Hand eingeben'}
            variant="secondary"
            onClick={() => {
              setScanne(false);
              setScanFehler(null);
            }}
          />
        </HStack>
      </VStack>
    );
  }

  // Die Import-Ansicht: was die Übertragungscodes hergeben, mit Abwahl je
  // Konto. Die rohen Links gehen als versteckte Felder mit — die Server-Aktion
  // liest sie selbst noch einmal, der Browser ist keine Grenze.
  if (!zeile && importUris.length > 0) {
    const sammlung = migrationSammeln(importUris);
    const gewaehlt = sammlung.konten.filter((_, index) => !abwahl.has(index)).length;
    // Vergebene Namen: was schon hinterlegt ist, und was im Stapel selbst
    // gleich heißt (gleicher Name, anderes Geheimnis — die exakt Gleichen hat
    // migrationSammeln längst gefaltet). Der Server nummeriert solche Zeilen
    // beim Anlegen (freieBenennung) — hier wird es vorher angekündigt.
    const vergeben = new Set(
      (bestehend ?? []).map((b) => `${b.dienst.toLowerCase()}\u0000${(b.konto ?? '').toLowerCase()}`),
    );
    const gesehen = new Set<string>();
    const doppelt = sammlung.konten.map((konto) => {
      const schluessel = `${konto.dienst.toLowerCase()}\u0000${konto.konto.toLowerCase()}`;
      const kollidiert = vergeben.has(schluessel) || gesehen.has(schluessel);
      gesehen.add(schluessel);
      return kollidiert;
    });
    return (
      <form action={importFormAction} className="tafel-rumpf">
        <VStack gap={4} padding={4}>
          {importState.error && <Banner status="error" title={importState.error} />}
          <Banner
            status="success"
            title={`${sammlung.konten.length} ${sammlung.konten.length === 1 ? 'Konto' : 'Konten'} aus ${
              importUris.length === 1 ? 'einem Übertragungscode' : `${importUris.length} Übertragungscodes`
            } gelesen.`}
            description={
              sammlung.uebersprungen > 0
                ? `${sammlung.uebersprungen} ${
                    sammlung.uebersprungen === 1 ? 'Eintrag ist' : 'Einträge sind'
                  } nicht zeitbasiert und ${sammlung.uebersprungen === 1 ? 'wird' : 'werden'} übersprungen.`
                : undefined
            }
          />
          <VStack gap={1}>
            {sammlung.konten.map((konto, index) => (
              <CheckboxInput
                key={`${konto.dienst} ${konto.konto} ${index}`}
                label={konto.konto ? `${konto.dienst} – ${konto.konto}` : konto.dienst}
                description={
                  doppelt[index]
                    ? 'Ein Code mit diesem Namen besteht schon – dieser wird nummeriert angelegt („… (2)“).'
                    : undefined
                }
                value={!abwahl.has(index)}
                onChange={(an) =>
                  setAbwahl((alt) => {
                    const neu = new Set(alt);
                    if (an) neu.delete(index);
                    else neu.add(index);
                    return neu;
                  })
                }
                width="100%"
              />
            ))}
          </VStack>
          <KreisWahl
            selbstId={selbstId}
            darfVerwalten={darfVerwalten}
            personenWahl={personenWahl}
            rollenWahl={rollenWahl}
            vorgabe={darfVerwalten ? 'alle' : 'selbst'}
          />
          {importUris.map((uri) => (
            <input key={uri} type="hidden" name="uri" value={uri} />
          ))}
          {[...abwahl].map((index) => (
            <input key={index} type="hidden" name="abwahl" value={index} />
          ))}
          <HStack gap={2} justify="end">
            <Button
              label="Weitere Codes scannen"
              variant="secondary"
              icon={<Sinnbild sinn="scannen" />}
              onClick={() => {
                setScanne(true);
                setScanFehler(null);
              }}
            />
            <Button label="Abbrechen" variant="secondary" onClick={() => onDone()} />
            <Button
              label={gewaehlt === 1 ? '1 Zugang anlegen' : `${gewaehlt} Zugänge anlegen`}
              variant="primary"
              type="submit"
              isLoading={importPendet}
            />
          </HStack>
        </VStack>
      </form>
    );
  }

  return (
    <form action={formAction} className="tafel-rumpf">
      <VStack gap={4} padding={4}>
        {state.error && <Banner status="error" title={state.error} />}
        {gelesen && <Banner status="success" title="QR-Code gelesen – unten nur noch prüfen und bestätigen." />}
        <HStack gap={2} vAlign="start" wrap="nowrap">
          <TextInput
            label={zeile ? 'Neuer Schlüssel (optional)' : 'Schlüssel oder otpauth-Link'}
            value={eingabe}
            onChange={setEingabe}
            htmlName="eingabe"
            placeholder={zeile ? 'Leer lassen, um den Schlüssel zu behalten' : 'z. B. gezd gnbv gy3t qojq …'}
            description={
              zeile
                ? 'Der gespeicherte Schlüssel ist nicht wieder ablesbar. Nur ausfüllen, wenn der Dienst neu eingerichtet wurde.'
                : 'Beim Einrichten der Bestätigung in zwei Schritten zeigt der Dienst neben dem QR-Code einen Schlüssel („setup key“) oder einen otpauth-Link – Scan oder Handeingabe, beides genügt. Auch der Export aus Google Authenticator („Konten übertragen“) wird beim Scannen erkannt, gern als mehrere Bildschirmfotos auf einmal.'
            }
            width="100%"
          />
          <Button
            label="Scannen"
            variant="secondary"
            icon={<Sinnbild sinn="scannen" />}
            onClick={() => {
              setScanne(true);
              setScanFehler(null);
            }}
          />
        </HStack>
        <TextInput
          label="Dienst"
          value={dienst}
          onChange={setDienst}
          htmlName="dienst"
          placeholder="z. B. Google"
          // Die erkannte Marke als lebende Vorschau im Feld — Astryx will hier
          // die Komponentenform (wie bei den Sinnbildern), kein Element.
          startIcon={markeFuer(dienst) ?? umriss('zugangscode')}
          description={zeile ? undefined : 'Darf leer bleiben, wenn der otpauth-Link den Dienst schon nennt.'}
        />
        <TextInput
          label="Konto"
          value={konto}
          onChange={setKonto}
          htmlName="konto"
          placeholder="z. B. info@firma.de"
          description="Optional – hilft, wenn es beim selben Dienst mehrere Konten gibt."
        />
        <KreisWahl
          selbstId={selbstId}
          darfVerwalten={darfVerwalten}
          personenWahl={personenWahl}
          rollenWahl={rollenWahl}
          vorgabe={kreisVorgabe}
          rollenVorgabe={zeile?.kreis?.rollen}
          personenVorgabe={(zeile?.kreis?.personen ?? []).filter((id) => id !== selbstId).map(String)}
        />
        {zeile && <input type="hidden" name="zugangId" value={zeile.id} />}
        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => onDone()} />
          <Button
            label={zeile ? 'Speichern' : 'Zugang hinterlegen'}
            variant="primary"
            type="submit"
            isLoading={isPending}
          />
        </HStack>
      </VStack>
    </form>
  );
}

/**
 * Der Pin-Dialog der Verwaltenden: der ganze Kreis auf einen Blick — für mich,
 * für alle, für Rollen, für Personen — und als Ganzes gespeichert, wie der
 * Leserkreis in `schreibeKreis()`. Wer nur erfasst, braucht keinen Dialog:
 * sein Knopf schaltet den eigenen Pin direkt um.
 */
function PinForm({
  zeile,
  selbstId,
  personenWahl,
  rollenWahl,
  onDone,
}: Pick<KreisProps, 'selbstId' | 'personenWahl' | 'rollenWahl'> & {
  zeile: ZugangscodeZeile;
  onDone: () => void;
}) {
  const breite = zeile.pin.breite ?? {alle: false, rollen: [], personen: []};
  const [fuerMich, setFuerMich] = useState(breite.personen.includes(selbstId));
  const [fuerAlle, setFuerAlle] = useState(breite.alle);
  const [rollen, setRollen] = useState<string[]>(breite.rollen);
  const [personen, setPersonen] = useState<string[]>(
    breite.personen.filter((id) => id !== selbstId).map(String),
  );
  const [state, formAction, isPending] = useActionState(sicheresFormular(zugangscodePinKreisAction), INITIAL);
  const lastState = useRef(state);
  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) onDone();
    }
  }, [state, onDone]);
  return (
    <form action={formAction} className="tafel-rumpf">
      <VStack gap={4} padding={4}>
        {state.error && <Banner status="error" title={state.error} />}
        <Text type="supporting" color="secondary">
          Angepinnte Zugänge stehen für die Getroffenen zuoberst unter „Angepinnt“. Der Leserkreis
          bleibt unberührt – ein Pin zeigt niemandem etwas, das er nicht ohnehin sieht.
        </Text>
        <CheckboxInput label="Für mich" value={fuerMich} onChange={setFuerMich} width="100%" />
        <CheckboxInput label="Für alle Angemeldeten" value={fuerAlle} onChange={setFuerAlle} width="100%" />
        <MultiSelector
          label="Für Rollen"
          options={rollenWahl}
          value={rollen}
          onChange={setRollen}
          placeholder="Rollen wählen"
        />
        <MultiSelector
          label="Für Personen"
          options={personenWahl.filter((p) => p.value !== String(selbstId))}
          value={personen}
          onChange={setPersonen}
          placeholder="Personen wählen"
          hasSearch
        />
        <input type="hidden" name="zugangId" value={zeile.id} />
        {fuerAlle && <input type="hidden" name="pinAlle" value="1" />}
        {rollen.map((r) => (
          <input key={r} type="hidden" name="pinRollen" value={r} />
        ))}
        {personen.map((id) => (
          <input key={id} type="hidden" name="pinPersonen" value={id} />
        ))}
        {fuerMich && <input type="hidden" name="pinPersonen" value={selbstId} />}
        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => onDone()} />
          <Button label="Speichern" variant="primary" type="submit" isLoading={isPending} />
        </HStack>
      </VStack>
    </form>
  );
}

/**
 * Der Anlegen-Knopf samt Dialog — er steht im Werkzeugband des Kopfes, wo
 * jede Seite ihre eine Haupthandlung trägt (Abschluss, Berichte), statt unter
 * der Liste, wo er erst nach dem Scrollen sichtbar würde.
 */
export function ZugangAnlegen({
  selbstId,
  darfVerwalten,
  personenWahl,
  rollenWahl,
  bestehend,
}: KreisProps & {bestehend?: Array<{dienst: string; konto: string | null}>}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  return (
    <>
      <Button
        label="Zugang hinterlegen"
        variant="primary"
        icon={<Sinnbild sinn="hinzufuegen" />}
        onClick={() => setOffen(true)}
      />
      <TafelDialog isOpen={offen} onOpenChange={setOffen} purpose="form" width={480}>
        <DialogHeader
          title="Zugang hinterlegen"
          subtitle={
            darfVerwalten
              ? 'Sichtbar für alle Angemeldeten oder einen gewählten Kreis.'
              : 'Nur für dich – oder mit ausgewählten Personen geteilt.'
          }
        />
        {offen && (
          <ZugangForm
            zeile={null}
            selbstId={selbstId}
            darfVerwalten={darfVerwalten}
            personenWahl={personenWahl}
            rollenWahl={rollenWahl}
            bestehend={bestehend}
            onDone={() => {
              setOffen(false);
              router.refresh();
            }}
          />
        )}
      </TafelDialog>
    </>
  );
}

const GRUPPEN: ReadonlyArray<{schluessel: ZugangscodeZeile['gruppe']; titel: string}> = [
  {schluessel: 'angepinnt', titel: 'Angepinnt'},
  {schluessel: 'selbst', titel: 'Nur für dich'},
  {schluessel: 'geteilt', titel: 'Geteilte Zugänge'},
  {schluessel: 'alle', titel: 'Für alle Angemeldeten'},
];

/**
 * Die Einmalcodes als dichte Zeilen, vom Persönlichen zum Gemeinsamen
 * gruppiert: zuoberst, was für einen angepinnt ist, dann die eigenen Schlüssel,
 * die geteilten Kreise, der Firmenbestand für alle. Die Überschriften erscheinen erst, wenn es mehr als
 * eine Gruppe gibt — eine Liste mit nur einer Sorte braucht kein Schild.
 *
 * Die Codes selbst rechnet der Server (das Geheimnis bleibt dort); der Browser
 * zählt nur die Restlaufzeit herunter und holt sich am Fensterwechsel über
 * `router.refresh()` die nächste Runde. Der Versatz zwischen Server- und
 * Browseruhr wird dabei mitgeführt, damit eine falsch gehende Arbeitsplatzuhr
 * den Countdown nicht gegen den Code verschiebt.
 */
export function ZugangscodeTafel({
  codes,
  serverJetztMs,
  selbstId,
  darfVerwalten,
  personenWahl,
  rollenWahl,
  darfErfassen = false,
  gefiltert = false,
}: KreisProps & {
  codes: ZugangscodeZeile[];
  /** Nur wer erfasst, darf (eigene) Pins setzen — ohne das Recht gibt es keinen Pin-Knopf. */
  darfErfassen?: boolean;
  /** Die Serveruhr beim Rendern — sie, nicht die Browseruhr, hat die Codes gerechnet. */
  serverJetztMs: number;
  /** Eine leere Liste unter aktivem Filter heißt „nichts passt", nicht „nichts da". */
  gefiltert?: boolean;
}) {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, startTransition] = useTransition();
  const [bearbeiten, setBearbeiten] = useState<ZugangscodeZeile | null>(null);
  const [loeschen, setLoeschen] = useState<ZugangscodeZeile | null>(null);
  const [anpinnen, setAnpinnen] = useState<ZugangscodeZeile | null>(null);
  // Der Auswählen-Modus der Verwaltenden: `null` heißt aus, sonst die Menge
  // der angekreuzten Zeilen — entfernt wird gebündelt über EINE Mail.
  const [auswahl, setAuswahl] = useState<ReadonlySet<number> | null>(null);
  const [sammelDialog, setSammelDialog] = useState(false);
  const [kopiertId, setKopiertId] = useState<number | null>(null);

  // Rückkehr vom Bestätigungslink der Löschungs-E-Mail — einmal gemeldet,
  // dann aus der Adresse getilgt (fire-once, wie überall in melde.tsx).
  const suchparameter = useSearchParams();
  useEffect(() => {
    const bestaetigt = suchparameter.get('zugangscode_bestaetigt');
    const fehler = suchparameter.get('zugangscode_fehler');
    if (!bestaetigt && !fehler) return;
    melde(
      bestaetigt
        ? bestaetigt.endsWith('Zugänge')
          ? {ton: 'erfolg', titel: 'Zugänge entfernt', text: `${bestaetigt} wurden gelöscht.`}
          : {ton: 'erfolg', titel: 'Zugang entfernt', text: `„${bestaetigt}" wurde gelöscht.`}
        : {ton: 'fehler', titel: fehler!, dauerhaft: true},
    );
    const url = new URL(window.location.href);
    url.searchParams.delete('zugangscode_bestaetigt');
    url.searchParams.delete('zugangscode_fehler');
    router.replace(`${url.pathname}${url.search}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Erster Render mit der Serverzeit (Server- und Browserbaum stimmen überein),
  // danach tickt die Browseruhr plus Versatz.
  const versatz = useRef(0);
  useEffect(() => {
    versatz.current = serverJetztMs - Date.now();
  }, [serverJetztMs]);
  const [jetztMs, setJetztMs] = useState(serverJetztMs);
  useEffect(() => {
    const takt = setInterval(() => setJetztMs(Date.now() + versatz.current), 1000);
    return () => clearInterval(takt);
  }, []);

  // Am Fensterwechsel einmal neu vom Server — nicht einmal pro Tick.
  const geholtFuer = useRef(0);
  const naechsterWechsel = codes.length > 0 ? Math.min(...codes.map((c) => c.gueltigBisMs)) : null;
  useEffect(() => {
    if (naechsterWechsel === null) return;
    if (jetztMs >= naechsterWechsel && geholtFuer.current !== naechsterWechsel) {
      geholtFuer.current = naechsterWechsel;
      router.refresh();
    }
  }, [jetztMs, naechsterWechsel, router]);

  const kopieren = async (zeile: ZugangscodeZeile) => {
    if (!zeile.code) return;
    try {
      await navigator.clipboard.writeText(zeile.code);
      setKopiertId(zeile.id);
      setTimeout(() => setKopiertId((id) => (id === zeile.id ? null : id)), 2000);
    } catch {
      melde({ton: 'fehler', titel: 'Kopieren nicht möglich', text: 'Bitte den Code von Hand übernehmen.'});
    }
  };

  const entfernen = (zeile: ZugangscodeZeile) =>
    startTransition(async () => {
      const result = await sicher(zugangscodeLoeschungAnfordernAction)(zeile.id);
      setLoeschen(null);
      if (result.error) {
        melde({ton: 'fehler', titel: result.error, dauerhaft: true});
        return;
      }
      melde({
        ton: 'hinweis',
        titel: 'Bestätigungsmail verschickt',
        text: 'Der Zugang wird erst entfernt, wenn du den Link darin öffnest.',
      });
    });

  // Strg/Cmd+A im Auswählen-Modus kreuzt alle sichtbaren Zeilen an — nur
  // dann, denn außerhalb gehört die Geste dem Browser (Text markieren), und
  // in Text-Eingaben bleibt sie es auch.
  const auswahlAktiv = auswahl !== null;
  useEffect(() => {
    if (!auswahlAktiv) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'a' || !(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return;
      const ziel = e.target as HTMLElement | null;
      const textFeld =
        ziel instanceof HTMLInputElement
          ? !['checkbox', 'radio', 'button'].includes(ziel.type)
          : ziel?.tagName === 'TEXTAREA' || Boolean(ziel?.isContentEditable);
      if (textFeld) return;
      e.preventDefault();
      setAuswahl(new Set(codes.map((c) => c.id)));
    };
    window.addEventListener('keydown', taste);
    return () => window.removeEventListener('keydown', taste);
  }, [auswahlAktiv, codes]);

  const sammelEntfernen = (ids: number[]) =>
    startTransition(async () => {
      const result = await sicher(zugangscodeSammelLoeschungAction)(ids);
      setSammelDialog(false);
      if (result.error) {
        melde({ton: 'fehler', titel: result.error, dauerhaft: true});
        return;
      }
      setAuswahl(null);
      melde({
        ton: 'hinweis',
        titel: 'Bestätigungsmail verschickt',
        text: 'Die Zugänge werden erst entfernt, wenn du den Link darin öffnest.',
      });
    });

  const gruppen = GRUPPEN.map((g) => ({...g, zeilen: codes.filter((c) => c.gruppe === g.schluessel)})).filter(
    (g) => g.zeilen.length > 0,
  );
  const mitUeberschrift = gruppen.length > 1;

  const zeileZeigen = (zeile: ZugangscodeZeile) => {
    return (
      <VStack key={zeile.id} gap={0} role="listitem">
        <Item
          label={zeile.dienst}
          description={zeile.konto ?? undefined}
          density="spacious"
          startContent={
            auswahl === null ? (
              <DienstZeichen dienst={zeile.dienst} />
            ) : (
              <HStack gap={2} vAlign="center" wrap="nowrap">
                <CheckboxInput
                  label={`${zeile.konto ? `${zeile.dienst} (${zeile.konto})` : zeile.dienst} auswählen`}
                  isLabelHidden
                  value={auswahl.has(zeile.id)}
                  onChange={(an) =>
                    setAuswahl((alt) => {
                      const neu = new Set(alt ?? []);
                      if (an) neu.add(zeile.id);
                      else neu.delete(zeile.id);
                      return neu;
                    })
                  }
                />
                <DienstZeichen dienst={zeile.dienst} />
              </HStack>
            )
          }
          endContent={
            <HStack gap={3} vAlign="center" wrap="nowrap">
              {/* Mit wem ein Zugang geteilt ist, liest sich als Reihe von
                  Gesichtern schneller als als Aufzählung von Namen — die
                  Namen selbst bleiben in der Sprechblase und in der
                  aufklappbaren Liste. Ein Kreis aus einer Person (der eigene)
                  und ein Rollenkreis haben keine Reihe: dort ist das Schild
                  die kürzere Auskunft. */}
              {zeile.kreisGesichter.length > 1 ? (
                <PersonenReihe
                  personen={zeile.kreisGesichter}
                  max={4}
                  groesse="winzig"
                  beschriftung={zeile.sichtbar ?? undefined}
                />
              ) : (
                zeile.sichtbar !== null && <Badge variant="neutral" label={zeile.sichtbar} />
              )}
              {zeile.code === null ? (
                <Badge
                  variant="error"
                  label="Geheimnis nicht lesbar"
                  icon={<Sinnbild sinn="warnung" groesse="zeile" />}
                />
              ) : (
                <HStack gap={2} vAlign="center" wrap="nowrap">
                  <CodeRing restMs={zeile.gueltigBisMs - jetztMs} periode={zeile.periode} />
                  <Text type="code" size="xl" hasTabularNumbers>
                    {/* Auf den Code geschlüsselt: ein neuer Wert ist ein neues
                        Element, und .code-wechsel (globals.css) lässt ihn das
                        letzte Stück von unten einsteigen — sonst wechselten
                        die Ziffern lautlos unter dem Blick des Abtippenden. */}
                    <span key={zeile.code} className="code-wechsel">
                      {gruppiert(zeile.code)}
                    </span>
                  </Text>
                </HStack>
              )}
              {zeile.code !== null && (
                /* Ohne Zeichen: „Kopieren" hat keinen Sinn im Vokabular,
                   und ein geliehenes Zeichen hieße dort etwas anderes.
                   Der Beleg des Gelingens ist der Beschriftungswechsel. */
                <Button
                  label={kopiertId === zeile.id ? 'Kopiert' : 'Kopieren'}
                  variant="ghost"
                  size="sm"
                  onClick={() => void kopieren(zeile)}
                />
              )}
              {darfErfassen && (
                <Button
                  label={zeile.gruppe === 'angepinnt' ? 'Pin lösen' : 'Anpinnen'}
                  tooltip={
                    darfVerwalten
                      ? 'Anpinnen – für dich, für Rollen oder für alle'
                      : zeile.gruppe === 'angepinnt' && !zeile.pin.selbst
                        ? 'Für dich angepinnt – der Pin gilt einem ganzen Kreis'
                        : zeile.gruppe === 'angepinnt'
                          ? 'Pin lösen'
                          : 'Für mich anpinnen'
                  }
                  variant="ghost"
                  size="sm"
                  isIconOnly
                  icon={<Sinnbild sinn="anpinnen" form={zeile.gruppe === 'angepinnt' ? 'voll' : 'umriss'} />}
                  onClick={() => {
                    if (darfVerwalten) {
                      setAnpinnen(zeile);
                      return;
                    }
                    if (zeile.gruppe === 'angepinnt' && !zeile.pin.selbst) {
                      melde({
                        ton: 'hinweis',
                        titel: 'Von der Verwaltung angepinnt',
                        text: 'Dieser Pin gilt für einen ganzen Kreis und kann nur dort gelöst werden.',
                      });
                      return;
                    }
                    startTransition(async () => {
                      const result = await sicher(zugangscodePinAction)(zeile.id, !zeile.pin.selbst);
                      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
                    });
                  }}
                />
              )}
              {/* Pflege gebündelt hinter dem Kopieren: erst die Handlung, die
                  jeden Besuch trägt, dann die seltenen — nur als Zeichen, damit
                  die Zeile dem Code das Gewicht lässt. */}
              {zeile.darfBearbeiten && (
                <HStack gap={1} vAlign="center" wrap="nowrap">
                  <Button
                    label="Bearbeiten"
                    tooltip="Zugang bearbeiten"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Sinnbild sinn="bearbeiten" />}
                    onClick={() => setBearbeiten(zeile)}
                  />
                  <Button
                    label="Entfernen"
                    tooltip="Zugang entfernen"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Sinnbild sinn="entfernen" />}
                    onClick={() => setLoeschen(zeile)}
                  />
                </HStack>
              )}
            </HStack>
          }
        />
        <Divider />
      </VStack>
    );
  };

  return (
    <VStack gap={4}>
      {darfVerwalten &&
        codes.length > 0 &&
        (auswahl === null ? (
          <HStack gap={2} justify="end">
            <Button label="Auswählen" variant="ghost" size="sm" onClick={() => setAuswahl(new Set())} />
          </HStack>
        ) : (
          <HStack gap={2} justify="end" vAlign="center">
            <Text type="supporting" color="secondary">
              {auswahl.size === 1 ? '1 Zugang ausgewählt' : `${auswahl.size} Zugänge ausgewählt`} · Strg/Cmd+A
              wählt alle
            </Text>
            <Button label="Abbrechen" variant="secondary" size="sm" onClick={() => setAuswahl(null)} />
            <Button
              label="Ausgewählte entfernen"
              variant="destructive"
              size="sm"
              icon={<Sinnbild sinn="entfernen" />}
              onClick={() => {
                if (auswahl.size === 0) {
                  melde({ton: 'hinweis', titel: 'Nichts ausgewählt', text: 'Bitte zuerst Zugänge ankreuzen.'});
                  return;
                }
                setSammelDialog(true);
              }}
            />
          </HStack>
        ))}
      {codes.length === 0 ? (
        <HStack paddingBlock={4} paddingInline={1} gap={3} vAlign="start" wrap="nowrap">
          <Sinnbild sinn="zugangscode" groesse="leer" ton="sekundaer" />
          <Text type="body" color="secondary">
            {gefiltert
              ? 'Kein Zugang passt zu Suche oder Filter.'
              : 'Noch kein Zugang hinterlegt. Beim Einrichten der Bestätigung in zwei Schritten zeigt jeder Dienst einen Schlüssel – hinterlege ihn hier, nur für dich oder geteilt.'}
          </Text>
        </HStack>
      ) : (
        <VStack gap={5}>
          {gruppen.map((gruppe) => (
            <VStack key={gruppe.schluessel} gap={2}>
              {mitUeberschrift && (
                <Text type="label" color="secondary">
                  {gruppe.titel}
                </Text>
              )}
              <VStack gap={0} role="list" aria-label={gruppe.titel}>
                <Divider />
                {gruppe.zeilen.map(zeileZeigen)}
              </VStack>
            </VStack>
          ))}
        </VStack>
      )}

      <TafelDialog
        isOpen={bearbeiten !== null}
        onOpenChange={(open) => {
          if (!open) setBearbeiten(null);
        }}
        purpose="form"
        width={480}
      >
        <DialogHeader
          title="Zugang bearbeiten"
          subtitle={
            bearbeiten ? (bearbeiten.konto ? `${bearbeiten.dienst} (${bearbeiten.konto})` : bearbeiten.dienst) : ''
          }
        />
        {bearbeiten && (
          <ZugangForm
            zeile={bearbeiten}
            selbstId={selbstId}
            darfVerwalten={darfVerwalten}
            personenWahl={personenWahl}
            rollenWahl={rollenWahl}
            onDone={() => {
              setBearbeiten(null);
              router.refresh();
            }}
          />
        )}
      </TafelDialog>

      <TafelDialog
        isOpen={anpinnen !== null}
        onOpenChange={(open) => {
          if (!open) setAnpinnen(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title="Zugang anpinnen"
          subtitle={anpinnen ? (anpinnen.konto ? `${anpinnen.dienst} (${anpinnen.konto})` : anpinnen.dienst) : ''}
        />
        {anpinnen && (
          <PinForm
            zeile={anpinnen}
            selbstId={selbstId}
            personenWahl={personenWahl}
            rollenWahl={rollenWahl}
            onDone={() => setAnpinnen(null)}
          />
        )}
      </TafelDialog>

      <TafelDialog
        isOpen={loeschen !== null}
        onOpenChange={(open) => {
          if (!open) setLoeschen(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title="Zugang entfernen"
          subtitle={loeschen ? (loeschen.konto ? `${loeschen.dienst} (${loeschen.konto})` : loeschen.dienst) : ''}
        />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Aus der Anwendung heraus wird nichts direkt gelöscht: du bekommst eine Bestätigungsmail an
            deine eigene Adresse, und erst der Link darin entfernt den Code – für seinen ganzen
            Leserkreis. Die Bestätigung in zwei Schritten beim Dienst selbst bleibt bestehen – ohne
            hinterlegten Schlüssel kann sich dort dann niemand mehr anmelden.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setLoeschen(null)} />
            <Button
              label="Bestätigungsmail senden"
              variant="destructive"
              isLoading={isPending}
              icon={<Sinnbild sinn="email" />}
              onClick={() => loeschen && entfernen(loeschen)}
            />
          </HStack>
        </VStack>
      </TafelDialog>

      <TafelDialog
        isOpen={sammelDialog}
        onOpenChange={(open) => {
          if (!open) setSammelDialog(false);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader
          title="Ausgewählte Zugänge entfernen"
          subtitle={auswahl ? `${auswahl.size} ${auswahl.size === 1 ? 'Zugang' : 'Zugänge'}` : ''}
        />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Wie beim einzelnen Entfernen wird nichts direkt gelöscht: du bekommst eine
            Bestätigungsmail an deine eigene Adresse, und erst der eine Link darin entfernt alle
            ausgewählten Zugänge auf einmal – für ihren ganzen Leserkreis.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setSammelDialog(false)} />
            <Button
              label="Bestätigungsmail senden"
              variant="destructive"
              isLoading={isPending}
              icon={<Sinnbild sinn="email" />}
              onClick={() => auswahl && sammelEntfernen([...auswahl])}
            />
          </HStack>
        </VStack>
      </TafelDialog>
    </VStack>
  );
}
