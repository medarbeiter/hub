'use client';

import {Badge, Button, HStack, Text, TextInput, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {abwesenheitGenehmigenAction, abwesenheitZurueckweisenAction} from '@/app/actions';
import {ART_LABEL, STATUS_LABEL, fmtTage, fmtUmfang} from '@/lib/abwesenheit-arten';
import type {AbwesenheitArt, AbwesenheitStatus} from '@/lib/db';
import {fmtDateRange} from '@/lib/format';
import type {PersonAngabe} from '@/lib/avatar';
import {useMelde} from './melde';
import {PersonZeichen} from './person-zeichen';
import {PruefStapel} from './pruef-stapel';
import {STATUS_VARIANT} from './abwesenheit-stapel';
import {ABWESENHEIT_STATUS_SINN, Sinnbild} from './sinnbilder';

export interface PruefZeile {
  id: number;
  userName: string;
  /** Das Profilzeichen derselben Person. */
  person?: PersonAngabe | null;
  von: string;
  bis: string;
  art: AbwesenheitArt;
  status: AbwesenheitStatus;
  notiz: string | null;
  kalendertage: number;
  arbeitstage: number;
  /** Nur bei einem eintägigen Freizeitausgleich gesetzt; sonst der ganze Tag. */
  minuten: number | null;
  /** Ob der Antrag die Rücksprache mit der/dem Vorgesetzten bestätigt hat. */
  ruecksprache: boolean;
  auDateiName: string | null;
  auFehlt: boolean;
  /** Wie der Anspruch der Person nach dieser Entscheidung stünde. */
  restNachher: number | null;
  istEigene: boolean;
}

/**
 * Die Prüfliste der Verwaltung. Neben jedem Antrag steht die Zahl, die für die
 * Entscheidung zählt — wie viele Urlaubstage danach übrig wären. Ohne sie
 * müsste die Verwaltung dieselbe Rechnung im Kopf machen, die der Antragsteller
 * schon vorgelegt bekommen hat.
 *
 * Die Zeilenanatomie teilt sie sich seit dem Umbau mit der Spesenprüfung
 * (`PruefStapel`). Bewusst **nicht** geteilt: ein „Alle genehmigen" wie dort.
 * Eine Reise ist geschehen und wird nachgerechnet; ein Urlaubsantrag ist eine
 * Entscheidung über eine Woche, in der jemand fehlen wird.
 */
export function AbwesenheitPruefListe({
  zeilen,
  zeigeId,
}: {
  zeilen: PruefZeile[];
  /** Der aus dem Teamkalender benannte Antrag (`?offen=`). */
  zeigeId?: number | null;
}) {
  /* „Rest danach" stimmt nur, solange noch entschieden wird. Bei einem bereits
     genehmigten Antrag ist es schlicht der Rest — die Spalte sagt deshalb,
     worauf sie sich in dieser Auswahl bezieht, statt eine Zukunft zu behaupten,
     die schon vorbei ist. */
  const restKopf = zeilen.some((z) => z.status === 'eingereicht') ? 'Rest danach' : 'Rest';

  return (
    <PruefStapel
      zeigeId={zeigeId}
      spalten={[
        {kopf: 'Tage', breite: 88},
        {kopf: restKopf, breite: 88},
      ]}
      leerSinn="pruefen"
      leerTitel="Nichts in dieser Auswahl."
      leerText="Sobald jemand Urlaub oder Freizeitausgleich beantragt, erscheint der Antrag hier – mit dem Restanspruch daneben, den er übrig ließe."
      eintraege={zeilen.map((z) => ({
        id: z.id,
        person: z.userName,
        personBild: z.person ?? null,
        zeitraum: fmtDateRange(z.von, z.bis),
        gegenstand: (
          <>
            <HStack gap={1.5} vAlign="center">
              <Sinnbild sinn={z.art} groesse="zeile" ton="sekundaer" />
              <Text type="body" size="sm">
                {ART_LABEL[z.art]}
              </Text>
            </HStack>
            <Badge
              variant={STATUS_VARIANT[z.status]}
              label={STATUS_LABEL[z.status]}
              icon={<Sinnbild sinn={ABWESENHEIT_STATUS_SINN[z.status]} groesse="zeile" />}
            />
            {z.auFehlt && (
              <Badge
                variant="error"
                label="Bescheinigung fehlt"
                icon={<Sinnbild sinn="warnung" groesse="zeile" />}
              />
            )}
          </>
        ),
        werte: [
          <Text key="tage" type="body" size="sm" hasTabularNumbers>
            {z.minuten != null ? `${z.minuten} Min.` : z.arbeitstage}
          </Text>,
          <Text key="rest" type="supporting" size="sm" color="inherit" hasTabularNumbers>
            <span style={{color: (z.restNachher ?? 0) < 0 ? 'var(--color-error)' : undefined}}>
              {z.restNachher === null ? '–' : z.restNachher}
            </span>
          </Text>,
        ],
        inhalt: <Entscheidung zeile={z} />,
      }))}
    />
  );
}

function Entscheidung({zeile: z}: {zeile: PruefZeile}) {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, start] = useTransition();
  const [weistZurueck, setWeistZurueck] = useState(false);
  const [grund, setGrund] = useState('');

  const lauf = (fn: () => Promise<{error: string | null}>) =>
    start(async () => {
      const {error} = await fn();
      if (error) {
        melde({ton: 'fehler', titel: error, dauerhaft: true});
        return;
      }
      setWeistZurueck(false);
      setGrund('');
      router.refresh();
    });

  return (
    <VStack gap={3}>
      {/* Wer da gefragt hat, im Arbeitsmaß — in der Zeile darüber steht das
          Zeichen zeilenklein zwischen zwölf anderen, hier wird über genau
          diesen einen Menschen entschieden. */}
      <PersonZeichen
        person={z.person ?? null}
        ersatzName={z.userName}
        groesse="karte"
        mitName
        betont
        unterzeile={`${ART_LABEL[z.art]} · ${fmtDateRange(z.von, z.bis)}`}
      />
      <HStack gap={3} vAlign="center" wrap="wrap">
        <Text type="supporting" color="secondary" hasTabularNumbers>
          {z.kalendertage} {z.kalendertage === 1 ? 'Kalendertag' : 'Kalendertage'} ·{' '}
          {fmtUmfang(z.arbeitstage, z.minuten)} mit Soll
        </Text>
        {z.notiz && (
          <Text type="supporting" color="secondary">
            „{z.notiz}"
          </Text>
        )}
        {/* Eine Tatsache über den Antrag, nicht ein Ereignis: sie steht neben
            ihm und wird nicht gemeldet. Die Rücksprache ist keine Genehmigung —
            sie sagt nur, ob die Verwaltung die erste ist, die davon hört. */}
        <HStack gap={1.5} vAlign="center">
          <Sinnbild
            sinn={z.ruecksprache ? 'genehmigen' : 'hinweis'}
            groesse="zeile"
            ton={z.ruecksprache ? 'sekundaer' : 'warnung'}
          />
          <Text type="supporting" size="sm" color="secondary">
            {z.ruecksprache
              ? 'Rücksprache mit der/dem Vorgesetzten bestätigt'
              : 'Ohne bestätigte Rücksprache erfasst'}
          </Text>
        </HStack>
      </HStack>

      {z.auDateiName && (
        <HStack gap={1.5} vAlign="center">
          <Sinnbild sinn="datei" groesse="zeile" ton="sekundaer" />
          {/* Kein next/link: die Datei kommt aus einem Route Handler, nicht aus
              dem Router — und sie soll in einem eigenen Reiter aufgehen. */}
          <a href={`/api/au/${z.id}`} target="_blank" rel="noreferrer">
            <Text type="supporting" size="sm" color="accent">
              Bescheinigung ansehen ({z.auDateiName})
            </Text>
          </a>
        </HStack>
      )}

      {/* Vor der Entscheidung ist das ein Hinweis auf eine Erlaubnis, danach
          eine Feststellung. Beides in derselben Zeit zu sagen las sich, als
          stünde die Entscheidung noch aus, obwohl sie längst gefallen war. */}
      {z.istEigene && (
        <HStack gap={1.5} vAlign="center">
          <Sinnbild sinn={z.status === 'eingereicht' ? 'warnung' : 'hinweis'} groesse="zeile" ton={z.status === 'eingereicht' ? 'warnung' : 'sekundaer'} />
          <Text type="supporting" size="sm" color="secondary">
            {z.status === 'eingereicht'
              ? 'Das ist dein eigener Antrag. Du darfst ihn genehmigen – es gibt keine zweite Instanz –, und die Selbstgenehmigung wird beim Vorgang vermerkt.'
              : 'Dein eigener Antrag, von dir selbst entschieden – es gibt keine zweite Instanz.'}
          </Text>
        </HStack>
      )}

      {z.status === 'eingereicht' &&
        (weistZurueck ? (
          <VStack gap={2}>
            <TextInput
              label="Grund der Zurückweisung"
              value={grund}
              onChange={setGrund}
              placeholder="z. B. In dieser Woche sind schon zwei Kollegen abwesend."
              description="Der Grund steht danach beim Antrag – er ist die ganze Rückmeldung, die jemand bekommt."
            />
            <HStack gap={2}>
              <Button
                label="Zurückweisen"
                variant="primary"
                size="sm"
                icon={<Sinnbild sinn="zurueckweisen" />}
                isLoading={isPending}
                isDisabled={grund.trim() === ''}
                onClick={() => lauf(() => abwesenheitZurueckweisenAction(z.id, grund))}
              />
              <Button label="Abbrechen" variant="ghost" size="sm" onClick={() => setWeistZurueck(false)} />
            </HStack>
          </VStack>
        ) : (
          <HStack gap={2} wrap="wrap">
            <Button
              label="Genehmigen"
              variant="primary"
              size="sm"
              icon={<Sinnbild sinn="genehmigen" />}
              isLoading={isPending}
              onClick={() => lauf(() => abwesenheitGenehmigenAction(z.id))}
            />
            <Button
              label="Zurückweisen"
              variant="secondary"
              size="sm"
              icon={<Sinnbild sinn="zurueckweisen" />}
              onClick={() => setWeistZurueck(true)}
            />
          </HStack>
        ))}
    </VStack>
  );
}
