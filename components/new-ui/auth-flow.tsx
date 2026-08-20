'use client';

import {
  Banner,
  Button,
  Card,
  CheckboxInput,
  Divider,
  Heading,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Text,
  TextInput,
} from '@astryxdesign/core';
import Image from 'next/image';
import {useActionState, useEffect, useRef, useState, type ReactNode} from 'react';
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
import {AvatarAuswahl} from '@/components/avatar-auswahl';
import type {AvatarKey} from '@/lib/avatar';
import type {
  EinrichtungsDaten,
  OnboardingProfil,
  Startansicht,
} from '@/lib/onboarding';
import {GoogleAnmeldeKnopf, GoogleVerknuepfung} from './google-controls';

const LOGIN_INITIAL: LoginState = {error: null, einrichtung: null};
const SETUP_INITIAL: ActionState = {error: null};
const PASSWORT_INITIAL: PasswortState = {error: null, gespeichert: false};

type Schritt = 'passwort' | 'google' | 'stammdaten' | 'profil' | 'arbeitsplatz';

/** Der Titel steht im Kopf des Schritts, die Frage in der Bühne darunter. */
const SCHRITT_TITEL: Record<Schritt, string> = {
  passwort: 'Passwort',
  google: 'Google',
  stammdaten: 'Stammdaten',
  profil: 'Profilfigur',
  arbeitsplatz: 'Arbeitsplatz',
};

function nachObenRollen(weich = false) {
  const ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.scrollTo({top: 0, behavior: weich && !ruhig ? 'smooth' : 'auto'});
}

/* -------------------------------------------------------------------------- */
/*  Gemeinsame Bausteine                                                       */
/* -------------------------------------------------------------------------- */

function Marke() {
  return (
    <div className="flex items-center justify-center gap-2.5">
      <Image alt="" className="rounded-xl" height={40} priority src="/logo-mark.png" width={40} />
      <span className="text-[17px] font-semibold tracking-tight">MedArbeiter Hub</span>
    </div>
  );
}

/** Kopf einer Bühne: Überschrift und ein Satz darunter, sonst nichts. */
function Bühnenkopf({titel, satz}: {titel: string; satz: string}) {
  return (
    <div className="flex flex-col gap-2">
      <Heading className="tracking-tight text-balance" level={2}>
        {titel}
      </Heading>
      <Text className="max-w-[46ch] text-pretty" as="p" color="secondary" type="supporting">
        {satz}
      </Text>
    </div>
  );
}

