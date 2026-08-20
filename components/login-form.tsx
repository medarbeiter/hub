'use client';

import {
  Banner,
  Button,
  Card,
  CheckboxInput,
  Heading,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import Image from 'next/image';
import {useActionState, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {
  eigenesPasswortAendernAction,
  googleOauthMockVerbindenAction,
  loginAction,
  logoutAction,
  onboardingCompleteAction,
  type ActionState,
  type LoginState,
  type PasswortState,
} from '@/app/actions';
import type {AvatarKey} from '@/lib/avatar';
import type {EinrichtungsDaten, OnboardingProfil, Startansicht} from '@/lib/onboarding';
import {AbsendeKnopf} from './absende-knopf';
import {PersonZeichen} from './person-zeichen';
import {ZUGANG_MERK_SCHLUESSEL, zugangMerkLesen, type ZugangMerk} from './zugang-merker';
import {GoogleAnmeldung} from './google-anmeldung';
import {GoogleKnopf} from './google-knopf';
import {AvatarAuswahl} from './avatar-auswahl';
import {ProfilbildFeld} from './profilbild-feld';
import {ProfilDaten} from './profil-daten';
import {Sinnbild, umriss} from './sinnbilder';

const LOGIN_INITIAL: LoginState = {error: null, einrichtung: null};
const SETUP_INITIAL: ActionState = {error: null};
const PASSWORT_INITIAL: PasswortState = {error: null, gespeichert: false};

type Schritt = 'passwort' | 'google' | 'stammdaten' | 'profil' | 'arbeitsplatz';
type Zugangsphase = 'anmeldung' | 'oeffnen' | 'einrichtung';
type Wechselphase = 'warten' | 'still' | 'abgang' | 'messen' | 'groesse' | 'eingang';

function bewegungReduziert(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function LoginForm({
  initialEinrichtung,
  googleHinweis = null,
  googleClientId = null,
  weiter = null,
}: {
  initialEinrichtung: EinrichtungsDaten | null;
  /** Deutsche Erklärung eines gescheiterten Google-Rücklaufs (`?google=…`). */
  googleHinweis?: string | null;
  /** Die öffentliche Client-ID — nur mit ihr erscheint die Google-Anmeldung. */
  googleClientId?: string | null;
  /** Serverseitig geprüftes Rücksprungziel einer App-Anmeldung (`?weiter=`). */
  weiter?: string | null;
}) {
  const [email, setEmail] = useState('');
  /* Erst nach dem ersten Anstrich gelesen: der Server kennt den Eintrag nicht,
     und eine Vorbelegung im ersten Anstrich wäre ein Hydrationsfehler. */
  const [merk, setMerk] = useState<ZugangMerk | null>(null);
  useEffect(() => {
    const gemerkt = zugangMerkLesen();
    if (!gemerkt) return;
    setMerk(gemerkt);
    setEmail((bisher) => bisher || gemerkt.email);
  }, []);
  const [password, setPassword] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [sichtbareEinrichtung, setSichtbareEinrichtung] = useState(initialEinrichtung);
  const [phase, setPhase] = useState<Zugangsphase>(initialEinrichtung ? 'einrichtung' : 'anmeldung');
  const [loginState, loginFormAction, loginPending] = useActionState(loginAction, LOGIN_INITIAL);
  const neueEinrichtung = loginState.einrichtung;

  useEffect(() => {
    if (!neueEinrichtung) return;
    // Die Schaltfläche quittiert die Prüfung bereits. Sobald die Antwort da ist,
    // öffnet sich deshalb ohne eine zweite, flüchtige Statuszeile das Zielblatt.
    setEmail('');
    setPassword('');
    setSichtbareEinrichtung(neueEinrichtung);
    setPhase('oeffnen');
    window.scrollTo({top: 0});
    const timer = window.setTimeout(
      () => setPhase('einrichtung'),
      bewegungReduziert() ? 0 : 700,
    );
    return () => window.clearTimeout(timer);
  }, [neueEinrichtung]);

  const fehler = loginState.error;

  return (
    <main className="zugang-seite">
      <VStack
        className="zugang-rahmen"
        data-phase={phase}
        width="100%"
        gap={4}
        paddingInline={4}
        hAlign="center"
      >
        <Card className="zugang-karte" padding={0} width="100%" elevation="med">
          <VStack gap={0}>
            <section
              className="zugang-anmeldung"
              aria-hidden={phase !== 'anmeldung'}
              inert={phase !== 'anmeldung' ? true : undefined}
            >
              <section>
                <VStack gap={0}>
                  <Zugangskopf titel="Anmelden" />
                  <section className="zugang-logininhalt">
                    <form
                      action={loginFormAction}
                      onKeyDown={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                      onKeyUp={(event) => setCapsLock(event.getModifierState('CapsLock'))}
                    >
                      <VStack gap={4} padding={5}>
                        {weiter && <input type="hidden" name="weiter" value={weiter} />}
                        {fehler && <Banner status="error" title={fehler} />}
                        {/* Wer hier zuletzt gearbeitet hat, steht mit Gesicht
                            da statt als leeres Feld — gemerkt vom Gerät, nicht
                            nachgeschlagen (siehe zugang-merker.tsx). „Nicht
                            du?" vergisst es wieder. */}
                        {merk && (
                          <HStack gap={3} vAlign="center" justify="between" wrap="nowrap">
                            {/* Ohne Personenkarte: diese Seite schlägt niemanden
                                nach (siehe zugang-merker.tsx), und eine Karte,
                                die nur wiederholt, was zwei Zentimeter weiter
                                rechts steht, wäre ein Klick ins Leere. */}
                            <PersonZeichen
                              person={{id: 0, name: merk.name, bild: merk.bild}}
                              groesse="karte"
                              mitName
                              betont
                              karte={false}
                              unterzeile={merk.email}
                            />
                            <Button
                              label="Nicht du?"
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => {
                                window.localStorage.removeItem(ZUGANG_MERK_SCHLUESSEL);
                                setMerk(null);
                                setEmail('');
                              }}
                            />
                          </HStack>
                        )}
                        <TextInput
                          label="E-Mail"
                          type="email"
                          startIcon={umriss('email')}
                          value={email}
                          onChange={setEmail}
                          htmlName="email"
                          placeholder="vorname.name@firma.de"
                          isDisabled={loginPending}
                        />
                        <TextInput
                          label="Passwort"
                          type="password"
                          startIcon={umriss('gesperrt')}
                          value={password}
                          onChange={setPassword}
                          htmlName="password"
                          placeholder="Dein Passwort"
                          isDisabled={loginPending}
                          status={capsLock ? {type: 'warning', message: 'Feststelltaste ist aktiviert.'} : undefined}
                        />
                        <Text type="supporting" color="secondary" as="p">
                          Passwort vergessen? Die Verwaltung kann dir ein neues ausstellen.
                        </Text>
                        <Button
                          label="Anmelden"
                          variant="primary"
                          size="lg"
                          type="submit"
                          width="100%"
                          isLoading={loginPending}
                        />
                        {googleClientId && phase === 'anmeldung' && (
                          <GoogleAnmeldung clientId={googleClientId} weiter={weiter} />
                        )}
                      </VStack>
                    </form>
                  </section>
                </VStack>
              </section>
            </section>

            <section
              className="zugang-einrichtung"
              aria-hidden={phase !== 'einrichtung'}
              inert={phase !== 'einrichtung' ? true : undefined}
              data-bereit={phase === 'einrichtung' ? 'true' : 'false'}
            >
              <section>
                {sichtbareEinrichtung && (
                  <Einrichtung daten={sichtbareEinrichtung} bereit={phase === 'einrichtung'} googleHinweis={googleHinweis} />
                )}
              </section>
            </section>
          </VStack>
        </Card>

        {phase === 'einrichtung' && sichtbareEinrichtung && (
          <form action={logoutAction}>
            <AbsendeKnopf label="Mit einem anderen Konto anmelden" variant="ghost" />
          </form>
        )}
      </VStack>
    </main>
  );
}

function Zugangskopf({
  titel,
  zaehler,
  wechselphase = 'still',
}: {
  titel: string;
  zaehler?: string;
  wechselphase?: Wechselphase;
}) {
  return (
    <HStack
      className="zugang-kopf"
      gap={3}
      paddingInline={5}
      paddingBlock={3}
      vAlign="center"
      justify="between"
      wrap="nowrap"
    >
      <HStack className="zugang-kopf-start" gap={3} vAlign="center" wrap="nowrap">
        <Image className="zugang-logo-marke" src="/logo-mark.png" alt="MedArbeiter" width={40} height={40} priority />
        <Heading
          key={titel}
          className="zugang-schritttitel"
          data-wechsel={wechselphase}
          level={1}
        >
          {titel}
        </Heading>
      </HStack>
      {zaehler && (
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {zaehler}
        </Text>
      )}
    </HStack>
  );
}

function Einrichtung({
  daten,
  bereit,
  googleHinweis,
}: {
  daten: EinrichtungsDaten;
  bereit: boolean;
  googleHinweis: string | null;
}) {
  const {profil, initial} = daten;
  const schritte: Schritt[] = [
    ...(daten.passwortwechselNoetig ? ['passwort' as const] : []),
    ...(daten.googleOauthNoetig ? ['google' as const] : []),
    'stammdaten',
    'profil',
    'arbeitsplatz',
  ];
  const [index, setIndex] = useState(0);
  const [wechselphase, setWechselphase] = useState<Wechselphase>(
    bereit ? 'eingang' : 'warten',
  );
  const wechselTimer = useRef<number | null>(null);
  const alteHoehe = useRef(0);
  const buehneRef = useRef<HTMLElement | null>(null);
  const schrittRef = useRef<HTMLElement | null>(null);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [startansicht, setStartansicht] = useState<Startansicht>(initial.startansicht);
  const [hinweise, setHinweise] = useState(initial.hinweiseZuOffenenTagen);
  const [avatar, setAvatar] = useState<AvatarKey>(initial.avatar);
  const schritt = schritte[index]!;

  useEffect(() => {
    if (!bereit || wechselphase !== 'warten') return;
    setWechselphase('eingang');
    wechselTimer.current = window.setTimeout(() => setWechselphase('still'), bewegungReduziert() ? 0 : 520);
  }, [bereit, wechselphase]);

  useEffect(() => () => {
    if (wechselTimer.current !== null) window.clearTimeout(wechselTimer.current);
  }, []);

  useLayoutEffect(() => {
    if (wechselphase !== 'messen' || !buehneRef.current || !schrittRef.current) return;
    const buehne = buehneRef.current;
    const neueHoehe = schrittRef.current.scrollHeight;
    if (bewegungReduziert()) {
      buehne.style.height = 'auto';
      setWechselphase('still');
      return;
    }
    buehne.style.height = `${alteHoehe.current}px`;
    const animation = buehne.animate(
      [{height: `${alteHoehe.current}px`}, {height: `${neueHoehe}px`}],
      {duration: 520, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', fill: 'forwards'},
    );
    animation.onfinish = () => {
      buehne.style.height = 'auto';
      setWechselphase('eingang');
      wechselTimer.current = window.setTimeout(() => setWechselphase('still'), 320);
      window.scrollTo({top: 0, behavior: 'smooth'});
    };
    return () => animation.cancel();
  }, [index, wechselphase]);

  const wechsleZu = (ziel: number) => {
    if (ziel < 0 || ziel >= schritte.length || ziel === index || !['still', 'eingang'].includes(wechselphase)) return;
    if (bewegungReduziert()) {
      setIndex(ziel);
      setWechselphase('still');
      window.scrollTo({top: 0});
      return;
    }
    alteHoehe.current = schrittRef.current?.scrollHeight ?? 0;
    setWechselphase('abgang');
    wechselTimer.current = window.setTimeout(() => {
      setIndex(ziel);
      setWechselphase('messen');
    }, 180);
  };

  const titel: Record<Schritt, string> = {
    passwort: 'Passwort festlegen',
    google: 'Firmenkonto verknüpfen',
    stammdaten: 'Stammdaten prüfen',
    profil: 'Profilfigur wählen',
    arbeitsplatz: 'Startansicht festlegen',
  };

  return (
    <VStack className="zugang-einrichtung-inhalt" gap={0} data-bereit={bereit ? 'true' : 'false'}>
      <Zugangskopf
        titel={titel[schritt]}
        zaehler={`${index + 1} / ${schritte.length}`}
        wechselphase={wechselphase}
      />

      <section className="zugang-schritt-buehne" ref={buehneRef} aria-busy={!['still', 'eingang'].includes(wechselphase)}>
        <section
          key={schritt}
          ref={schrittRef}
          className="zugang-schritt"
          data-schritt={schritt}
          data-wechsel={wechselphase}
        >
          <VStack className="zugang-schritt-inhalt" gap={4} paddingInline={5} paddingBlock={4}>
            {schritt === 'passwort' && (
              <PasswortSchritt weiter={() => wechsleZu(index + 1)} />
            )}
            {schritt === 'google' && (
              <GoogleOauthSchritt
                email={profil.email}
                konfiguriert={daten.googleKonfiguriert}
                clientId={daten.googleClientId}
                mock={daten.googleMock}
                hinweis={googleHinweis}
                weiter={() => wechsleZu(index + 1)}
              />
            )}
            {schritt === 'stammdaten' && (
              <StammdatenSchritt
                profil={profil}
                bestaetigt={bestaetigt}
                setBestaetigt={setBestaetigt}
                weiter={() => wechsleZu(index + 1)}
                zurueck={index > 0 ? () => wechsleZu(index - 1) : null}
              />
            )}
            {schritt === 'profil' && (
              <ProfilSchritt
                userId={daten.userId}
                hatProfilbild={daten.hatProfilbild}
                avatar={avatar}
                setAvatar={setAvatar}
                weiter={() => wechsleZu(index + 1)}
                zurueck={() => wechsleZu(index - 1)}
              />
            )}
            {schritt === 'arbeitsplatz' && (
              <ArbeitsplatzSchritt
                avatar={avatar}
                startansicht={startansicht}
                setStartansicht={setStartansicht}
                hinweise={hinweise}
                setHinweise={setHinweise}
                bestaetigt={bestaetigt}
                zurueck={() => wechsleZu(index - 1)}
              />
            )}
          </VStack>
        </section>
      </section>
    </VStack>
  );
}

function PasswortSchritt({weiter}: {weiter: () => void}) {
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [state, formAction, isPending] = useActionState(eigenesPasswortAendernAction, PASSWORT_INITIAL);
  const weiterGeplant = useRef(false);

  useEffect(() => {
    if (!state.gespeichert || weiterGeplant.current) return;
    weiterGeplant.current = true;
    const timer = window.setTimeout(weiter, bewegungReduziert() ? 0 : 420);
    return () => window.clearTimeout(timer);
  }, [state.gespeichert, weiter]);

  return (
    <form action={formAction}>
      <VStack className="zugang-schritt-staffel" gap={4}>
        {state.error && <Banner status="error" title={state.error} />}
        <VStack gap={3}>
          <TextInput
            label="Neues Passwort"
            type="password"
            startIcon={umriss('passwort')}
            value={passwort}
            onChange={setPasswort}
            htmlName="neuesPasswort"
            description="Mindestens 12 Zeichen sowie mindestens ein Buchstabe und eine Zahl."
            isDisabled={isPending || state.gespeichert}
          />
          <TextInput
            label="Neues Passwort wiederholen"
            type="password"
            startIcon={umriss('bestaetigen')}
            value={wiederholung}
            onChange={setWiederholung}
            htmlName="passwortWiederholung"
            isDisabled={isPending || state.gespeichert}
          />
        </VStack>
        <HStack className="zugang-schritt-aktionen" justify="end">
          <Button
            label="Passwort speichern"
            variant="primary"
            type="submit"
            icon={<Sinnbild sinn="bestaetigen" />}
            isLoading={isPending}
            isDisabled={state.gespeichert}
          />
        </HStack>
      </VStack>
    </form>
  );
}

/**
 * Der bevorzugte Weg ist Googles eigener, personalisierter Knopf samt
 * One-Tap-Hinweis (`GoogleKnopf`): der Browser kennt seine Google-Sitzung und
 * schlägt das Konto vor, die Kalender-Freigabe kommt im Popup, und die Seite
 * lädt danach neu — ohne diesen Schritt, weil er erledigt ist. Der
 * Weiterleitungs-Knopf darunter bleibt der Rückweg für Browser, in denen das
 * GIS-Skript nicht lädt. Ein Fehlschlag kommt als `hinweis` zurück. Der
 * simulierte Knopf existiert nur noch, wenn MOCK_GOOGLE_OAUTH=1 ihn für
 * Entwicklung ohne Zugangsdaten freischaltet.
 */
function GoogleOauthSchritt({
  email,
  konfiguriert,
  clientId,
  mock,
  hinweis,
  weiter,
}: {
  email: string;
  konfiguriert: boolean;
  clientId: string | null;
  mock: boolean;
  hinweis: string | null;
  weiter: () => void;
}) {
  const [state, formAction, isPending] = useActionState(googleOauthMockVerbindenAction, PASSWORT_INITIAL);
  const [leiteWeiter, setLeiteWeiter] = useState(false);
  const weiterGeplant = useRef(false);

  useEffect(() => {
    if (!state.gespeichert || weiterGeplant.current) return;
    weiterGeplant.current = true;
    const timer = window.setTimeout(weiter, bewegungReduziert() ? 0 : 520);
    return () => window.clearTimeout(timer);
  }, [state.gespeichert, weiter]);

  return (
    <VStack className="zugang-schritt-staffel" gap={4}>
      {hinweis && <Banner status="error" title={hinweis} />}
      {state.error && <Banner status="error" title={state.error} />}
      <Text type="supporting" color="secondary" as="p">
        Dein Google Kalender erhält deine genehmigten Urlaube und gemeldeten Abwesenheiten
        automatisch. Krankmeldungen erscheinen dort nur als „Abwesend“.
      </Text>
      <VStack className="zugang-identitaet" gap={0.5} paddingBlock={3}>
        <Text type="supporting" color="secondary">Firmen-E-Mail</Text>
        <Text weight="medium" as="p">{email}</Text>
      </VStack>
      {!konfiguriert && !mock && (
        <Banner
          status="warning"
          title="Die Google-Anbindung ist noch nicht eingerichtet"
          description="Bitte die Verwaltung, die Google-Zugangsdaten der Anwendung zu hinterlegen. Ohne die Verknüpfung kann die Einrichtung nicht abgeschlossen werden."
        />
      )}
      {konfiguriert && clientId && <GoogleKnopf clientId={clientId} zurueckPfad="/login" />}
      {konfiguriert && (
        <HStack className="zugang-schritt-aktionen" justify="end">
          <Button
            label="Über Weiterleitung verbinden"
            variant={clientId ? 'ghost' : 'primary'}
            isLoading={leiteWeiter}
            onClick={() => {
              setLeiteWeiter(true);
              window.location.assign('/api/google/start?zurueck=login');
            }}
          />
        </HStack>
      )}
      {!konfiguriert && mock && (
        <form action={formAction}>
          <HStack className="zugang-schritt-aktionen" justify="end">
            <Button
              label="Verknüpfung simulieren (Entwicklung)"
              variant="primary"
              type="submit"
              isLoading={isPending}
              isDisabled={state.gespeichert}
            />
          </HStack>
        </form>
      )}
    </VStack>
  );
}

function StammdatenSchritt({
  profil,
  bestaetigt,
  setBestaetigt,
  weiter,
  zurueck,
}: {
  profil: OnboardingProfil;
  bestaetigt: boolean;
  setBestaetigt: (value: boolean) => void;
  weiter: () => void;
  zurueck: (() => void) | null;
}) {
  return (
    <>
      <ProfilDaten profil={profil} variante="pruefung" />
      {!profil.bundesland && (
        <Banner
          status="warning"
          title="Kein Feiertagskalender hinterlegt"
          description="Du kannst fortfahren. Bitte die Verwaltung, ein Bundesland für dich oder das Unternehmen einzutragen."
        />
      )}
      {profil.stammdatenFehler && (
        <Banner
          status="error"
          title="Die Einrichtung ist noch nicht vollständig"
          description={`${profil.stammdatenFehler} Bitte wende dich an die Verwaltung.`}
        />
      )}
      <CheckboxInput
        label="Ja, diese Angaben sind richtig."
        description="Deine Bestätigung wird protokolliert. Nach einer Änderung wirst du erneut gefragt."
        value={bestaetigt}
        onChange={setBestaetigt}
        isDisabled={Boolean(profil.stammdatenFehler)}
        disabledMessage="Die Verwaltung muss zuerst die Stammdaten korrigieren."
        width="100%"
      />
      <SchrittNavigation
        zurueck={zurueck}
        weiter={weiter}
        weiterDeaktiviert={!bestaetigt || Boolean(profil.stammdatenFehler)}
      />
    </>
  );
}

/**
 * Das Zeichen der eigenen Person — dasselbe Feld wie im Profil und darüber der
 * Bildbogen als Rückfall. Wer erst nach der Einrichtung ein Foto hochladen
 * konnte, trug bis dahin eine Figur, die niemand gewählt hatte; und ein Bild
 * ist genau in dem Moment zur Hand, in dem man sein Konto einrichtet.
 */
function ProfilSchritt({
  userId,
  hatProfilbild,
  avatar,
  setAvatar,
  weiter,
  zurueck,
}: {
  userId: number;
  hatProfilbild: boolean;
  avatar: AvatarKey;
  setAvatar: (value: AvatarKey) => void;
  weiter: () => void;
  zurueck: () => void;
}) {
  // Eigener Stand statt Prop: der Assistent hat seine Serverdaten beim
  // Betreten eingefroren, also sagt das Bildfeld selbst Bescheid.
  const [hatBild, setHatBild] = useState(hatProfilbild);
  return (
    <>
      <ProfilbildFeld hatBild={hatProfilbild} userId={userId} onBild={setHatBild} />
      <AvatarAuswahl value={avatar} onChange={setAvatar} hatBild={hatBild} />
      <SchrittNavigation zurueck={zurueck} weiter={weiter} />
    </>
  );
}

function ArbeitsplatzSchritt({
  avatar,
  startansicht,
  setStartansicht,
  hinweise,
  setHinweise,
  bestaetigt,
  zurueck,
}: {
  avatar: AvatarKey;
  startansicht: Startansicht;
  setStartansicht: (value: Startansicht) => void;
  hinweise: boolean;
  setHinweise: (value: boolean) => void;
  bestaetigt: boolean;
  zurueck: () => void;
}) {
  const [state, formAction, isPending] = useActionState(onboardingCompleteAction, SETUP_INITIAL);
  return (
    <form action={formAction}>
      <VStack className="zugang-schritt-staffel" gap={4}>
        {state.error && <Banner status="error" title={state.error} />}
        <VStack className="zugang-einstellungsgruppe" gap={4} paddingBlock={3}>
          <VStack gap={0.5}>
            <Text type="label" weight="medium">Startansicht</Text>
            <Text type="supporting" color="secondary" as="p">
              Diese Ansicht öffnet sich direkt nach jeder Anmeldung.
            </Text>
          </VStack>
          <SegmentedControl
            label="Startansicht nach der Anmeldung"
            value={startansicht}
            onChange={(value) => setStartansicht(value as Startansicht)}
            layout="fill"
          >
            <SegmentedControlItem value="tag" label="Tag" icon={<Sinnbild sinn="tag" />} />
            <SegmentedControlItem value="woche" label="Woche" icon={<Sinnbild sinn="woche" />} />
            <SegmentedControlItem value="monat" label="Monat" icon={<Sinnbild sinn="monat" />} />
            <SegmentedControlItem value="konto" label="Konto" icon={<Sinnbild sinn="konto" />} />
          </SegmentedControl>
          <VStack className="zugang-hinweis-einstellung" gap={2} paddingBlock={3}>
            <Text type="label" weight="medium">Hinweise</Text>
            <Switch
              label="An offene Tage erinnern"
              description="Zeigt einen bleibenden Hinweis, wenn vergangene Tage noch geprüft werden müssen."
              value={hinweise}
              onChange={setHinweise}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
            />
          </VStack>
        </VStack>
        <input type="hidden" name="datenBestaetigt" value={bestaetigt ? 'ja' : 'nein'} />
        <input type="hidden" name="avatar" value={avatar} />
        <input type="hidden" name="startansicht" value={startansicht} />
        <input type="hidden" name="hinweiseZuOffenenTagen" value={hinweise ? 'ja' : 'nein'} />
        <HStack className="zugang-schritt-aktionen" justify="between" gap={3} wrap="wrap">
          <Button
            label="Zurück"
            variant="secondary"
            type="button"
            icon={<Sinnbild sinn="zurueck" />}
            onClick={zurueck}
            isDisabled={isPending}
          />
          <Button
            label="Arbeitsplatz öffnen"
            variant="primary"
            type="submit"
            icon={<Sinnbild sinn="bestaetigen" />}
            isLoading={isPending}
          />
        </HStack>
      </VStack>
    </form>
  );
}

function SchrittNavigation({
  zurueck,
  weiter,
  weiterDeaktiviert = false,
}: {
  zurueck: (() => void) | null;
  weiter: () => void;
  weiterDeaktiviert?: boolean;
}) {
  return (
    <HStack className="zugang-schritt-aktionen" justify={zurueck ? 'between' : 'end'} gap={3} wrap="wrap">
      {zurueck && (
        <Button
          label="Zurück"
          variant="secondary"
          type="button"
          icon={<Sinnbild sinn="zurueck" />}
          onClick={zurueck}
        />
      )}
      <Button
        label="Weiter"
        variant="primary"
        type="button"
        icon={<Sinnbild sinn="weiter" />}
        isDisabled={weiterDeaktiviert}
        onClick={weiter}
      />
    </HStack>
  );
}
