'use client';

import {Badge, Banner, Button, Card, Heading, HStack, Selector, Switch, Text, TextInput, VStack} from '@astryxdesign/core';
import {useActionState, useEffect, useRef, useState} from 'react';
import {settingsSaveAction, type ActionState} from '@/app/actions';
import {sicheresFormular} from '@/lib/aktion';
import {BUNDESLAENDER} from '@/lib/feiertage';
import {mailArtLabel} from '@/lib/mail-arten';
import type {VersandZeile} from '@/lib/mail-buch';
import {Sinnbild, type Sinn} from './sinnbilder';

/** Vier Karten, vier Fragen — das Zeichen trennt sie beim Überfliegen. */
function Kartentitel({sinn, children}: {sinn: Sinn; children: string}) {
  return (
    <HStack gap={2} vAlign="center">
      <Sinnbild sinn={sinn} groesse="gross" ton="sekundaer" />
      <Heading level={2}>{children}</Heading>
    </HStack>
  );
}

const INITIAL: ActionState = {error: null};

const LAND_OPTIONS = Object.entries(BUNDESLAENDER).map(([value, label]) => ({value, label}));

type StufenFeld = {ab: string; halb: string; voll: string};

function aendern(stufen: StufenFeld[], index: number, patch: Partial<StufenFeld>): StufenFeld[] {
  return stufen.map((s, i) => (i === index ? {...s, ...patch} : s));
}

interface SettingsFormProps {
  mergeWindowMin: number;
  /** Cutoff as HH:MM, or '' when auto-closing is switched off. */
  autoCloseCutoff: string;
  belegungGrenze: string;
  /** Two-letter code, or '' when no holidays should be computed. */
  bundesland: string;
  mailAktiv: boolean;
  mailAbsender: string;
  /** Ob ein RESEND_API_KEY hinterlegt ist — die Tatsache, nie der Schlüssel. */
  mailKonfiguriert: boolean;
  /** Die letzten Zeilen des Versandbuchs. */
  letzterVersand: VersandZeile[];
  /** Die datierte Satztabelle, Beträge als Euro-Text fürs Feld. */
  spesenStufen: Array<{ab: string; halb: string; voll: string}>;
}

const VERSAND_LABEL = {
  gesendet: 'gesendet',
  uebersprungen: 'übersprungen',
  fehler: 'fehlgeschlagen',
} as const;

/**
 * Company-wide settings. The defaults are deliberately conservative: merge
 * only true mis-clicks, never close a forgotten day behind the employee's
 * back, and invent no holidays until someone names the Bundesland.
 */
