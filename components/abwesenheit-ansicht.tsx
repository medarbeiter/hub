'use client';

import {Badge, Button, Card, Divider, HStack, Heading, Text, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useEffect, useRef, useState, useTransition, type ReactNode} from 'react';
import {
  abwesenheitDeleteAction,
  abwesenheitEinreichenAction,
  abwesenheitZurueckziehenAction,
} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {ART_LABEL, STATUS_LABEL, fmtTage, restanspruch, type Anspruch} from '@/lib/abwesenheit-arten';
import type {AbwesenheitArt, AbwesenheitStatus} from '@/lib/db';
import {AbwesenheitEditor, type AbwesenheitEntwurf} from './abwesenheit-editor';
import {AbwesenheitsGitter, AbwesenheitsJahr} from './abwesenheit-gitter';
import {AbwesenheitStapel, STATUS_VARIANT, type AbwesenheitAnsicht} from './abwesenheit-stapel';
import {AuNachreichen} from './au-nachreichen';
import {useMelde} from './melde';
import {WahlAnzeige, useGitterWahl} from './monatsgitter';
import {ABWESENHEIT_STATUS_SINN, Sinnbild} from './sinnbilder';
import {ZeitRahmen} from './zeit-rahmen';

interface AbwesenheitAnsichtProps {
  userId: number;
  ansicht: 'monat' | 'jahr';
  abwesenheiten: AbwesenheitAnsicht[];
  vonISO: string;
  bisISO: string;
  /** Der Monat des Gitters, als YYYY-MM. Im Jahresbereich ungenutzt. */
  monat: string;
  /** Tage ohne Soll im gezeigten Zeitraum — Wochenenden und Feiertage. */
  ruhetage: string[];
  jahr: string;
  anspruch: Anspruch;
  saldoMin: number;
  wochenMinuten: number;
  feiertage: string[];
  /** Aus dem Monatsstapel gezogen: öffnet den Editor mit dieser Spanne. */
  neuVon: string | null;
  neuBis: string | null;
  heute: string;
  nav: ReactNode;
}

const STATUS_REIHE: AbwesenheitStatus[] = ['entwurf', 'eingereicht', 'gemeldet', 'genehmigt', 'abgelehnt'];

/**
 * Abwesenheit im selben Rahmen wie Meine Zeit und Reisen & Spesen: Kopf,
 * Bühne, Kontext-Rail. Die eine Zahl des Kopfes ist der Restanspruch — das ist
 * die Zahl, wegen der man diese Seite überhaupt aufmacht.
 */
