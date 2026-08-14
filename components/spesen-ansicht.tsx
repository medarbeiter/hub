'use client';

import {Badge, Button, Card, Divider, HStack, Heading, Text, VStack} from '@astryxdesign/core';
import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {ReiseStatus} from '@/lib/db';
import {fmtDateLongJahr, fmtDuration, fmtEuro} from '@/lib/format';
import {useMelde} from './melde';
import {satzFuer, type SatzStufe} from '@/lib/pauschale';
import {ReiseEditor, type ReiseEntwurf} from './reise-editor';
import {ReisenGitter} from './reisen-gitter';
import {JahresStreifen, ReisenStapel, type JahresMonat} from './reisen-stapel';
import {STATUS_VARIANT, type ReiseAnsicht} from './reise-tafel';
import {REISE_STATUS_SINN, Sinnbild} from './sinnbilder';
import {ZeitRahmen} from './zeit-rahmen';

interface SpesenAnsichtProps {
  userId: number;
  ansicht: 'monat' | 'jahr';
  reisen: ReiseAnsicht[];
  /** Nur im Jahresbereich: die zwölf Monate mit ihren Summen. */
  monate: JahresMonat[];
  vonISO: string;
  bisISO: string;
  /** Der Monat des Gitters, als YYYY-MM. Im Jahresbereich ungenutzt. */
  monat: string;
  /** Tage ohne Soll im gezeigten Monat — Wochenenden und Feiertage. */
  ruhetage: string[];
  jahr: string;
  jahrSummeCent: number;
  jahrReisen: number;
  saetze: SatzStufe[];
  stempelZeiten: Record<string, {vonMin: number; bisMin: number}>;
  /** Aus „Als Dienstreise abrechnen" — öffnet den Editor mit diesem Tag. */
  neuDatum: string | null;
  heute: string;
  nav: ReactNode;
}

const STATUS_REIHE: ReiseStatus[] = ['entwurf', 'eingereicht', 'genehmigt', 'abgelehnt'];
const STATUS_TEXT: Record<ReiseStatus, string> = {
  entwurf: 'Entwurf',
  eingereicht: 'Eingereicht',
  genehmigt: 'Genehmigt',
  abgelehnt: 'Abgelehnt',
};

/**
 * Reisen & Spesen im selben Rahmen wie Meine Zeit: Kopf, Bühne, Kontext-Rail.
 * Der eigene Bereich hat seine eigene Zeitraum-Achse (Monat │ Jahr), aber
 * keine eigene Seitengrammatik — vier Zooms und ein fünfter Bereich sollen sich
 * gleich anfühlen.
 */