export function SettingsForm(props: SettingsFormProps) {
  const [mergeWindow, setMergeWindow] = useState(String(props.mergeWindowMin));
  const [cutoff, setCutoff] = useState(props.autoCloseCutoff);
  const [grenze, setGrenze] = useState(props.belegungGrenze);
  const [land, setLand] = useState(props.bundesland);
  const [mailAn, setMailAn] = useState(props.mailAktiv);
  const [absender, setAbsender] = useState(props.mailAbsender);
  const [stufen, setStufen] = useState(props.spesenStufen);
  const [isSaved, setSaved] = useState(false);
  const [state, formAction, isSaving] = useActionState(sicheresFormular(settingsSaveAction), INITIAL);
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
              <Kartentitel sinn="zusammenfuehren">Verstempeln zusammenführen</Kartentitel>
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
              <Kartentitel sinn="ohneEnde">Vergessene Ausstempelungen</Kartentitel>
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

        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Kartentitel sinn="teamkalender">Belastungsgrenze im Teamkalender</Kartentitel>
              <Text type="supporting" color="secondary">
                Ab wie vielen gleichzeitig Abwesenden die Kurve unter dem Teamkalender warnt. Gezählt wird nur,
                was feststeht – ein eingereichter Antrag bindet nichts. Feld leer lassen, damit gar keine Grenze
                gezeichnet wird: wie viele gleichzeitig zu viele sind, weiß nur der Betrieb.
              </Text>
            </VStack>
            <TextInput
              label="Höchstens gleichzeitig abwesend"
              value={grenze}
              onChange={edit(setGrenze)}
              htmlName="belegungGrenze"
              placeholder="z. B. 2 – leer = keine Grenze"
              width={200}
            />
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Kartentitel sinn="feiertag">Feiertage</Kartentitel>
              <Text type="supporting" color="secondary">
                Gesetzliche Feiertage werden aus dem Bundesland berechnet und zählen als bezahlte Abwesenheit – sie
                erzeugen also kein Minus im Zeitkonto und gelten nicht als fehlender Tag. Für einzelne Mitarbeiter in
                einem anderen Bundesland lässt sich das im Mitarbeiterprofil überschreiben. Ohne Angabe werden keine
                Feiertage berechnet.
              </Text>
            </VStack>
            <Selector
              label="Bundesland"
              options={LAND_OPTIONS}
              value={land}
              onChange={edit(setLand)}
              htmlName="bundesland"
              placeholder="Kein Bundesland gewählt"
              hasSearch
              searchPlaceholder="Bundesland suchen"
              width={280}
            />
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Kartentitel sinn="email">E-Mail-Benachrichtigungen</Kartentitel>
              <Text type="supporting" color="secondary">
                Entscheidungen, Monatsabschlüsse und Zugangsdaten werden zusätzlich per E-Mail verschickt. Dass ein Antrag
                oder eine Abrechnung eingereicht wurde, verschickt niemand – das steht in der Prüfliste. Eine E-Mail gibt es
                erst, wenn ein Vorgang drei Tage lang unentschieden liegen bleibt. Jede und jeder kann die meisten
                Nachrichten im eigenen Profil abbestellen; Zugangsdaten kommen immer an. Ist der Versand aus, läuft
                alles Übrige unverändert weiter, nur ohne E-Mails.
              </Text>
            </VStack>

            {!props.mailKonfiguriert && (
              /* Kein Fehler, sondern eine Tatsache über den Betrieb — und
                 deshalb ein Banner in der Karte, kein Toast. */
              <Banner
                status="info"
                title="Kein Zugangsschlüssel hinterlegt"
                description="Ohne RESEND_API_KEY in der .env wird nichts versendet; jede Nachricht steht stattdessen in der Server-Konsole. Alles andere funktioniert unverändert."
              />
            )}

            <Switch
              label="E-Mail-Versand"
              description="Aus heißt: keine E-Mail geht raus."
              value={mailAn}
              onChange={edit(setMailAn)}
              labelPosition="start"
              labelSpacing="spread"
              width="100%"
            />
            <input type="hidden" name="mailAktiv" value={mailAn ? 'ja' : 'nein'} />

            <TextInput
              label="Absender"
              value={absender}
              onChange={edit(setAbsender)}
              htmlName="mailAbsender"
              placeholder="MedArbeiter Hub <zeit@hub.med-arbeiter.de>"
              description="Die Domain muss bei Resend verifiziert sein, sonst wird jede Nachricht abgewiesen. Vorgabe ist hub.med-arbeiter.de."
              width="100%"
            />

            {props.letzterVersand.length > 0 && (
              <VStack gap={1}>
                <Text type="supporting" color="secondary">
                  Zuletzt versendet
                </Text>
                {props.letzterVersand.map((zeile) => (
                  <HStack key={zeile.id} gap={2} vAlign="center" wrap="wrap">
                    <Text type="supporting" color="secondary" style={{fontVariantNumeric: 'tabular-nums'}}>
                      {zeile.ts.slice(0, 16).replace('T', ' ')}
                    </Text>
                    <Text type="supporting">{mailArtLabel(zeile.art)}</Text>
                    <Text type="supporting" color="secondary">
                      an {zeile.empfaenger}
                    </Text>
                    {/* Nur der Ausfall trägt ein Abzeichen. Stünde neben jeder
                        Zeile ein grünes „gesendet", fiele die eine rote nicht
                        mehr auf — die Badge-Regel des Systems. */}
                    {zeile.ergebnis === 'fehler' ? (
                      <Badge variant="error" label={VERSAND_LABEL.fehler} />
                    ) : (
                      <Text type="supporting" color="secondary">
                        {VERSAND_LABEL[zeile.ergebnis]}
                      </Text>
                    )}
                  </HStack>
                ))}
              </VStack>
            )}
          </VStack>
        </Card>

        <Card padding={4}>
          <VStack gap={3}>
            <VStack gap={1}>
              <Kartentitel sinn="verpflegung">Verpflegungspauschale</Kartentitel>
              <Text type="supporting" color="secondary">
                Gerechnet wird je Kalendertag: der halbe Satz für An- und Abreisetag sowie für eine
                eintägige Reise ab acht Stunden Abwesenheit, der volle Satz für jeden Tag, der ganz
                auf Reise liegt. Welche Stufe gilt, entscheidet der Abfahrtstag der Reise. Beim
                Einreichen werden die Sätze eingefroren – bereits eingereichte oder genehmigte
                Abrechnungen ändern ihren Betrag hier nicht mehr.
              </Text>
            </VStack>

            <VStack gap={2}>
              {stufen.map((stufe, i) => (
                <HStack key={i} gap={3} vAlign="end" wrap="wrap">
                  <TextInput
                    label="Gültig ab"
                    value={stufe.ab}
                    onChange={edit((value: string) => setStufen(aendern(stufen, i, {ab: value})))}
                    placeholder="JJJJ-MM-TT"
                    width={150}
                  />
                  <TextInput
                    label="Halber Satz (€)"
                    value={stufe.halb}
                    onChange={edit((value: string) => setStufen(aendern(stufen, i, {halb: value})))}
                    width={150}
                  />
                  <TextInput
                    label="Voller Satz (€)"
                    value={stufe.voll}
                    onChange={edit((value: string) => setStufen(aendern(stufen, i, {voll: value})))}
                    width={150}
                  />
                  {stufen.length > 1 && (
                    /* Bei zwei Stufen standen zwei gleichlautende Schaltflächen
                       untereinander, und keine sagte, welche der beiden sie
                       wegnimmt. Das Datum der Stufe gehört in die Beschriftung
                       — auch für die Vorlesesoftware, die sonst zweimal
                       dasselbe hört. */
                    <Button
                      label={stufe.ab ? `Stufe ab ${stufe.ab} entfernen` : 'Neue Stufe entfernen'}
                      variant="ghost"
                      size="sm"
                      style={{color: 'var(--color-error)'}}
                      icon={<Sinnbild sinn="entfernen" />}
                      onClick={() => {
                        setSaved(false);
                        setStufen(stufen.filter((_, j) => j !== i));
                      }}
                    />
                  )}
                </HStack>
              ))}
              <HStack>
                <Button
                  label="Stufe hinzufügen"
                  variant="secondary"
                  size="sm"
                  icon={<Sinnbild sinn="hinzufuegen" />}
                  onClick={() => {
                    setSaved(false);
                    setStufen([...stufen, {ab: '', halb: '', voll: ''}]);
                  }}
                />
              </HStack>
              {/* Die Astryx-Felder posten nur über htmlName; die Tabelle geht
                  deshalb als ein JSON-Feld mit. */}
              <input type="hidden" name="spesenStufen" value={JSON.stringify(stufen)} />
            </VStack>
          </VStack>
        </Card>

        <HStack gap={2}>
          <Button label="Speichern" variant="primary" type="submit" isLoading={isSaving} />
        </HStack>
      </VStack>
    </form>
  );
}
