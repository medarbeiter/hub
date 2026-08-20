'use client';

import {
  Badge,
  Banner,
  Button,
  Card,
  CheckboxList,
  CheckboxListItem,
  DialogHeader,
  HStack,
  Selector,
  Switch,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {
  einrichtungNeuStartenAction,
  userCreateAction,
  userResetPasswordAction,
  userSetActiveAction,
  userUpdateAction,
  type UserActionState,
} from '@/app/actions';
import {BUNDESLAENDER} from '@/lib/feiertage';
import {ALLE_RECHTE, RECHTE, istRecht, type Recht, type Rolle, type RollenEintrag} from '@/lib/rechte';
import {useMelde} from './melde';
import type {PersonAngabe} from '@/lib/avatar';
import {PersonenTafel, type PersonenZeile} from './personen-tafel';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

export interface ManagedUser {
  id: number;
  name: string;
  person: PersonAngabe;
  email: string;
  role: Rolle;
  weekly_minutes: number;
  active: number;
  bundesland?: string | null;
  urlaubstage_jahr: number;
  /** Zusatzrechte über das Rollenbündel hinaus. */
  extra_rechte: Recht[];
}

interface UserManagerProps {
  users: ManagedUser[];
  selfId: number;
  /** Die Rollen samt Bündeln, wie sie in der Datenbank stehen — der Browser kennt sie nicht mehr von selbst. */
  rollen: RollenEintrag[];
}

const INITIAL: UserActionState = {error: null};

const LAND_OPTIONS = Object.entries(BUNDESLAENDER).map(([value, label]) => ({value, label}));

function UserForm({
  user,
  rollen,
  onDone,
}: {
  user: ManagedUser | null;
  rollen: RollenEintrag[];
  onDone: (ergebnis?: {password: string; versandt?: UserActionState['versandt']}) => void;
}) {
  const rollenOptions = rollen.map((r) => ({value: r.schluessel, label: r.label}));
  const vorgabe = rollen[0]?.schluessel ?? '';
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<Rolle>(user?.role ?? vorgabe);
  const [extraRechte, setExtraRechte] = useState<Recht[]>(user?.extra_rechte ?? []);
  const [weeklyHours, setWeeklyHours] = useState(user ? String(user.weekly_minutes / 60) : '40');
  const [urlaubstage, setUrlaubstage] = useState(String(user?.urlaubstage_jahr ?? 30));
  const [land, setLand] = useState(user?.bundesland ?? '');
  // Vorgabe an: der übliche Weg, und ein Startpasswort, das beim ersten
  // Anmelden ohnehin ersetzt werden muss, ist vertretbar im Postfach. Wer das
  // nicht will, nimmt den Haken heraus und bekommt es nur angezeigt.
  const [perMail, setPerMail] = useState(true);
  const [state, formAction, isPending] = useActionState(user ? userUpdateAction : userCreateAction, INITIAL);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) {
        onDone(state.password ? {password: state.password, versandt: state.versandt} : undefined);
      }
    }
  }, [state, onDone]);

  // Nur, was das gewählte Bündel nicht ohnehin enthält — ein Haken, der
  // nichts hinzufügt, wäre eine Einstellung ohne Wirkung.
  const buendel = rollen.find((r) => r.schluessel === role)?.rechte ?? [];
  const waehlbareRechte = ALLE_RECHTE.filter((recht) => !buendel.includes(recht));
  const gewaehlt = extraRechte.filter((recht) => waehlbareRechte.includes(recht));

  return (
    <form action={formAction} className="tafel-rumpf">
      <VStack gap={4} padding={4}>
        {state.error && <Banner status="error" title={state.error} />}
        <TextInput label="Name" value={name} onChange={setName} htmlName="name" placeholder="Vorname Nachname" />
        <TextInput
          label="E-Mail"
          type="email"
          value={email}
          onChange={setEmail}
          htmlName="email"
          placeholder="vorname.name@firma.de"
        />
        <Selector
          label="Rolle"
          options={rollenOptions}
          value={role}
          onChange={(value) => setRole(value && rollen.some((r) => r.schluessel === value) ? value : vorgabe)}
          description="Jede Rolle ist ein Rechtebündel; darunter lassen sich einzelne Rechte ergänzen."
        />
        {waehlbareRechte.length > 0 ? (
          <CheckboxList
            label="Zusätzliche Rechte"
            value={gewaehlt}
            onChange={(values) => setExtraRechte(values.filter(istRecht))}
            density="compact"
            hasDividers
          >
            {waehlbareRechte.map((recht) => (
              <CheckboxListItem
                key={recht}
                value={recht}
                label={RECHTE[recht].label}
                description={RECHTE[recht].beschreibung}
              />
            ))}
          </CheckboxList>
        ) : (
          <Text type="supporting" size="sm" color="secondary" as="p">
            Diese Rolle umfasst bereits alle Rechte.
          </Text>
        )}
        <TextInput
          label="Wochenstunden (Sollzeit)"
          value={weeklyHours}
          onChange={setWeeklyHours}
          htmlName="weeklyHours"
          description="Vertragliche Stunden pro Woche, verteilt auf Montag bis Freitag."
        />
        <TextInput
          label="Urlaubstage pro Jahr"
          value={urlaubstage}
          onChange={setUrlaubstage}
          htmlName="urlaubstage"
          description="Der Jahresanspruch. Ein Übertrag aus dem Vorjahr wird eigens je Jahr eingetragen."
        />
        <Selector
          label="Bundesland (Feiertage)"
          options={LAND_OPTIONS}
          value={land}
          onChange={(value) => setLand(value ?? '')}
          htmlName="bundesland"
          placeholder="Wie im Unternehmen eingestellt"
          description="Nur nötig, wenn dieser Mitarbeiter in einem anderen Bundesland arbeitet."
          hasSearch
          searchPlaceholder="Bundesland suchen"
          hasClear
        />
        {!user && (
          <Switch
            label="Zugangsdaten per E-Mail senden"
            description="Schickt Anmeldename und Startpasswort an die eingetragene Adresse. Das Passwort wird dir hier trotzdem angezeigt."
            value={perMail}
            onChange={setPerMail}
            labelPosition="start"
            labelSpacing="spread"
            width="100%"
          />
        )}
        {!user && <input type="hidden" name="zugangPerMail" value={perMail ? 'ja' : 'nein'} />}
        <input type="hidden" name="role" value={role} />
        {gewaehlt.map((recht) => (
          <input key={recht} type="hidden" name="extraRechte" value={recht} />
        ))}
        {user && <input type="hidden" name="userId" value={user.id} />}
        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => onDone()} />
          <Button
            label={user ? 'Speichern' : 'Mitarbeiter anlegen'}
            variant="primary"
            type="submit"
            isLoading={isPending}
          />
        </HStack>
      </VStack>
    </form>
  );
}