export function AbwesenheitAnsicht(props: AbwesenheitAnsichtProps) {
  const router = useRouter();
  const melde = useMelde();
  const [isPending, start] = useTransition();
  const [editorOffen, setEditorOffen] = useState(props.neuVon !== null);
  const [bearbeitet, setBearbeitet] = useState<AbwesenheitEntwurf | null>(null);
  const [auFuer, setAuFuer] = useState<AbwesenheitAnsicht | null>(null);
  // Die Ziehauswahl über Kalendertage — sie schreibt ?von=&bis= und öffnet
  // damit denselben Editor, den auch der Knopf öffnet.
  const wahl = useGitterWahl('/abwesenheit');

  /**
   * `?von=&bis=` öffnet den Editor — aber der Anfangswert von useState wird nur
   * beim Einhängen gelesen. Wer schon auf dieser Seite steht und die Abkürzung
   * in der Navigation benutzt, wechselt bloß die Adresse: die Komponente bleibt
   * dieselbe, und es passierte nichts. Verglichen wird die Spanne selbst, nicht
   * bloß ihr Vorhandensein — sonst risse ein Schließen die Tafel sofort wieder
   * auf, denn die Adresse behält ihre Parameter.
   */
  const letzteWahl = useRef(`${props.neuVon}|${props.neuBis}`);
  useEffect(() => {
    const jetzt = `${props.neuVon}|${props.neuBis}`;
    if (jetzt === letzteWahl.current) return;
    letzteWahl.current = jetzt;
    if (props.neuVon) {
      setBearbeitet(null);
      setEditorOffen(true);
    }
  }, [props.neuVon, props.neuBis]);

  const lauf = (fn: () => Promise<{error: string | null}>) =>
    start(async () => {
      const {error} = await sicher(fn)();
      if (error) melde({ton: 'fehler', titel: error, dauerhaft: true});
      router.refresh();
    });

  const rest = restanspruch(props.anspruch);
  const gesamt = props.anspruch.jahresanspruch + props.anspruch.uebertrag;

  const urlaubstage = props.abwesenheiten
    .filter((a) => a.art === 'urlaub' && a.status === 'genehmigt')
    .reduce((s, a) => s + a.arbeitstage.length, 0);
  const kranktage = props.abwesenheiten
    .filter((a) => a.art === 'krank')
    .reduce((s, a) => s + a.arbeitstage.length, 0);
  const entwuerfe = props.abwesenheiten.filter((a) => a.darfEinreichen);
  const auFehlt = props.abwesenheiten.filter((a) => a.auFehlt);

  // Beide zählen einen offenen Zustand, der anhält, bis jemand handelt — wie
  // der ArbZG-Hinweis der Stempelleiste feuern sie kantengetrieben und
  // ersetzen sich an Ort und Stelle statt sich bei jedem Rendern zu stapeln.
  const auFehltSchliessen = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (auFehlt.length > 0) {
      auFehltSchliessen.current = melde({
        ton: 'warnung',
        titel: `${auFehlt.length === 1 ? 'Eine Krankmeldung braucht' : `${auFehlt.length} Krankmeldungen brauchen`} noch eine Bescheinigung`,
        text: 'Ab dem dritten Tag ist die Arbeitsunfähigkeitsbescheinigung fällig (§ 5 EFZG). Öffne den Eintrag und reiche sie nach.',
        dauerhaft: true,
        uniqueID: 'abwesenheit-au-fehlt',
      });
    } else {
      auFehltSchliessen.current?.();
      auFehltSchliessen.current = null;
    }
  }, [auFehlt.length, melde]);

  const entwuerfeSchliessen = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (entwuerfe.length > 0) {
      entwuerfeSchliessen.current = melde({
        ton: 'hinweis',
        titel: `${entwuerfe.length} ${entwuerfe.length === 1 ? 'Antrag ist' : 'Anträge sind'} noch nicht eingereicht`,
        text: 'Ein Entwurf ändert nichts und erreicht niemanden. Öffne ihn und reiche ihn ein.',
        dauerhaft: true,
        uniqueID: 'abwesenheit-entwuerfe',
      });
    } else {
      entwuerfeSchliessen.current?.();
      entwuerfeSchliessen.current = null;
    }
  }, [entwuerfe.length, melde]);

  const zaehler = STATUS_REIHE.map((status) => ({
    status,
    anzahl: props.abwesenheiten.filter((a) => a.status === status).length,
  })).filter((z) => z.anzahl > 0);

  const neu = () => {
    setBearbeitet(null);
    setEditorOffen(true);
  };

  return (
    <>
      <ZeitRahmen
        titel="Abwesenheit"
        figur={String(rest)}
        /* Kurz halten: die Einheit steht in `large` neben der Anzeigenzahl und
           lief auf dem Telefon über zwei Zeilen, wo sie die Zahl selbst
           erschlug. „22 von 30 Urlaubstagen" sagt dasselbe in einer Zeile. */
        figurEinheit={`von ${gesamt} ${gesamt === 1 ? 'Urlaubstag' : 'Urlaubstagen'}`}
        figurTon={rest < 0 ? 'negativ' : 'arbeit'}
        stand={
          /* „0 Tage krank" ist keine Nachricht, sondern Lärm — dieselbe Regel
             wie bei den Zahlen in der Seitenleiste: was null ist, steht nicht
             da. Übrig bleibt, was tatsächlich in diesem Zeitraum passiert ist. */
          props.abwesenheiten.length === 0
            ? `${props.ansicht === 'monat' ? 'Dieser Monat' : 'Dieses Jahr'} ist ohne Abwesenheit.`
            : [
                `${props.abwesenheiten.length} ${props.abwesenheiten.length === 1 ? 'Eintrag' : 'Einträge'}`,
                urlaubstage > 0 && `${fmtTage(urlaubstage)} Urlaub`,
                kranktage > 0 && `${fmtTage(kranktage)} krank`,
                props.anspruch.beantragt > 0 && `${props.anspruch.beantragt} beantragt`,
              ]
                .filter(Boolean)
                .join(' · ')
        }
        figurMeta={zaehler.map((z) => (
          <Badge
            key={z.status}
            variant={STATUS_VARIANT[z.status]}
            label={`${z.anzahl} ${STATUS_LABEL[z.status]}`}
            icon={<Sinnbild sinn={ABWESENHEIT_STATUS_SINN[z.status]} groesse="zeile" />}
          />
        ))}
        nav={props.nav}
        buehne={
          <VStack gap={3}>
            <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
              <HStack gap={1.5} vAlign="center">
                <Sinnbild sinn={props.ansicht} groesse="zeile" ton="sekundaer" />
                <Text type="label" color="secondary">
                  {props.ansicht === 'monat' ? 'Abwesenheit im Monat' : 'Abwesenheit im Jahr'}
                </Text>
              </HStack>
              <Button
                label="Abwesenheit erfassen"
                variant={props.abwesenheiten.length === 0 ? 'primary' : 'secondary'}
                size="sm"
                icon={<Sinnbild sinn="hinzufuegen" />}
                onClick={neu}
              />
            </HStack>

            {props.ansicht === 'monat' ? (
              <VStack gap={2}>
                <WahlAnzeige spanne={wahl.spanne} />
                <AbwesenheitsGitter
                  abwesenheiten={props.abwesenheiten}
                  monat={props.monat}
                  ruhetage={props.ruhetage}
                  heute={props.heute}
                  wahl={wahl}
                />
                <Text type="supporting" size="sm" color="secondary" as="p">
                  Einen Tag anklicken oder über mehrere ziehen – daraus wird eine Abwesenheit.
                </Text>
              </VStack>
            ) : (
              <AbwesenheitsJahr abwesenheiten={props.abwesenheiten} jahr={props.jahr} heute={props.heute} />
            )}
          </VStack>
        }
        /* Der Stapel ist jetzt der Beleg, nicht die Bühne: das Gitter zeigt die
           Lage, die Liste die Einzelheiten und die Handlungen. Die Spanne
           bleibt darin, aber als Mikrografik in einer festen Spalte — dasselbe
           Muster, mit dem der Saldo-Trend in den Berichten lebt. */
        belege={
          <AbwesenheitStapel
            abwesenheiten={props.abwesenheiten}
            vonISO={props.vonISO}
            bisISO={props.bisISO}
            isPending={isPending}
            onBearbeiten={(a) => {
              setBearbeitet({
                id: a.id,
                von: a.von,
                bis: a.bis,
                art: a.art,
                notiz: a.notiz,
                minuten: a.minuten,
                ruecksprache_vorgesetzte: a.ruecksprache_vorgesetzte,
              });
              setEditorOffen(true);
            }}
            onEinreichen={(id) => lauf(() => abwesenheitEinreichenAction(id))}
            onZurueckziehen={(id) => lauf(() => abwesenheitZurueckziehenAction(id))}
            onLoeschen={(id) => lauf(() => abwesenheitDeleteAction(id))}
            onAuNachreichen={setAuFuer}
          />
        }
        kontext={
          <>
            {/* Die Zahl selbst steht schon im Kopf, in Anzeigengröße. Hier steht
                nur, wie sie zustande kommt — dieselbe Aufteilung wie beim
                Zeitkonto, wo die Herleitung ebenfalls in der Rail liegt. */}
            <Card padding={4}>
              <VStack gap={2}>
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="urlaub" groesse="gross" ton="sekundaer" />
                  {/* Ohne die Zahl: sie steht schon zweimal auf diesem Blatt —
                      in Anzeigengröße im Kopf und in der Summenzeile unten. */}
                  <Heading level={3}>So entsteht der Anspruch</Heading>
                </HStack>
                <AnspruchZeile label="Jahresanspruch" wert={props.anspruch.jahresanspruch} />
                {props.anspruch.uebertrag > 0 && (
                  <AnspruchZeile label="Übertrag aus dem Vorjahr" wert={props.anspruch.uebertrag} />
                )}
                <AnspruchZeile label="Genehmigt" wert={-props.anspruch.genehmigt} />
                {props.anspruch.beantragt > 0 && (
                  <AnspruchZeile
                    label="Beantragt (noch nicht abgezogen)"
                    wert={props.anspruch.beantragt}
                    gedaempft
                  />
                )}
                <Divider />
                <HStack justify="between" gap={3}>
                  <HStack gap={1.5} vAlign="center">
                    <Sinnbild sinn="summe" groesse="zeile" ton="sekundaer" />
                    <Text type="supporting" weight="semibold">
                      Frei in {props.jahr}
                    </Text>
                  </HStack>
                  <Text type="supporting" weight="semibold" hasTabularNumbers>
                    {rest} von {gesamt}
                  </Text>
                </HStack>
              </VStack>
            </Card>

            <Card padding={4}>
              <VStack gap={2}>
                {/* Dasselbe Zeichen wie im Zeitkonto und bei der Pauschale:
                    dieselbe Frage, an drei Orten gestellt. */}
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Was welche Art bedeutet</Heading>
                </HStack>
                <VStack gap={1}>
                  <ArtZeile art="urlaub" text="Antrag · kostet Urlaubstage · Soll entfällt" />
                  <ArtZeile art="freizeitausgleich" text="Antrag · zahlt aus dem Zeitkonto" />
                  <ArtZeile art="krank" text="Meldung · gilt sofort · Soll entfällt" />
                  <ArtZeile art="fortbildung" text="Meldung · gilt sofort · zählt als gearbeitet" />
                </VStack>
                <Divider />
                <Text type="supporting" color="secondary">
                  Gezählt werden nur Tage mit einem Soll. Wochenenden und Feiertage innerhalb einer
                  Abwesenheit kosten nichts – an ihnen wäre ohnehin nicht gearbeitet worden.
                </Text>
                <Text type="supporting" size="sm" color="secondary">
                  Abgezogen wird bei der Genehmigung. Ein eingereichter Antrag steht oben getrennt,
                  weil er noch nicht gewährt ist.
                </Text>
              </VStack>
            </Card>
          </>
        }
      />

      {editorOffen && (
        <AbwesenheitEditor
          isOpen={editorOffen}
          onOpenChange={setEditorOffen}
          userId={props.userId}
          abwesenheit={bearbeitet}
          startDatum={props.neuVon ?? bearbeitet?.von ?? props.heute}
          endDatum={props.neuBis}
          wochenMinuten={props.wochenMinuten}
          feiertage={props.feiertage}
          anspruch={props.anspruch}
          saldoMin={props.saldoMin}
        />
      )}

      {auFuer && (
        <AuNachreichen
          isOpen={auFuer !== null}
          onOpenChange={(offen) => !offen && setAuFuer(null)}
          abwesenheitId={auFuer.id}
          jahr={auFuer.von.slice(0, 4)}
          zeitraum={`${ART_LABEL[auFuer.art]}, ${auFuer.tage.length} ${auFuer.tage.length === 1 ? 'Tag' : 'Tage'}`}
        />
      )}
    </>
  );
}