/** Die Fußzeile jedes Schritts: zurück links, weiter rechts, nie umgekehrt. */
function Schrittfuss({
  zurueck,
  children,
}: {
  zurueck: (() => void) | null;
  children: ReactNode;
}) {
  return (
    <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-separator pt-6">
      {zurueck ? (
        <Button label="Zurück" size="lg" type="button" variant="ghost" onClick={zurueck} />
      ) : (
        <span />
      )}
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Anmeldung                                                                  */
/* -------------------------------------------------------------------------- */

export function NewAuthFlow({
  initialSetup,
  googleMessage,
  googleClientId,
}: {
  initialSetup: EinrichtungsDaten | null;
  googleMessage: string | null;
  googleClientId: string | null;
}) {
  const [einrichtung, setEinrichtung] = useState(initialSetup);
  const [loginState, loginAbsenden, loginLaeuft] = useActionState(loginAction, LOGIN_INITIAL);

  useEffect(() => {
    if (!loginState.einrichtung) return;
    setEinrichtung(loginState.einrichtung);
    nachObenRollen();
  }, [loginState.einrichtung]);

  return (
    <main className="access-page min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-[42rem] flex-col justify-center gap-8 px-5 py-10 sm:py-16">
        <Marke />
        {einrichtung ? (
          <Einrichtung daten={einrichtung} googleHinweis={googleMessage} />
        ) : (
          <Anmeldung
            absenden={loginAbsenden}
            clientId={googleClientId}
            fehler={loginState.error}
            laeuft={loginLaeuft}
          />
        )}
      </div>
    </main>
  );
}

function Anmeldung({
  absenden,
  fehler,
  laeuft,
  clientId,
}: {
  absenden: (payload: FormData) => void;
  fehler: string | null;
  laeuft: boolean;
  clientId: string | null;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [feststelltaste, setFeststelltaste] = useState(false);

  return (
    <div className="mx-auto flex w-full max-w-[27rem] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Heading className="text-center tracking-tight" level={1}>
          Willkommen zurück
        </Heading>
        <Text as="p" className="text-center" color="secondary" type="supporting">
          Melde dich an, um deine Zeit zu erfassen.
        </Text>
      </div>

      <Card className="p-7 sm:p-8">
        <form
          action={absenden}
          className="flex flex-col gap-5"
          onKeyDown={(event) => setFeststelltaste(event.getModifierState('CapsLock'))}
          onKeyUp={(event) => setFeststelltaste(event.getModifierState('CapsLock'))}
        >
          {fehler && <Banner status="error" title={fehler} />}

          <TextInput
            htmlName="email"
            isDisabled={laeuft}
            label="E-Mail"
            onChange={setEmail}
            placeholder="vorname.name@firma.de"
            type="email"
            value={email}
            width="100%"
          />

          <TextInput
            htmlName="password"
            isDisabled={laeuft}
            label="Passwort"
            onChange={setPassword}
            placeholder="Dein Passwort"
            status={feststelltaste ? {type: 'warning', message: 'Feststelltaste ist aktiviert.'} : undefined}
            type="password"
            value={password}
            width="100%"
          />

          <Button
            className="mt-1"
            isLoading={laeuft}
            label="Anmelden"
            size="lg"
            type="submit"
            variant="primary"
            width="100%"
          />
        </form>

        {clientId && (
          <>
            <Divider className="my-6" label="oder" />
            <GoogleAnmeldeKnopf clientId={clientId} />
          </>
        )}
      </Card>

      <Text as="p" className="text-center" color="secondary" type="supporting">
        Passwort vergessen? Die Verwaltung stellt dir ein neues Startpasswort aus.
      </Text>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Einrichtung                                                                */
/* -------------------------------------------------------------------------- */

function Einrichtung({
  daten,
  googleHinweis,
}: {
  daten: EinrichtungsDaten;
  googleHinweis: string | null;
}) {
  const schritte: Schritt[] = [
    ...(daten.passwortwechselNoetig ? (['passwort'] as const) : []),
    ...(daten.googleOauthNoetig ? (['google'] as const) : []),
    'stammdaten',
    'profil',
    'arbeitsplatz',
  ];
  const [index, setIndex] = useState(0);
  const [bestaetigt, setBestaetigt] = useState(false);
  const [startansicht, setStartansicht] = useState<Startansicht>(daten.initial.startansicht);
  const [hinweise, setHinweise] = useState(daten.initial.hinweiseZuOffenenTagen);
  const [avatar, setAvatar] = useState<AvatarKey>(daten.initial.avatar);
  const schritt = schritte[index]!;

  const geheZu = (ziel: number) => {
    if (ziel < 0 || ziel >= schritte.length) return;
    setIndex(ziel);
    nachObenRollen(true);
  };
  const weiter = () => geheZu(index + 1);
  const zurueck = index > 0 ? () => geheZu(index - 1) : null;

  return (
    <div className="mx-auto flex w-full flex-col gap-6">
      <Card className="overflow-hidden" padding={0}>
        <div className="flex flex-col gap-4 px-7 pt-7 sm:px-10 sm:pt-9">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-xs font-semibold tracking-[0.08em] text-muted uppercase">
              Einrichtung
            </span>
            <span className="text-xs text-muted tabular-nums">
              Schritt {index + 1} von {schritte.length}
            </span>
          </div>
          {/* Der Fortschritt als ein Riegel je Schritt: er sagt zugleich, wie
              viele es sind und wo man steht — ein durchgehender Balken sagt
              nur das Zweite. */}
          <ol className="flex gap-1.5" aria-label="Fortschritt der Einrichtung">
            {schritte.map((eintrag, stelle) => (
              <li
                key={eintrag}
                aria-current={stelle === index ? 'step' : undefined}
                className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                  stelle <= index ? 'bg-accent' : 'bg-default'
                }`}
              >
                <span className="sr-only">
                  {SCHRITT_TITEL[eintrag]}
                  {stelle < index ? ' (erledigt)' : ''}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div key={schritt} className="flex flex-col gap-7 p-7 sm:p-10">
          {schritt === 'passwort' && <PasswortSchritt weiter={weiter} />}
          {schritt === 'google' && (
            <GoogleSchritt daten={daten} hinweis={googleHinweis} weiter={weiter} />
          )}
          {schritt === 'stammdaten' && (
            <StammdatenSchritt
              bestaetigt={bestaetigt}
              profil={daten.profil}
              setBestaetigt={setBestaetigt}
              weiter={weiter}
              zurueck={zurueck}
            />
          )}
          {schritt === 'profil' && (
            <ProfilSchritt setWert={setAvatar} weiter={weiter} wert={avatar} zurueck={zurueck} />
          )}
          {schritt === 'arbeitsplatz' && (
            <ArbeitsplatzSchritt
              avatar={avatar}
              bestaetigt={bestaetigt}
              hinweise={hinweise}
              setHinweise={setHinweise}
              setStartansicht={setStartansicht}
              startansicht={startansicht}
              zurueck={zurueck}
            />
          )}
        </div>
      </Card>

      <form action={logoutAction} className="text-center">
        <input name="zurueck" type="hidden" value="/new/login" />
        <Button label="Mit einem anderen Konto anmelden" size="sm" type="submit" variant="ghost" />
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PasswortSchritt({weiter}: {weiter: () => void}) {
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [state, absenden, laeuft] = useActionState(
    eigenesPasswortAendernAction,
    PASSWORT_INITIAL,
  );
  const weitergereicht = useRef(false);

  useEffect(() => {
    if (!state.gespeichert || weitergereicht.current) return;
    weitergereicht.current = true;
    weiter();
  }, [state.gespeichert, weiter]);

  // Die Regeln stehen als Liste da und haken sich beim Tippen selbst ab: die
  // Prüfung findet vor dem Absenden statt, nicht als Fehler danach.
  const regeln = [
    {text: 'Mindestens 12 Zeichen', erfuellt: passwort.length >= 12},
    {text: 'Mindestens ein Buchstabe', erfuellt: /[A-Za-zÄÖÜäöüß]/.test(passwort)},
    {text: 'Mindestens eine Zahl', erfuellt: /\d/.test(passwort)},
    {
      text: 'Beide Eingaben stimmen überein',
      erfuellt: wiederholung.length > 0 && passwort === wiederholung,
    },
  ];
  const vollstaendig = regeln.every((regel) => regel.erfuellt);

  return (
    <form action={absenden} className="flex flex-col gap-7">
      <Bühnenkopf
        satz="Dein Startpasswort war nur für die erste Anmeldung gedacht. Wähle jetzt eines, das nur du kennst."
        titel="Mach dein Konto zu deinem"
      />
      {state.error && <Banner status="error" title={state.error} />}

      <div className="flex flex-col gap-5">
        <TextInput
          hasAutoFocus
          htmlName="neuesPasswort"
          isDisabled={laeuft || state.gespeichert}
          label="Neues Passwort"
          onChange={setPasswort}
          type="password"
          value={passwort}
          width="100%"
        />

        <TextInput
          htmlName="passwortWiederholung"
          isDisabled={laeuft || state.gespeichert}
          label="Neues Passwort wiederholen"
          onChange={setWiederholung}
          type="password"
          value={wiederholung}
          width="100%"
        />
      </div>

      <ul aria-label="Anforderungen an das Passwort" className="flex flex-col gap-2">
        {regeln.map((regel) => (
          <li
            key={regel.text}
            className={`flex items-center gap-2.5 text-sm transition-colors duration-200 ${
              regel.erfuellt ? 'text-foreground' : 'text-muted'
            }`}
          >
            <span
              aria-hidden="true"
              className={`size-3.5 shrink-0 rounded-full border transition-colors duration-200 ${
                regel.erfuellt ? 'border-success bg-success' : 'border-field-border'
              }`}
            />
            {regel.text}
          </li>
        ))}
      </ul>

      <Schrittfuss zurueck={null}>
        <Button
          isDisabled={!vollstaendig || state.gespeichert}
          isLoading={laeuft}
          label="Passwort speichern"
          size="lg"
          type="submit"
          variant="primary"
        />
      </Schrittfuss>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function GoogleSchritt({
  daten,
  hinweis,
  weiter,
}: {
  daten: EinrichtungsDaten;
  hinweis: string | null;
  weiter: () => void;
}) {
  const [state, absenden, laeuft] = useActionState(
    googleOauthMockVerbindenAction,
    PASSWORT_INITIAL,
  );

  return (
    <div className="flex flex-col gap-7">
      <Bühnenkopf
        satz="Genehmigte Urlaube und gemeldete Abwesenheiten landen automatisch in deinem Google Kalender. Eine Krankmeldung erscheint dort nur als „Abwesend“."
        titel="Dein Kalender, automatisch aktuell"
      />
      {state.error && <Banner status="error" title={state.error} />}
      <GoogleVerknuepfung
        clientId={daten.googleClientId}
        email={daten.profil.email}
        gespeichert={state.gespeichert}
        hinweis={hinweis}
        konfiguriert={daten.googleKonfiguriert}
        laeuft={laeuft}
        mock={daten.googleMock}
        mockAbsenden={absenden}
        weiter={weiter}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function StammdatenSchritt({
  profil,
  bestaetigt,
  setBestaetigt,
  weiter,
  zurueck,
}: {
  profil: OnboardingProfil;
  bestaetigt: boolean;
  setBestaetigt: (wert: boolean) => void;
  weiter: () => void;
  zurueck: (() => void) | null;
}) {
  const stunden = Math.floor(profil.wochenMinuten / 60);
  const minuten = profil.wochenMinuten % 60;
  const zeilen: Array<[string, string]> = [
    ['Name', profil.name],
    ['E-Mail', profil.email],
    ['Rolle', profil.rolle],
    ['Wochen-Sollzeit', minuten ? `${stunden} Std. ${minuten} Min.` : `${stunden} Std.`],
    ['Urlaubsanspruch', `${profil.urlaubstageJahr} Tage`],
    [
      'Feiertagskalender',
      profil.bundesland
        ? `${profil.bundesland}${profil.bundeslandQuelle ? ` · ${profil.bundeslandQuelle}` : ''}`
        : 'Nicht hinterlegt',
    ],
  ];

  return (
    <div className="flex flex-col gap-7">
      <Bühnenkopf
        satz="Diese Angaben bestimmen Arbeitszeit, Urlaub und Berechtigungen. Ändern kann sie nur die Verwaltung."
        titel="Stimmt alles?"
      />

      <dl className="flex flex-col divide-y divide-separator rounded-2xl bg-surface-secondary px-5">
        {zeilen.map(([bezeichnung, wert]) => (
          <div key={bezeichnung} className="flex items-baseline justify-between gap-6 py-3.5">
            <dt className="text-sm text-muted">{bezeichnung}</dt>
            <dd className="text-end text-sm font-medium">{wert}</dd>
          </div>
        ))}
      </dl>

      {!profil.bundesland && (
        <Banner
          description="Du kannst fortfahren. Bitte die Verwaltung, ein Bundesland für dich oder das Unternehmen einzutragen."
          status="warning"
          title="Kein Feiertagskalender hinterlegt"
        />
      )}
      {profil.stammdatenFehler && (
        <Banner
          description={`${profil.stammdatenFehler} Bitte wende dich an die Verwaltung.`}
          status="error"
          title="Die Einrichtung ist noch nicht vollständig"
        />
      )}

      <CheckboxInput
        description="Deine Bestätigung wird protokolliert. Nach einer Änderung wirst du erneut gefragt."
        disabledMessage="Die Verwaltung muss zuerst die Stammdaten korrigieren."
        isDisabled={Boolean(profil.stammdatenFehler)}
        label="Ja, diese Angaben sind richtig."
        onChange={setBestaetigt}
        value={bestaetigt}
        width="100%"
      />

      <Schrittfuss zurueck={zurueck}>
        <Button
          isDisabled={!bestaetigt || Boolean(profil.stammdatenFehler)}
          label="Weiter"
          onClick={weiter}
          size="lg"
          type="button"
          variant="primary"
        />
      </Schrittfuss>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/**
 * Die Profilfigur — dieselbe Auswahl wie in `login-form.tsx`, hier ohne einen
 * Foto-Upload daneben: `/new`s Einrichtung bietet keinen Bildupload an, also
 * bleibt `AvatarAuswahl` mit `hatBild=false` (ihr Vorgabewert) dauerhaft im
 * gewählten Zustand statt im eingeklappten Rückfall-Hinweis.
 */
function ProfilSchritt({
  wert,
  setWert,
  weiter,
  zurueck,
}: {
  wert: AvatarKey;
  setWert: (wert: AvatarKey) => void;
  weiter: () => void;
  zurueck: (() => void) | null;
}) {
  return (
    <div className="flex flex-col gap-7">
      <Bühnenkopf
        satz="Sie steht neben deinem Namen im Team und im Kalender. Es wird kein Foto hochgeladen."
        titel="Wer begleitet dich?"
      />

      <AvatarAuswahl onChange={setWert} value={wert} />

      <Schrittfuss zurueck={zurueck}>
        <Button label="Weiter" onClick={weiter} size="lg" type="button" variant="primary" />
      </Schrittfuss>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const ANSICHTEN: Array<{wert: Startansicht; titel: string}> = [
  {wert: 'tag', titel: 'Tag'},
  {wert: 'woche', titel: 'Woche'},
  {wert: 'monat', titel: 'Monat'},
  {wert: 'konto', titel: 'Konto'},
];

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
  setStartansicht: (wert: Startansicht) => void;
  hinweise: boolean;
  setHinweise: (wert: boolean) => void;
  bestaetigt: boolean;
  zurueck: (() => void) | null;
}) {
  const [state, absenden, laeuft] = useActionState(onboardingCompleteAction, SETUP_INITIAL);

  return (
    <form action={absenden} className="flex flex-col gap-7">
      <Bühnenkopf
        satz="Beides kannst du später jederzeit unter „Mein Profil“ ändern."
        titel="So möchtest du starten"
      />
      {state.error && <Banner status="error" title={state.error} />}

      <SegmentedControl
        label="Startansicht nach der Anmeldung"
        layout="fill"
        onChange={(value) => setStartansicht(value as Startansicht)}
        value={startansicht}
      >
        {ANSICHTEN.map((ansicht) => (
          <SegmentedControlItem key={ansicht.wert} label={ansicht.titel} value={ansicht.wert} />
        ))}
      </SegmentedControl>

      {/* Der Schalter steht rechts, seine Bedeutung links: gelesen wird von
          links, geschaltet wird am Ende der Zeile. */}
      <Switch
        description="Zeigt einen Hinweis, wenn vergangene Tage noch geprüft werden müssen."
        label="An offene Tage erinnern"
        labelPosition="start"
        labelSpacing="spread"
        onChange={setHinweise}
        value={hinweise}
        width="100%"
      />

      <input name="datenBestaetigt" type="hidden" value={bestaetigt ? 'ja' : 'nein'} />
      <input name="avatar" type="hidden" value={avatar} />
      <input name="startansicht" type="hidden" value={startansicht} />
      <input name="hinweiseZuOffenenTagen" type="hidden" value={hinweise ? 'ja' : 'nein'} />

      <Schrittfuss zurueck={zurueck}>
        <Button isLoading={laeuft} label="Arbeitsplatz öffnen" size="lg" type="submit" variant="primary" />
      </Schrittfuss>
    </form>
  );
}
