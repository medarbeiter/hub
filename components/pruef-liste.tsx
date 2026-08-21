'use client';

import {Badge, Button, HStack, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {reisenGenehmigenAlleAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {fmtDateRange, fmtDuration, fmtEuro} from '@/lib/format';
import {PruefStapel} from './pruef-stapel';
import {ReiseTafel, STATUS_VARIANT, type ReiseAnsicht} from './reise-tafel';
import {REISE_STATUS_SINN, Sinnbild} from './sinnbilder';

/**
 * Die Prüfliste der Verwaltung. Aufklappen zeigt die Reise über den
 * gestempelten Tagen derselben Person — die Frage, die eine Prüfung beantworten
 * muss, steht damit im Bild statt in einer zweiten Ansicht.
 *
 * Die Zeilenanatomie teilt sie sich seit dem Umbau mit der Abwesenheitsprüfung
 * (`PruefStapel`); eigen bleibt, was hier drinsteht — und der Sammelknopf, den
 * die Abwesenheiten bewusst nicht haben.
 */
export function PruefListe({reisen}: {reisen: ReiseAnsicht[]}) {
  return (
    <PruefStapel
      spalten={[
        {kopf: 'Abwesend', breite: 96},
        {kopf: 'Erstattung', breite: 104},
      ]}
      leerSinn="pruefen"
      leerTitel="Keine Reise wartet auf Prüfung."
      leerText="Sobald jemand eine Abrechnung einreicht, erscheint sie hier – mit den gestempelten Tagen daneben, auf die sie sich beruft."
      eintraege={reisen.map((reise) => ({
        id: reise.id,
        person: reise.userName ?? '—',
        personBild: reise.person ?? null,
        zeitraum: fmtDateRange(reise.startDate, reise.endDate),
        gegenstand: (
          <>
            <Text type="body" size="sm">
              {reise.zweck}
            </Text>
            {reise.ziel && (
              <Text type="supporting" size="sm" color="secondary">
                {reise.ziel}
              </Text>
            )}
            <Badge
              variant={STATUS_VARIANT[reise.status]}
              label={reise.statusLabel}
              icon={<Sinnbild sinn={REISE_STATUS_SINN[reise.status]} groesse="zeile" />}
            />
          </>
        ),
        werte: [
          <Text key="abwesend" type="supporting" size="sm" color="secondary" hasTabularNumbers>
            {fmtDuration(reise.abwesenheitMin)} Std.
          </Text>,
          <Text key="summe" type="body" size="sm" hasTabularNumbers>
            {fmtEuro(reise.summeCent)}
          </Text>,
        ],
        inhalt: <ReiseTafel reise={reise} zeigtStatus={false} />,
      }))}
    />
  );
}

/** „Alle genehmigen" nach dem Muster von LockAllButton: bestätigen, dann berichten. */
export function AlleGenehmigenButton({anzahl}: {anzahl: number}) {
  const [bestaetigt, setBestaetigt] = useState(false);
  const [ergebnis, setErgebnis] = useState<string | null>(null);
  const [isPending, start] = useTransition();
  const router = useRouter();

  if (anzahl === 0 && !ergebnis) return null;

  const lauf = () =>
    start(async () => {
      const outcome = await sicher(reisenGenehmigenAlleAction)();
      setBestaetigt(false);
      setErgebnis(
        outcome.error ??
          (outcome.uebersprungen > 0
            ? `${outcome.genehmigt} genehmigt, ${outcome.uebersprungen} übersprungen.`
            : `${outcome.genehmigt} ${outcome.genehmigt === 1 ? 'Reise' : 'Reisen'} genehmigt.`),
      );
      router.refresh();
    });

  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      {ergebnis && (
        <Text type="supporting" color="secondary">
          {ergebnis}
        </Text>
      )}
      {bestaetigt ? (
        <>
          <Text type="supporting">{anzahl} Abrechnungen genehmigen?</Text>
            <Button
            label="Ja, genehmigen"
            variant="primary"
            size="sm"
            isLoading={isPending}
            icon={<Sinnbild sinn="genehmigen" />}
            onClick={lauf}
          />
          <Button label="Abbrechen" variant="ghost" size="sm" onClick={() => setBestaetigt(false)} />
        </>
      ) : anzahl > 0 ? (
        <Button
          label="Alle genehmigen"
          variant="secondary"
          size="sm"
          icon={<Sinnbild sinn="genehmigen" />}
          onClick={() => setBestaetigt(true)}
        />
      ) : null}
    </HStack>
  );
}