function AnspruchZeile({label, wert, gedaempft}: {label: string; wert: number; gedaempft?: boolean}) {
  return (
    <HStack justify="between" gap={3}>
      <Text type="supporting" color="secondary">
        {label}
      </Text>
      <Text type="supporting" color={gedaempft ? 'secondary' : 'primary'} hasTabularNumbers>
        {wert > 0 ? `+${wert}` : String(wert)}
      </Text>
    </HStack>
  );
}

function ArtZeile({art, text}: {art: AbwesenheitArt; text: string}) {
  return (
    /* `vAlign="start"`, weil zwei dieser Zeilen umbrechen: mittig ausgerichtet
       rutschte das Zeichen in die Lücke zwischen den beiden Textzeilen und
       stand neben nichts. Gemessen: Zeichenmitte bei 20 px statt bei 10 px,
       also genau zwischen den Zeilen. Der Innenabstand oben setzt es auf die
       Grundlinie der ersten Zeile zurück. */
    <HStack gap={1.5} vAlign="start" wrap="nowrap">
      <span style={{display: 'flex', paddingBlockStart: 'var(--spacing-0-5)'}}>
        <Sinnbild sinn={art} groesse="zeile" ton="sekundaer" />
      </span>
      <Text type="supporting" size="sm" color="secondary">
        <strong>{ART_LABEL[art]}</strong> – {text}
      </Text>
    </HStack>
  );
}