export function SpesenAnsicht(props: SpesenAnsichtProps) {
  const melde = useMelde();
  const [editorOffen, setEditorOffen] = useState(props.neuDatum !== null);
  const [bearbeitet, setBearbeitet] = useState<ReiseEntwurf | null>(null);
  /* Welche Reise gerade aufgeklappt ist. Der Zustand wohnt hier und nicht im
     Stapel, weil ihn zwei Dinge lesen: die Liste, die sich öffnet, und das
     Gitter, das die Tage dieser Reise hervorhebt. */
  const [offeneReise, setOffeneReise] = useState<number | null>(null);

  const summe = props.reisen.reduce((s, r) => s + r.summeCent, 0);
  const reisetage = props.reisen.reduce((s, r) => s + r.tage.length, 0);
  const abwesenheitMin = props.reisen.reduce((s, r) => s + r.abwesenheitMin, 0);
  const wartend = props.reisen.filter((r) => r.status === 'eingereicht').length;
  const offeneEntwuerfe = props.reisen.filter((r) => r.status === 'entwurf' && r.darfEinreichen);

  // Kantengetrieben wie der ArbZG-Hinweis der Stempelleiste — ersetzt sich an
  // Ort und Stelle statt sich bei jedem Rendern zu stapeln.
  const entwuerfeSchliessen = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (offeneEntwuerfe.length > 0) {
      entwuerfeSchliessen.current = melde({
        ton: 'hinweis',
        titel: `${offeneEntwuerfe.length} ${offeneEntwuerfe.length === 1 ? 'Reise ist' : 'Reisen sind'} noch nicht eingereicht`,
        text: 'Eine Abrechnung wird erst geprüft, wenn sie eingereicht ist. Öffne die Reise und reiche sie ein.',
        dauerhaft: true,
        uniqueID: 'spesen-entwuerfe',
      });
    } else {
      entwuerfeSchliessen.current?.();
      entwuerfeSchliessen.current = null;
    }
  }, [offeneEntwuerfe.length, melde]);

  const zaehler = STATUS_REIHE.map((status) => ({
    status,
    anzahl: props.reisen.filter((r) => r.status === status).length,
  })).filter((z) => z.anzahl > 0);

  // Die Rail zeigt die Stufe, die heute greift — die Reise selbst rechnet mit
  // der ihres eigenen Abfahrtstags.
  const stufe = satzFuer(props.saetze, props.heute);

  const neu = () => {
    setBearbeitet(null);
    setEditorOffen(true);
  };

  const bearbeiten = (reise: ReiseAnsicht) => {
    setBearbeitet({
      id: reise.id,
      startDate: reise.startDate,
      startMin: reise.startMin,
      endDate: reise.endDate,
      endMin: reise.endMin,
      zweck: reise.zweck,
      ziel: reise.ziel,
    });
    setEditorOffen(true);
  };

  return (
    <>
      <ZeitRahmen
        titel="Reisen & Spesen"
        figur={fmtEuro(summe)}
        figurEinheit="erstattungsfähig"
        stand={
          /* Der Leerfall bleibt hier stumm: die Bühne darunter sagt „Keine
             Reise in diesem Zeitraum erfasst." und lädt zum Erfassen ein.
             Beides zugleich war dieselbe Nachricht zweimal auf einem Blatt.
             Der Kopf zeigt stattdessen den Zeitraum, um den es geht. */
          props.reisen.length === 0
            ? `${props.ansicht === 'monat' ? 'Dieser Monat' : 'Dieses Jahr'} ist noch ohne Eintrag.`
            : `${props.reisen.length} ${props.reisen.length === 1 ? 'Reise' : 'Reisen'} · ${reisetage} ${
                reisetage === 1 ? 'Reisetag' : 'Reisetage'
              } · ${fmtDuration(abwesenheitMin)} Std. abwesend${
                wartend > 0 ? ` · ${wartend} in Prüfung` : ''
              }`
        }
        figurMeta={zaehler.map((z) => (
          <Badge
            key={z.status}
            variant={STATUS_VARIANT[z.status]}
            label={`${z.anzahl} ${STATUS_TEXT[z.status]}`}
            icon={<Sinnbild sinn={REISE_STATUS_SINN[z.status]} groesse="zeile" />}
          />
        ))}
        nav={props.nav}
        buehne={
          <VStack gap={3}>
            <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
              <HStack gap={1.5} vAlign="center">
                <Sinnbild sinn={props.ansicht} groesse="zeile" ton="sekundaer" />
                <Text type="label" color="secondary">
                  {props.ansicht === 'monat' ? 'Reisen im Monat' : 'Reisen im Jahr'}
                </Text>
              </HStack>
              <Button
                label="Reise erfassen"
                variant={props.reisen.length === 0 ? 'primary' : 'secondary'}
                size="sm"
                icon={<Sinnbild sinn="hinzufuegen" />}
                onClick={neu}
              />
            </HStack>

            {props.ansicht === 'jahr' ? (
              <JahresStreifen monate={props.monate} />
            ) : (
              <ReisenGitter
                reisen={props.reisen}
                monat={props.monat}
                ruhetage={props.ruhetage}
                heute={props.heute}
                onReise={setOffeneReise}
                offeneReise={offeneReise}
              />
            )}
          </VStack>
        }
        /* Der Stapel ist der Beleg, nicht die Bühne: das Gitter zeigt, an
           welchen Tagen gereist wurde und was jeder Tag einbringt, die Liste
           trägt die Einzelheiten und die Handlungen. Die Spanne bleibt darin,
           aber als Mikrografik in fester Spalte. */
        belege={
          <ReisenStapel
            reisen={props.reisen}
            offenId={offeneReise}
            onOffen={setOffeneReise}
            onBearbeiten={bearbeiten}
          />
        }
        kontext={
          <>
            <Card padding={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="geld" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Dieses Jahr</Heading>
                </HStack>
                <Text type="display-3" hasTabularNumbers>
                  {fmtEuro(props.jahrSummeCent)}
                </Text>
                <Text type="supporting" color="secondary" hasTabularNumbers>
                  {props.jahrReisen} {props.jahrReisen === 1 ? 'Reise' : 'Reisen'} in {props.jahr}
                </Text>
              </VStack>
            </Card>

            <Card padding={4}>
              <VStack gap={2}>
                {/* Dasselbe Zeichen wie „So entsteht die Zahl" im Zeitkonto:
                    dieselbe Frage, an zwei Orten gestellt. */}
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Wie die Pauschale entsteht</Heading>
                </HStack>
                <VStack gap={1}>
                  {/* Halber und voller Satz als halb bzw. ganz gefüllter
                      Kreis — die Zeichen sagen dasselbe wie die Beträge. */}
                  <SatzZeile sinn="satzHalb" label="An- und Abreisetag" cent={stufe.halbCent} />
                  <SatzZeile sinn="satzHalb" label="Eintägig ab 8 Std." cent={stufe.halbCent} />
                  <SatzZeile sinn="satzVoll" label="Voller Reisetag" cent={stufe.vollCent} gefuellt />
                </VStack>
                <Divider />
                <Text type="supporting" color="secondary">
                  Gerechnet wird je Kalendertag. Bei einer eintägigen Reise entsteht erst ab acht
                  Stunden Abwesenheit ein Anspruch. Dauert die Reise länger als einen Tag, zählen
                  An- und Abreisetag unabhängig von der Stundenzahl, jeder volle Tag dazwischen mit
                  dem vollen Satz – die Gesamtstundenzahl spielt dann keine Rolle mehr.
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Diese Sätze gelten seit {fmtDateLongJahr(stufe.ab)}; welche Stufe greift, entscheidet
                  der Abfahrtstag der Reise.
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Beim Einreichen werden die Sätze eingefroren – eine geprüfte Abrechnung ändert
                  ihren Betrag später nicht mehr.
                </Text>
              </VStack>
            </Card>
          </>
        }
      />

      {editorOffen && (
        <ReiseEditor
          isOpen={editorOffen}
          onOpenChange={setEditorOffen}
          userId={props.userId}
          reise={bearbeitet}
          startDatum={props.neuDatum ?? bearbeitet?.startDate ?? props.heute}
          saetze={props.saetze}
          stempelZeiten={props.stempelZeiten}
        />
      )}
    </>
  );
}

function SatzZeile({
  sinn,
  label,
  cent,
  gefuellt,
}: {
  sinn: 'satzHalb' | 'satzVoll';
  label: string;
  cent: number;
  gefuellt?: boolean;
}) {
  return (
    <HStack justify="between" gap={3}>
      <HStack gap={1.5} vAlign="center">
        <Sinnbild sinn={sinn} groesse="zeile" ton="sekundaer" form={gefuellt ? 'voll' : 'umriss'} />
        <Text type="supporting" color="secondary">
          {label}
        </Text>
      </HStack>
      <Text type="supporting" hasTabularNumbers>
        {fmtEuro(cent)}
      </Text>
    </HStack>
  );
}
