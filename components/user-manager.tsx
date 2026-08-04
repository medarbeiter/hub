'use client';

import {
  Badge,
  Banner,
  Button,
  Card,
  Dialog,
  DialogHeader,
  Divider,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  StackItem,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useActionState, useEffect, useRef, useState, useTransition} from 'react';
import {
  userCreateAction,
  userResetPasswordAction,
  userSetActiveAction,
  userUpdateAction,
  type UserActionState,
} from '@/app/actions';

export interface ManagedUser {
  id: number;
  name: string;
  email: string;
  role: 'mitarbeiter' | 'verwaltung';
  weekly_minutes: number;
  active: number;
}

interface UserManagerProps {
  users: ManagedUser[];
  selfId: number;
}

const INITIAL: UserActionState = {error: null};

function UserForm({
  user,
  onDone,
}: {
  user: ManagedUser | null;
  onDone: (password?: string) => void;
}) {
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [role, setRole] = useState<string>(user?.role ?? 'mitarbeiter');
  const [weeklyHours, setWeeklyHours] = useState(user ? String(user.weekly_minutes / 60) : '40');
  const [state, formAction, isPending] = useActionState(user ? userUpdateAction : userCreateAction, INITIAL);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      if (state.error === null) onDone(state.password);
    }
  }, [state, onDone]);

  return (
    <form action={formAction}>
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
        <SegmentedControl label="Rolle" value={role} onChange={setRole} layout="fill">
          <SegmentedControlItem value="mitarbeiter" label="Mitarbeiter" />
          <SegmentedControlItem value="verwaltung" label="Verwaltung" />
        </SegmentedControl>
        <TextInput
          label="Wochenstunden (Sollzeit)"
          value={weeklyHours}
          onChange={setWeeklyHours}
          htmlName="weeklyHours"
          description="Vertragliche Stunden pro Woche, verteilt auf Montag bis Freitag."
        />
        <input type="hidden" name="role" value={role} />
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

export function UserManager({users, selfId}: UserManagerProps) {
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [oneTimePassword, setOneTimePassword] = useState<{name: string; password: string} | null>(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState<ManagedUser | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const active = users.filter((u) => u.active === 1);
  const inactive = users.filter((u) => u.active !== 1);

  const resetPasswordFor = (user: ManagedUser) =>
    startTransition(async () => {
      setRowError(null);
      const result = await userResetPasswordAction(user.id);
      if (result.error) setRowError(result.error);
      else if (result.password) setOneTimePassword({name: user.name, password: result.password});
    });

  const setActive = (user: ManagedUser, value: boolean) =>
    startTransition(async () => {
      setRowError(null);
      const result = await userSetActiveAction(user.id, value);
      if (result.error) setRowError(result.error);
      setConfirmDeactivate(null);
      router.refresh();
    });

  const renderRow = (user: ManagedUser, index: number) => (
    <VStack key={user.id} gap={0}>
      {index > 0 && <Divider />}
      <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2} wrap="wrap">
        <span style={{inlineSize: 220, flexShrink: 0}}>
          <VStack gap={0}>
            <Text type="label" weight="medium" maxLines={1}>
              {user.name}
              {user.id === selfId ? ' (Sie)' : ''}
            </Text>
            <Text type="supporting" size="sm" color="secondary" maxLines={1}>
              {user.email}
            </Text>
          </VStack>
        </span>
        <span style={{inlineSize: 110, flexShrink: 0}}>
          <Badge variant={user.role === 'verwaltung' ? 'info' : 'neutral'} label={user.role === 'verwaltung' ? 'Verwaltung' : 'Mitarbeiter'} />
        </span>
        <span style={{inlineSize: 110, flexShrink: 0}}>
          <Text type="body" hasTabularNumbers>
            {Math.round((user.weekly_minutes / 60) * 10) / 10} Std./Woche
          </Text>
        </span>
        <StackItem size="fill">
          <span />
        </StackItem>
        <HStack gap={2} vAlign="center">
          <Button
            label="Bearbeiten"
            variant="ghost"
            size="sm"
            onClick={() => {
              setEditing(user);
              setFormOpen(true);
            }}
          />
          {user.active === 1 ? (
            <>
              <Button label="Passwort zurücksetzen" variant="ghost" size="sm" isLoading={isPending} onClick={() => resetPasswordFor(user)} />
              <Button
                label="Deaktivieren"
                variant="ghost"
                size="sm"
                isDisabled={user.id === selfId}
                tooltip={user.id === selfId ? 'Das eigene Konto kann nicht deaktiviert werden.' : undefined}
                onClick={() => setConfirmDeactivate(user)}
              />
            </>
          ) : (
            <Button label="Reaktivieren" variant="secondary" size="sm" isLoading={isPending} onClick={() => setActive(user, true)} />
          )}
        </HStack>
      </HStack>
    </VStack>
  );

  return (
    <VStack gap={4}>
      {rowError && <Banner status="error" title={rowError} />}

      <Card padding={0}>
        <VStack gap={0}>{active.map(renderRow)}</VStack>
      </Card>

      {inactive.length > 0 && (
        <VStack gap={2}>
          <Text type="label" color="secondary">
            Deaktivierte Konten
          </Text>
          <Card padding={0} variant="muted">
            <VStack gap={0}>{inactive.map(renderRow)}</VStack>
          </Card>
        </VStack>
      )}

      <span>
        <Button
          label="Mitarbeiter anlegen"
          variant="primary"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        />
      </span>

      <Dialog isOpen={isFormOpen} onOpenChange={setFormOpen} purpose="form" width={440}>
        <DialogHeader
          title={editing ? 'Mitarbeiter bearbeiten' : 'Mitarbeiter anlegen'}
          subtitle={editing ? editing.name : 'Das Startpasswort wird nach dem Anlegen einmalig angezeigt.'}
        />
        {isFormOpen && (
          <UserForm
            user={editing}
            onDone={(password) => {
              setFormOpen(false);
              if (password) setOneTimePassword({name: 'Neues Konto', password});
              router.refresh();
            }}
          />
        )}
      </Dialog>

      <Dialog
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
            description="Geben Sie es dem Mitarbeiter persönlich weiter. Nach der ersten Anmeldung sollte es geändert werden."
          />
          <Card padding={4} variant="muted">
            <Text type="code" size="xl" hasTabularNumbers justify="center" as="p">
              {oneTimePassword?.password ?? ''}
            </Text>
          </Card>
          <HStack justify="end">
            <Button label="Verstanden" variant="primary" onClick={() => setOneTimePassword(null)} />
          </HStack>
        </VStack>
      </Dialog>

      <Dialog
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
            und Abschlüsse erhalten. Sie können das Konto jederzeit reaktivieren.
          </Text>
          <HStack gap={2} justify="end">
            <Button label="Abbrechen" variant="secondary" onClick={() => setConfirmDeactivate(null)} />
            <Button
              label="Deaktivieren"
              variant="destructive"
              isLoading={isPending}
              onClick={() => confirmDeactivate && setActive(confirmDeactivate, false)}
            />
          </HStack>
        </VStack>
      </Dialog>
    </VStack>
  );
}
