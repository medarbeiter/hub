'use client';

import {
  Badge,
  Banner,
  Button,
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
  zugangscodeLoeschungAnfordernAction,
  type ActionState,
} from '@/app/actions';
import {sicher, sicheresFormular} from '@/lib/aktion';
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
  gruppe: 'selbst' | 'geteilt' | 'alle';
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
 * Ein Formular für Anlegen und Bearbeiten — dieselben Felder, dieselbe
 * Reihenfolge: erst der Schlüssel (Scan oder Handeingabe), dann der Name,
 * dann der Leserkreis. Beim Bearbeiten darf der Schlüssel leer bleiben; das
 * gespeicherte Geheimnis bleibt dann und ist ohnehin nie wieder ablesbar.
 */
function ZugangForm({
  zeile,
  selbstId,
  darfVerwalten,
  personenWahl,
  rollenWahl,
  onDone,
}: KreisProps & {
  zeile: ZugangscodeZeile | null;
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
  const [kreis, setKreis] = useState<string>(kreisVorgabe);
  const [rollen, setRollen] = useState<string[]>(zeile?.kreis?.rollen ?? []);
  const [personen, setPersonen] = useState<string[]>(
    (zeile?.kreis?.personen ?? []).filter((id) => id !== selbstId).map(String),
  );

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

  /**
   * Was die Kamera oder ein Bild hergibt. Nur ein otpauth-Link ist hier ein
   * Treffer — jeder andere QR-Code (eine URL, eine Visitenkarte) wird benannt,
   * und weitergesucht wird trotzdem.
   */
  const erkannt = (text: string) => {
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
            label="Von Hand eingeben"
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
                : 'Beim Einrichten der Bestätigung in zwei Schritten zeigt der Dienst neben dem QR-Code einen Schlüssel („setup key“) oder einen otpauth-Link – Scan oder Handeingabe, beides genügt.'
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
 * Der Anlegen-Knopf samt Dialog — er steht im Werkzeugband des Kopfes, wo
 * jede Seite ihre eine Haupthandlung trägt (Abschluss, Berichte), statt unter
 * der Liste, wo er erst nach dem Scrollen sichtbar würde.
 */
export function ZugangAnlegen({selbstId, darfVerwalten, personenWahl, rollenWahl}: KreisProps) {
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
  {schluessel: 'selbst', titel: 'Nur für dich'},
  {schluessel: 'geteilt', titel: 'Geteilte Zugänge'},
  {schluessel: 'alle', titel: 'Für alle Angemeldeten'},
];

/**
 * Die Einmalcodes als dichte Zeilen, vom Persönlichen zum Gemeinsamen
 * gruppiert: erst die eigenen Schlüssel, dann die geteilten Kreise, dann der
 * Firmenbestand für alle. Die Überschriften erscheinen erst, wenn es mehr als
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
  gefiltert = false,
}: KreisProps & {
  codes: ZugangscodeZeile[];
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
        ? {ton: 'erfolg', titel: 'Zugang entfernt', text: `„${bestaetigt}" wurde gelöscht.`}
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
          startContent={<DienstZeichen dienst={zeile.dienst} />}
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
    </VStack>
  );
}
