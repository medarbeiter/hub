'use client';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Description,
  Input,
  Label,
  Radio,
  RadioGroup,
  Separator,
  Spinner,
  Switch,
  TextField,
  Typography,
} from '@heroui/react';
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
import {AVATARE, type AvatarKey} from '@/lib/avatar';
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

export function Fehlermeldung({text}: {text: string}) {
  return (
    <Alert role="alert" status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>{text}</Alert.Title>
      </Alert.Content>
    </Alert>
  );
}

/** Ein Knopf, der eine Server-Aktion auslöst, sagt selbst, dass er läuft. */
function Ladeinhalt({laeuft, children}: {laeuft: boolean; children: ReactNode}) {
  return (
    <>
      {laeuft && <Spinner color="current" size="sm" />}
      {children}
    </>
  );
}

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
      <Typography className="tracking-tight text-balance" type="h2">
        {titel}
      </Typography>
      <Typography className="max-w-[46ch] text-pretty" color="muted" type="body-sm">
        {satz}
      </Typography>
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
        <Button size="lg" type="button" variant="ghost" onPress={zurueck}>
          Zurück
        </Button>
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
    <main className="min-h-dvh bg-[radial-gradient(120%_58%_at_50%_-12%,#f7edd2_0%,transparent_62%)]">
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
  const [sichtbar, setSichtbar] = useState(false);
  const [feststelltaste, setFeststelltaste] = useState(false);

  return (
    <div className="neu-auftritt mx-auto flex w-full max-w-[27rem] flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Typography className="text-center tracking-tight" type="h1">
          Willkommen zurück
        </Typography>
        <Typography className="text-center" color="muted" type="body-sm">
          Melde dich an, um deine Zeit zu erfassen.
        </Typography>
      </div>

      <Card className="p-7 sm:p-8" variant="default">
        <form action={absenden} className="flex flex-col gap-5">
          {fehler && <Fehlermeldung text={fehler} />}

          <TextField fullWidth isDisabled={laeuft} name="email" type="email">
            <Label>E-Mail</Label>
            <Input
              autoComplete="username"
              autoFocus
              enterKeyHint="next"
              placeholder="vorname.name@firma.de"
            />
          </TextField>

          <TextField
            fullWidth
            isDisabled={laeuft}
            name="password"
            type={sichtbar ? 'text' : 'password'}
            onKeyDown={(event) => setFeststelltaste(event.getModifierState('CapsLock'))}
            onKeyUp={(event) => setFeststelltaste(event.getModifierState('CapsLock'))}
          >
            <div className="flex items-center justify-between gap-2">
              <Label>Passwort</Label>
              <Button
                className="-me-2 h-7 px-2 text-xs"
                type="button"
                variant="ghost"
                onPress={() => setSichtbar((offen) => !offen)}
              >
                {sichtbar ? 'Verbergen' : 'Anzeigen'}
              </Button>
            </div>
            <Input autoComplete="current-password" enterKeyHint="go" placeholder="Dein Passwort" />
            {feststelltaste && (
              <Description className="text-warning">Feststelltaste ist aktiviert.</Description>
            )}
          </TextField>

          <Button className="mt-1" fullWidth isPending={laeuft} size="lg" type="submit">
            <Ladeinhalt laeuft={laeuft}>Anmelden</Ladeinhalt>
          </Button>
        </form>

        {clientId && (
          <>
            <div className="my-6 flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted">oder</span>
              <Separator className="flex-1" />
            </div>
            <GoogleAnmeldeKnopf clientId={clientId} />
          </>
        )}
      </Card>

      <p className="text-center text-xs leading-relaxed text-muted">
        Passwort vergessen? Die Verwaltung stellt dir ein neues Startpasswort aus.
      </p>
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
      <Card className="overflow-hidden p-0" variant="default">
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

        <div key={schritt} className="neu-auftritt flex flex-col gap-7 p-7 sm:p-10">
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
        <Button size="sm" type="submit" variant="ghost">
          Mit einem anderen Konto anmelden
        </Button>
      </form>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PasswortSchritt({weiter}: {weiter: () => void}) {
  const [passwort, setPasswort] = useState('');
  const [wiederholung, setWiederholung] = useState('');
  const [sichtbar, setSichtbar] = useState(false);
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
      {state.error && <Fehlermeldung text={state.error} />}

      <div className="flex flex-col gap-5">
        <TextField
          fullWidth
          isDisabled={laeuft || state.gespeichert}
          name="neuesPasswort"
          type={sichtbar ? 'text' : 'password'}
          value={passwort}
          onChange={setPasswort}
        >
          <div className="flex items-center justify-between gap-2">
            <Label>Neues Passwort</Label>
            <Button
              className="-me-2 h-7 px-2 text-xs"
              type="button"
              variant="ghost"
              onPress={() => setSichtbar((offen) => !offen)}
            >
              {sichtbar ? 'Verbergen' : 'Anzeigen'}
            </Button>
          </div>
          <Input autoComplete="new-password" autoFocus />
        </TextField>

        <TextField
          fullWidth
          isDisabled={laeuft || state.gespeichert}
          name="passwortWiederholung"
          type={sichtbar ? 'text' : 'password'}
          value={wiederholung}
          onChange={setWiederholung}
        >
          <Label>Neues Passwort wiederholen</Label>
          <Input autoComplete="new-password" />
        </TextField>
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
          isPending={laeuft}
          size="lg"
          type="submit"
        >
          <Ladeinhalt laeuft={laeuft}>Passwort speichern</Ladeinhalt>
        </Button>
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
      {state.error && <Fehlermeldung text={state.error} />}
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
        <Alert status="warning">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Kein Feiertagskalender hinterlegt</Alert.Title>
            <Alert.Description>
              Du kannst fortfahren. Bitte die Verwaltung, ein Bundesland für dich oder das
              Unternehmen einzutragen.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}
      {profil.stammdatenFehler && (
        <Alert status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Die Einrichtung ist noch nicht vollständig</Alert.Title>
            <Alert.Description>
              {profil.stammdatenFehler} Bitte wende dich an die Verwaltung.
            </Alert.Description>
          </Alert.Content>
        </Alert>
      )}

      <Checkbox
        isDisabled={Boolean(profil.stammdatenFehler)}
        isSelected={bestaetigt}
        onChange={setBestaetigt}
      >
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Ja, diese Angaben sind richtig.
        </Checkbox.Content>
        <Description>
          Deine Bestätigung wird protokolliert. Nach einer Änderung wirst du erneut gefragt.
        </Description>
      </Checkbox>

      <Schrittfuss zurueck={zurueck}>
        <Button
          isDisabled={!bestaetigt || Boolean(profil.stammdatenFehler)}
          size="lg"
          type="button"
          onPress={weiter}
        >
          Weiter
        </Button>
      </Schrittfuss>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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

      <RadioGroup
        aria-label="Profilfigur"
        value={wert}
        onChange={(naechster) => setWert(naechster as AvatarKey)}
      >
        {/* Das Bild ist das Ziel, nicht ein Punkt daneben: die ganze Kachel
            schaltet, und die Wahl liest sich als goldener Ring. Die Bilder
            gehen über `next/image` — die Vorlagen sind 1254px und knapp 2 MB
            das Stück, roh geladen wären das siebzehn Megabyte für ein Raster. */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {AVATARE.map((eintrag) => (
            <Radio
              key={eintrag.key}
              className="group rounded-2xl border border-border bg-surface p-2.5 transition-colors duration-200 data-[selected=true]:border-[#8f6e06] data-[selected=true]:bg-accent-soft"
              value={eintrag.key}
            >
              <Radio.Content className="flex flex-col items-center gap-2 text-center">
                <Image
                  alt=""
                  className="size-14 rounded-full ring-2 ring-transparent transition-[--tw-ring-color] duration-200 group-data-[selected=true]:ring-[#8f6e06]"
                  height={1254}
                  sizes="56px"
                  src={eintrag.bild}
                  width={1254}
                />
                <span className="min-h-8 text-[11px] leading-tight text-balance">
                  {eintrag.label}
                </span>
              </Radio.Content>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      <Schrittfuss zurueck={zurueck}>
        <Button size="lg" type="button" onPress={weiter}>
          Weiter
        </Button>
      </Schrittfuss>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

const ANSICHTEN: Array<{wert: Startansicht; titel: string; satz: string}> = [
  {wert: 'tag', titel: 'Tag', satz: 'Der schnelle Start in den Tag'},
  {wert: 'woche', titel: 'Woche', satz: 'Die Arbeitswoche im Überblick'},
  {wert: 'monat', titel: 'Monat', satz: 'Planung und Vollständigkeit'},
  {wert: 'konto', titel: 'Konto', satz: 'Saldo und offene Tage'},
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
      {state.error && <Fehlermeldung text={state.error} />}

      <RadioGroup
        className="gap-3"
        value={startansicht}
        onChange={(naechste) => setStartansicht(naechste as Startansicht)}
      >
        <Label>Startansicht nach der Anmeldung</Label>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {ANSICHTEN.map((ansicht) => (
            <Radio
              key={ansicht.wert}
              className="rounded-2xl border border-border bg-surface p-4 transition-colors duration-200 data-[selected=true]:border-[#8f6e06] data-[selected=true]:bg-accent-soft"
              value={ansicht.wert}
            >
              <Radio.Content className="items-start gap-3">
                <Radio.Control className="mt-0.5">
                  <Radio.Indicator />
                </Radio.Control>
                <span className="flex flex-col gap-0.5 text-start">
                  <span className="text-sm font-medium">{ansicht.titel}</span>
                  <span className="text-xs text-muted">{ansicht.satz}</span>
                </span>
              </Radio.Content>
            </Radio>
          ))}
        </div>
      </RadioGroup>

      {/* Der Schalter steht rechts, seine Bedeutung links: gelesen wird von
          links, geschaltet wird am Ende der Zeile. */}
      <Switch
        className="w-full flex-row-reverse items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4"
        isSelected={hinweise}
        onChange={setHinweise}
      >
        <Switch.Control>
          <Switch.Thumb />
        </Switch.Control>
        <Switch.Content className="flex flex-1 flex-col items-start gap-0.5 text-start">
          <Label>An offene Tage erinnern</Label>
          <Description>
            Zeigt einen Hinweis, wenn vergangene Tage noch geprüft werden müssen.
          </Description>
        </Switch.Content>
      </Switch>

      <input name="datenBestaetigt" type="hidden" value={bestaetigt ? 'ja' : 'nein'} />
      <input name="avatar" type="hidden" value={avatar} />
      <input name="startansicht" type="hidden" value={startansicht} />
      <input name="hinweiseZuOffenenTagen" type="hidden" value={hinweise ? 'ja' : 'nein'} />

      <Schrittfuss zurueck={zurueck}>
        <Button isPending={laeuft} size="lg" type="submit">
          <Ladeinhalt laeuft={laeuft}>Arbeitsplatz öffnen</Ladeinhalt>
        </Button>
      </Schrittfuss>
    </form>
  );
}