export function UserManager({users, selfId, rollen}: UserManagerProps) {
  const buendelVon = (role: string) => rollen.find((r) => r.schluessel === role)?.rechte ?? [];
  const labelVon = (role: string) => rollen.find((r) => r.schluessel === role)?.label ?? role;
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [oneTimePassword, setOneTimePassword] = useState<{
    name: string;
    password: string;
    versandt?: UserActionState['versandt'];
  } | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<ManagedUser | null>(null);
  const [confirmNeustart, setConfirmNeustart] = useState<ManagedUser | null>(null);
  const melde = useMelde();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const active = users.filter((u) => u.active === 1);
  const inactive = users.filter((u) => u.active !== 1);

  // Beim Zurücksetzen geht die Nachricht immer hinaus: anders als beim Anlegen
  // ist die Adresse längst bestätigt, und wer sich gerade nicht anmelden kann,
  // ist auf genau diesen Weg angewiesen.
  const resetPasswordFor = (user: ManagedUser) =>
    startTransition(async () => {
      const result = await userResetPasswordAction(user.id, true);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      else if (result.password) {
        setOneTimePassword({name: user.name, password: result.password, versandt: result.versandt});
      }
    });

  const setActive = (user: ManagedUser, value: boolean) =>
    startTransition(async () => {
      const result = await userSetActiveAction(user.id, value);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      setConfirmDeactivate(null);
      router.refresh();
    });

  const neustartFor = (user: ManagedUser) =>
    startTransition(async () => {
      const result = await einrichtungNeuStartenAction(user.id);
      if (result.error) melde({ton: 'fehler', titel: result.error, dauerhaft: true});
      else {
        melde({
          ton: 'erfolg',
          titel: 'Einrichtung neu gestartet',
          text: `${user.name} durchläuft beim nächsten Aufruf wieder den Einrichtungsassistenten.`,
        });
      }
      setConfirmNeustart(null);
      router.refresh();
    });

  /**
   * Eine Kontozeile für die Personentafel.
   *
   * Die Handlungen stehen als drei Geistknöpfe am Zeilenende — sie sind auch
   * die einzige Spalte, die hier nicht sortierbar ist, weil sie nichts
   * vergleicht. Die Wochenstunden liegen unter dem Namen und nicht in einer
   * eigenen Spalte: sie sind eine Eigenschaft der Person, keine Kennzahl des
   * Monats, und dieselbe Unterzeile trägt sie auf Team und Monatsabschluss.
   */
  const zeile = (user: ManagedUser): PersonenZeile => ({
    id: user.id,
    name: `${user.name}${user.id === selfId ? ' (Du)' : ''}`,
    person: user.person,
    unterzeile: `${user.email} · ${Math.round((user.weekly_minutes / 60) * 10) / 10} Std./Woche`,
    marken: (
      <HStack gap={1} wrap="wrap" justify="end">
        <Badge
          variant={buendelVon(user.role).includes('mitarbeiter.verwalten') ? 'info' : 'neutral'}
          label={labelVon(user.role)}
          icon={
            <Sinnbild
              sinn={buendelVon(user.role).includes('mitarbeiter.verwalten') ? 'rolleVerwaltung' : 'rolleMitarbeiter'}
              groesse="zeile"
            />
          }
        />
        {user.extra_rechte.length > 0 && (
          <Badge
            variant="neutral"
            label={user.extra_rechte.length === 1 ? '+1 Recht' : `+${user.extra_rechte.length} Rechte`}
          />
        )}
      </HStack>
    ),
    handlung: (
      <HStack gap={1} vAlign="center" justify="end" wrap="nowrap">
        <Button
          label="Bearbeiten"
          variant="ghost"
          size="sm"
          icon={<Sinnbild sinn="bearbeiten" />}
          onClick={() => {
            setEditing(user);
            setFormOpen(true);
          }}
        />
        {user.active === 1 ? (
          <>
            <Button
              label="Passwort"
              tooltip="Passwort zurücksetzen"
              variant="ghost"
              size="sm"
              isLoading={isPending}
              icon={<Sinnbild sinn="passwort" />}
              onClick={() => resetPasswordFor(user)}
            />
            <Button
              label="Einrichtung"
              tooltip="Einrichtung neu starten"
              variant="ghost"
              size="sm"
              icon={<Sinnbild sinn="erneut" />}
              onClick={() => setConfirmNeustart(user)}
            />
            <Button
              label="Deaktivieren"
              variant="ghost"
              size="sm"
              icon={<Sinnbild sinn="deaktivieren" />}
              isDisabled={user.id === selfId}
              tooltip={user.id === selfId ? 'Das eigene Konto kann nicht deaktiviert werden.' : undefined}
              onClick={() => setConfirmDeactivate(user)}
            />
          </>
        ) : (
          <Button
            label="Reaktivieren"
            variant="secondary"
            size="sm"
            isLoading={isPending}
            icon={<Sinnbild sinn="reaktivieren" />}
            onClick={() => setActive(user, true)}
          />
        )}
      </HStack>
    ),
  });

  return (
    <VStack gap={4}>
      <PersonenTafel
        zeilen={active.map(zeile)}
        spalten={['name', 'marken', 'handlung']}
        handlungBreite={480}
      />

      {inactive.length > 0 && (
        <VStack gap={2}>
          <Text type="label" color="secondary">
            Deaktivierte Konten
          </Text>
          <PersonenTafel
            zeilen={inactive.map(zeile)}
            spalten={['name', 'marken', 'handlung']}
            handlungBreite={480}
          />
        </VStack>
      )}

      <span>
        <Button
          label="Mitarbeiter anlegen"
          variant="primary"
          icon={<Sinnbild sinn="hinzufuegen" />}
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </span>

      <TafelDialog isOpen={isFormOpen} onOpenChange={setFormOpen} purpose="form" width={440}>
        <DialogHeader
          title={editing ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen'}
          subtitle={editing ? editing.name : 'Das Startpasswort wird einmalig angezeigt und muss danach ersetzt werden.'}
        />
        {isFormOpen && (
          <UserForm
            user={editing}
            rollen={rollen}
            onDone={(ergebnis) => {
              setFormOpen(false);
              if (ergebnis) setOneTimePassword({name: 'Neues Konto', ...ergebnis});
              router.refresh();
            }}
          />
        )}
      </TafelDialog>

      <TafelDialog
        isOpen={oneTimePassword !== null}
        onOpenChange={(open) => {
          if (!open) setOneTimePassword(null);
        }}
        purpose="required"
        width={440}
      >
        <DialogHeader title="Startpasswort" subtitle={oneTimePassword?.name ?? ''} />
        <VStack gap={4} padding={4}>
          <Banner
            status="info"
            title="Dieses Passwort wird nur einmal angezeigt."
            description="Gib es dem Mitarbeiter persönlich weiter. Nach der nächsten Anmeldung muss es durch ein eigenes Passwort ersetzt werden."
          />
          {/* Was mit dem Versand geschah, steht neben dem Passwort und nicht
              als flüchtige Meldung: die Verwaltung entscheidet hier, ob sie es
              noch persönlich weitergeben muss. */}
          {oneTimePassword?.versandt === 'gesendet' && (
            <Banner
              status="success"
              title={`Auch per E-Mail an ${oneTimePassword.name} versendet.`}
            />
          )}
          {oneTimePassword?.versandt === 'fehler' && (
            <Banner
              status="error"
              title="Die E-Mail konnte nicht zugestellt werden."
              description={'Bitte gib das Passwort persönlich weiter. Der Grund steht in den Einstellungen unter „Zuletzt versendet".'}
            />
          )}
          {oneTimePassword?.versandt === 'uebersprungen' && (
            <Banner
              status="warning"
              title="Es ging keine E-Mail hinaus."
              description="Der Versand ist abgeschaltet oder nicht eingerichtet. Bitte gib das Passwort persönlich weiter."
            />
          )}
          <Card padding={4} variant="muted">
            <Text type="code" size="xl" hasTabularNumbers justify="center" as="p">
              {oneTimePassword?.password ?? ''}
            </Text>
          </Card>
          <HStack justify="end">
            <Button label="Verstanden" variant="primary" onClick={() => setOneTimePassword(null)} />
          </HStack>
        </VStack>
      </TafelDialog>

      <TafelDialog
        isOpen={confirmNeustart !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmNeustart(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader title="Einrichtung neu starten" subtitle={confirmNeustart?.name ?? ''} />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Beim nächsten Aufruf durchläuft dieses Konto wieder den Einrichtungsassistenten:
            Stammdaten bestätigen, Profilfigur und Startansicht wählen. Ein bereits verbundenes
            Google-Konto bleibt verbunden, das Passwort bleibt unverändert. Erfasste Zeiten sind
            nicht betroffen.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setConfirmNeustart(null)} />
            <Button
              label="Neu starten"
              variant="primary"
              isLoading={isPending}
              icon={<Sinnbild sinn="erneut" />}
              onClick={() => confirmNeustart && neustartFor(confirmNeustart)}
            />
          </HStack>
        </VStack>
      </TafelDialog>

      <TafelDialog
        isOpen={confirmDeactivate !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeactivate(null);
        }}
        purpose="form"
        width={440}
      >
        <DialogHeader title="Mitarbeiter deaktivieren" subtitle={confirmDeactivate?.name ?? ''} />
        <VStack gap={4} padding={4}>
          <Text type="body" as="p">
            Das Konto wird abgemeldet und kann sich nicht mehr anmelden. Alle erfassten Zeiten bleiben für Berichte
            und Abschlüsse erhalten. Du kannst das Konto jederzeit reaktivieren.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setConfirmDeactivate(null)} />
            <Button
              label="Deaktivieren"
              variant="destructive"
              isLoading={isPending}
              icon={<Sinnbild sinn="deaktivieren" />}
              onClick={() => confirmDeactivate && setActive(confirmDeactivate, false)}
            />
          </HStack>
        </VStack>
      </TafelDialog>
    </VStack>
  );
}
