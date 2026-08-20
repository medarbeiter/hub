'use client';

import {
  Banner,
  Button,
  Card,
  Heading,
  HStack,
  SegmentedControl,
  SegmentedControlItem,
  Switch,
  Text,
  VStack,
} from '@astryxdesign/core';
import {useActionState, useEffect, useRef, useState} from 'react';
import {personalSettingsSaveAction, type ActionState} from '@/app/actions';
import type {AvatarKey} from '@/lib/avatar';
import type {PersoenlicheEinstellungen, Startansicht} from '@/lib/onboarding';
import {ABWAEHLBARE_ARTEN, MAIL_ARTEN, type MailArt} from '@/lib/mail-arten';
import {AvatarAuswahl} from './avatar-auswahl';
import {Sinnbild} from './sinnbilder';

const INITIAL: ActionState = {error: null};

export function PersoenlicheEinstellungenForm({
  initial,
  hatProfilbild = false,
}: {
  initial: PersoenlicheEinstellungen;
  hatProfilbild?: boolean;
}) {
  const [startansicht, setStartansicht] = useState<Startansicht>(initial.startansicht);
  const [hinweise, setHinweise] = useState(initial.hinweiseZuOffenenTagen);
  const [avatar, setAvatar] = useState<AvatarKey>(initial.avatar);
  // Angezeigt wird, was jemand bekommen *will*; gespeichert wird die Abwahl.
  // Die Umkehr passiert beim Absenden, damit eine später hinzukommende
  // Nachrichtenart alle bisherigen Empfänger erreicht statt niemanden.
  const [mailArten, setMailArten] = useState<MailArt[]>(
    ABWAEHLBARE_ARTEN.filter((art) => !initial.mailAbbestellt.includes(art)),
  );
  const [gespeichert, setGespeichert] = useState(false);
  const [state, formAction, isPending] = useActionState(personalSettingsSaveAction, INITIAL);
  const letzterStand = useRef(state);

  useEffect(() => {
    if (state !== letzterStand.current) {
      letzterStand.current = state;
      setGespeichert(state.error === null);
    }
  }, [state]);

  const geaendert = () => setGespeichert(false);

  return (
    <form action={formAction}>
      <Card padding={4} maxWidth={680}>
        <VStack gap={4}>
          <VStack gap={1}>
            <Heading level={2}>Persönliche Einstellungen</Heading>
            <Text type="supporting" color="secondary">
              Diese Vorgaben gelten für dein Konto an jedem Arbeitsplatz.
            </Text>
          </VStack>
          {state.error && <Banner status="error" title={state.error} />}
          {gespeichert && <Banner status="success" title="Persönliche Einstellungen gespeichert." />}
          <AvatarAuswahl
            value={avatar}
            hatBild={hatProfilbild}
            onChange={(value) => {
              setAvatar(value);
              geaendert();
            }}
          />
          <SegmentedControl
            label="Startansicht nach der Anmeldung"
            value={startansicht}
            onChange={(value) => {
              setStartansicht(value as Startansicht);
              geaendert();
            }}
            layout="fill"
          >
            <SegmentedControlItem value="tag" label="Tag" icon={<Sinnbild sinn="tag" />} />
            <SegmentedControlItem value="woche" label="Woche" icon={<Sinnbild sinn="woche" />} />
            <SegmentedControlItem value="monat" label="Monat" icon={<Sinnbild sinn="monat" />} />
            <SegmentedControlItem value="konto" label="Konto" icon={<Sinnbild sinn="konto" />} />
          </SegmentedControl>
          <Switch
            label="Hinweise zu offenen Tagen"
            description="Zeigt dir den bleibenden Hinweis unten rechts, wenn vergangene Tage noch geprüft werden müssen."
            value={hinweise}
            onChange={(value) => {
              setHinweise(value);
              geaendert();
            }}
            labelPosition="start"
            labelSpacing="spread"
            width="100%"
          />
          <VStack gap={2}>
            <VStack gap={0.5}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="email" ton="sekundaer" />
                <Heading level={3}>Nachrichten per E-Mail</Heading>
              </HStack>
              <Text type="supporting" color="secondary">
                Was du zusätzlich zur Anwendung im Postfach hören möchtest. Nachrichten zu deinem Zugang –
                etwa ein zurückgesetztes Passwort – kommen immer an und stehen deshalb nicht in dieser Liste.
              </Text>
            </VStack>
            {ABWAEHLBARE_ARTEN.map((art) => (
              <Switch
                key={art}
                label={MAIL_ARTEN[art].label}
                description={MAIL_ARTEN[art].beschreibung}
                value={mailArten.includes(art)}
                onChange={(value) => {
                  setMailArten(
                    value ? [...mailArten, art] : mailArten.filter((a) => a !== art),
                  );
                  geaendert();
                }}
                labelPosition="start"
                labelSpacing="spread"
                width="100%"
              />
            ))}
          </VStack>

          <input type="hidden" name="startansicht" value={startansicht} />
          <input type="hidden" name="avatar" value={avatar} />
          <input type="hidden" name="hinweiseZuOffenenTagen" value={hinweise ? 'ja' : 'nein'} />
          {/* Immer mindestens ein Feld, auch wenn nichts gewählt ist: die
              Aktion erkennt „das Formular hat dazu eine Meinung" daran, dass
              der Schlüssel überhaupt vorkommt. Sonst hieße „alles abbestellt"
              dasselbe wie „nicht gefragt". */}
          <input type="hidden" name="mailArten" value="" />
          {mailArten.map((art) => (
            <input key={art} type="hidden" name="mailArten" value={art} />
          ))}
          <Button label="Einstellungen speichern" variant="primary" type="submit" isLoading={isPending} />
        </VStack>
      </Card>
    </form>
  );
}
