'use client';

import {Banner, Button, Card, Text, TextInput, VStack} from '@astryxdesign/core';
import Image from 'next/image';
import {useActionState, useState} from 'react';
import {loginAction, type ActionState} from '@/app/actions';

const INITIAL: ActionState = {error: null};

export function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [capsLock, setCapsLock] = useState(false);
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);

  return (
    <main
      style={{
        minBlockSize: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--spacing-5)',
        background:
          'radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--color-accent) 14%, var(--color-background-body)) 0%, var(--color-background-body) 55%)',
      }}
    >
      <VStack gap={5} width="100%" maxWidth={400} hAlign="center">
        <Image src="/logo.png" alt="MedArbeiter" width={264} height={48} priority />
        <Card padding={6} elevation="med" width="100%">
          <form
            action={formAction}
            onKeyDown={(e) => setCapsLock(e.getModifierState('CapsLock'))}
            onKeyUp={(e) => setCapsLock(e.getModifierState('CapsLock'))}
          >
            <VStack gap={4}>
              <VStack gap={1}>
                <Text type="large" weight="semibold" as="p">
                  Zeiterfassung
                </Text>
                <Text type="supporting" color="secondary" as="p">
                  Melden Sie sich mit Ihrem Mitarbeiterkonto an.
                </Text>
              </VStack>
              {state.error && <Banner status="error" title={state.error} />}
              <TextInput
                label="E-Mail"
                type="email"
                value={email}
                onChange={setEmail}
                htmlName="email"
                placeholder="vorname.name@firma.de"
              />
              <TextInput
                label="Passwort"
                type="password"
                value={password}
                onChange={setPassword}
                htmlName="password"
                status={capsLock ? {type: 'warning', message: 'Feststelltaste ist aktiviert.'} : undefined}
              />
              <Button label="Anmelden" variant="primary" size="lg" type="submit" width="100%" isLoading={isPending} />
            </VStack>
          </form>
        </Card>
        <Text type="supporting" color="secondary">
          Zugangsdaten vergessen? Wenden Sie sich an die Verwaltung.
        </Text>
      </VStack>
    </main>
  );
}
