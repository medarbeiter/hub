'use client';

import {Banner, Button, Card, Heading, HStack, Text, TextInput, VStack} from '@astryxdesign/core';
import {useActionState, useEffect, useRef, useState} from 'react';
import {settingsSaveAction, type ActionState} from '@/app/actions';

const INITIAL: ActionState = {error: null};

interface SettingsFormProps {
  mergeWindowMin: number;
  /** Cutoff as HH:MM, or '' when auto-closing is switched off. */
  autoCloseCutoff: string;
}

/**
 * The two settings that decide how the app treats imperfect records. Both are
 * conservative by default: merge only true mis-clicks, and never close a
 * forgotten day behind the employee's back.
 */
export function SettingsForm(props: SettingsFormProps) {
  const [mergeWindow, setMergeWindow] = useState(String(props.mergeWindowMin));
  const [cutoff, setCutoff] = useState(props.autoCloseCutoff);
  const [isSaved, setSaved] = useState(false);
  const [state, formAction, isSaving] = useActionState(settingsSaveAction, INITIAL);
  const lastState = useRef(state);

  useEffect(() => {
    if (state !== lastState.current) {
      lastState.current = state;
      setSaved(state.error === null);
    }
  }, [state]);

  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    setSaved(false);
    set(value);
  };

  return (
    <form action={formAction}>
      <VStack gap={4} maxWidth={640}>
        {state.error && <Banner status="error" title={state.error} />}
        {isSaved && <Banner status="success" title="Einstellungen gespeichert." />}

        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Verstempeln zusammenführen</Heading>
              <Text type="supporting" color="secondary">
                Stempelt jemand versehentlich aus und gleich wieder ein, wird der vorherige Eintrag fortgesetzt statt
                ein neuer angelegt. Ebenso gelten Pausen unterhalb dieser Dauer als Fehlbedienung. 0 schaltet das
                Zusammenführen ab.
              </Text>
            </VStack>
            <TextInput
              label="Fenster in Minuten"
              value={mergeWindow}
              onChange={edit(setMergeWindow)}
              htmlName="mergeWindow"
              width={200}
            />
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Heading level={2}>Vergessene Ausstempelungen</Heading>
              <Text type="supporting" color="secondary">
                Offene Einträge vergangener Tage werden zu dieser Uhrzeit vorläufig beendet und als „bitte bestätigen“
                markiert – sie gelten erst als erfasst, wenn jemand sie bestätigt oder korrigiert. Feld leer lassen,
                damit offene Einträge unverändert stehen bleiben. Einträge, die nach dieser Uhrzeit begonnen haben,
                bleiben immer offen.
              </Text>
            </VStack>
            <TextInput
              label="Uhrzeit (HH:MM)"
              value={cutoff}
              onChange={edit(setCutoff)}
              htmlName="autoCloseCutoff"
              placeholder="z. B. 20:00 – leer = aus"
              width={200}
            />
          </VStack>
        </Card>

        <HStack gap={2}>
          <Button label="Speichern" variant="primary" type="submit" isLoading={isSaving} />
        </HStack>
      </VStack>
    </form>
  );
}
