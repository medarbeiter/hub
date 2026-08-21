'use client';

import {
  Banner,
  Button,
  CheckboxInput,
  DialogHeader,
  Divider,
  FileInput,
  HStack,
  NumberInput,
  StackItem,
  Text,
  TextInput,
  VStack,
} from '@astryxdesign/core';
import {RadioList, RadioListItem} from '@astryxdesign/core/RadioList';
import {useRouter} from 'next/navigation';
import {useEffect, useState, useTransition} from 'react';
import {abwesenheitSaveAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {
  ART_LABEL,
  ABWESENHEIT_ARTEN,
  AU_AB_TAGEN,
  anspruchstage,
  istAntrag,
  restanspruch,
  tageDerSpanne,
  type Anspruch,
} from '@/lib/abwesenheit-arten';
import type {AbwesenheitArt} from '@/lib/db';
import {dailySollMinutes, fmtDateLong, fmtDuration, fmtDurationSigned, fmtWeekdayShort} from '@/lib/format';
import {DatumFeld} from './datum-feld';
import {Sinnbild} from './sinnbilder';
import {TafelDialog} from './tafel-dialog';

export interface AbwesenheitEntwurf {
  id: number;
  von: string;
  bis: string;
  art: AbwesenheitArt;
  notiz: string | null;
  /** Nur bei einem eintägigen Freizeitausgleich gesetzt; sonst der ganze Tag. */
  minuten: number | null;
  ruecksprache_vorgesetzte: number;
}

interface AbwesenheitEditorProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  userId: number;
  /** Bestehende Abwesenheit zum Korrigieren, sonst null. */
  abwesenheit: AbwesenheitEntwurf | null;
  /** Vorbelegung für eine neue Spanne — der angeklickte oder gezogene Tag. */
  startDatum: string;
  /** Bereits gezogene Auswahl aus dem Monatsstapel; überschreibt startDatum. */
  endDatum?: string | null;
  /** Wochenstunden der Person, um Werktage von Wochenenden zu trennen. */
  wochenMinuten: number;
  /** Feiertage des Zeitraums als ISO-Daten — der Kalender rechnet nicht im Browser. */
  feiertage: string[];
  /** Der Jahresanspruch, wie er ohne diese Spanne steht. */
  anspruch: Anspruch;
  /** Zeitkontostand in Minuten — was ein Freizeitausgleich ausgibt. */
  saldoMin: number;
}

/**
 * Eine Abwesenheit wird als Spanne erfasst, nicht als Tag. Das ist der ganze
 * Unterschied zur alten Tagesart: wer zwei Wochen frei nimmt, sagt das einmal.
 *
 * Und die Wirkung steht neben der Frage. Wer Urlaub beantragt, will wissen, wie
 * viele Tage danach übrig sind; wer Freizeitausgleich nimmt, was das Zeitkonto
 * danach sagt. Beides hier auszurechnen ist keine Verzierung — es ist die
 * Auskunft, für die man sonst jemanden fragen müsste.
 */
export function AbwesenheitEditor(props: AbwesenheitEditorProps) {
  const router = useRouter();
  const [isSaving, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const [art, setArt] = useState<AbwesenheitArt>('urlaub');
  const [von, setVon] = useState(props.startDatum);
  const [bis, setBis] = useState(props.endDatum ?? props.startDatum);
  const [notiz, setNotiz] = useState('');
  const [auDatei, setAuDatei] = useState<File | null>(null);
  const [nurMinuten, setNurMinuten] = useState(false);
  const [minuten, setMinuten] = useState(60);
  const [ruecksprache, setRuecksprache] = useState(false);

  useEffect(() => {
    if (!props.isOpen) return;
    const a = props.abwesenheit;
    setArt(a ? a.art : 'urlaub');
    setVon(a ? a.von : props.startDatum);
    setBis(a ? a.bis : (props.endDatum ?? props.startDatum));
    setNotiz(a?.notiz ?? '');
    setAuDatei(null);
    setNurMinuten(a?.minuten != null);
    setMinuten(a?.minuten ?? 60);
    setRuecksprache(a ? a.ruecksprache_vorgesetzte === 1 : false);
    setFehler(null);
  }, [props.abwesenheit, props.startDatum, props.endDatum, props.isOpen]);

  /* Kein `<form action=…>`: die Astryx-Felder sind kontrolliert und die
     Bescheinigung liegt als File im State — dieselbe Bauweise wie im
     Belegdialog. */
  const speichern = () =>
    start(async () => {
      setFehler(null);
      const fd = new FormData();
      fd.set('abwesenheitId', String(props.abwesenheit?.id ?? ''));
      fd.set('userId', String(props.userId));
      fd.set('art', art);
      fd.set('von', von);
      fd.set('bis', bis);
      fd.set('notiz', art === 'krank' ? '' : notiz);
      if (minutenAktiv) fd.set('minuten', String(minuten));
      if (istAntrag(art)) fd.set('ruecksprache', ruecksprache ? 'ja' : '');
      if (art === 'krank' && auDatei) fd.set('au', auDatei);
      const {error} = await sicher(abwesenheitSaveAction)({error: null}, fd);
      if (error) {
        setFehler(error);
        return;
      }
      props.onOpenChange(false);
      router.refresh();
    });

  const feiertage = new Set(props.feiertage);
  const sollAmTag = (datum: string) =>
    feiertage.has(datum) ? 0 : dailySollMinutes({weekly_minutes: props.wochenMinuten}, datum);

  const gueltig = von !== '' && bis !== '' && bis >= von;
  const tage = gueltig ? tageDerSpanne(von, bis) : [];
  const werktage = gueltig ? anspruchstage(von, bis, sollAmTag) : [];

  /* Ein Teiltag gibt es nur beim Freizeitausgleich, und nur an einem einzigen
     Arbeitstag: eine Woche „à 90 Minuten" wäre keine Abwesenheit mehr, sondern
     eine zweite Zeiterfassung neben der Stempeluhr. */
  const teiltagMoeglich = art === 'freizeitausgleich' && gueltig && von === bis && werktage.length === 1;
  const minutenAktiv = teiltagMoeglich && nurMinuten;
  const sollDesTages = gueltig ? sollAmTag(von) : 0;

  // Was diese Spanne kostet, je nachdem, woraus sie bezahlt wird.
  const restVorher = restanspruch(props.anspruch);
  const restNachher = restVorher - werktage.length;
  const sollMinutenDerSpanne = werktage.reduce((s, t) => s + sollAmTag(t), 0);
  const ausgabeMinuten = minutenAktiv ? minuten : sollMinutenDerSpanne;
  const saldoNachher = props.saldoMin - ausgabeMinuten;

  const minutenGueltig = !minutenAktiv || (minuten > 0 && minuten <= sollDesTages);
  const rueckspracheGueltig = !istAntrag(art) || ruecksprache;

  const istBearbeitung = props.abwesenheit !== null;

  return (
    <TafelDialog isOpen={props.isOpen} onOpenChange={props.onOpenChange} purpose="form" width={560}>
      <DialogHeader
        title={istBearbeitung ? 'Abwesenheit bearbeiten' : 'Abwesenheit erfassen'}
        subtitle="Vom ersten bis zum letzten Tag – Wochenenden und Feiertage dazwischen zählen nicht mit."
      />
      <VStack gap={4} padding={4} className="tafel-rumpf">
        {fehler && <Banner status="error" title={fehler} />}

        {/* Die Art zuerst, und mit ihrer Folge daneben. Fünf ähnliche Wörter
            in einer Klappliste sagten nicht, dass zwei davon eine Bitte sind
            und zwei eine Mitteilung — hier steht es an jedem Eintrag. */}
        <RadioList
          label="Art der Abwesenheit"
          value={art}
          onChange={(v) => setArt(v as AbwesenheitArt)}
          isDisabled={istBearbeitung}
          disabledMessage="Die Art einer erfassten Abwesenheit kann nicht gewechselt werden. Lösche sie und erfasse sie neu."
        >
          {/* Kein startContent: das Zeichen konkurrierte mit dem 23-px-
              Auswahlkreis und der Beschriftung um dieselbe Rolle, egal in
              welcher Größe oder Tinte. Die Beschreibung darunter trägt die
              Bedeutung bereits vollständig — Radio, Wort, Satz genügt. */}
          {ABWESENHEIT_ARTEN.map((a) => (
            <RadioListItem key={a} value={a} label={ART_LABEL[a]} description={ART_BESCHREIBUNG[a]} />
          ))}
        </RadioList>

        {/* Zwei Datumsfelder nebeneinander brauchen zusammen mehr Platz, als
            ein Telefon hat (gemessen: 346 px Inhalt in 319 px Sichtfeld, mit
            Querbalken). Unter 520 px stehen sie deshalb untereinander. */}
        <HStack gap={3} vAlign="start" wrap="wrap" className="spanne-felder">
          <StackItem size="fill">
            <DatumFeld
              label="Erster Tag"
              value={von}
              onChange={(neu) => {
                setVon(neu);
                if (bis < neu) setBis(neu);
              }}
              placeholder="Datum wählen"
              width="100%"
            />
          </StackItem>
          <StackItem size="fill">
            <DatumFeld
              label="Letzter Tag"
              value={bis}
              onChange={setBis}
              min={von}
              placeholder="Datum wählen"
              width="100%"
            />
          </StackItem>
        </HStack>

        {/* Nur der Freizeitausgleich kennt einen Teiltag. Er wird aus dem
            Zeitkonto bezahlt, und ein Zeitkonto rechnet ohnehin in Minuten —
            bei Urlaub gäbe es dagegen keinen halben Anspruchstag zu buchen. */}
        {teiltagMoeglich && (
          <VStack gap={2}>
            <CheckboxInput
              label="Nur einen Teil des Tages"
              description={`Sonst wird das ganze Soll dieses Tages ausgegeben (${fmtDuration(sollDesTages)} Std.).`}
              value={nurMinuten}
              onChange={setNurMinuten}
              width="100%"
            />
            {nurMinuten && (
              <NumberInput
                label="Minuten"
                description={`Höchstens ${sollDesTages} Minuten – das Soll dieses Tages.`}
                value={minuten}
                onChange={setMinuten}
                min={1}
                max={sollDesTages}
                step={15}
                width={220}
                status={
                  minutenGueltig
                    ? undefined
                    : {type: 'error', message: `Bitte 1 bis ${sollDesTages} Minuten angeben.`}
                }
              />
            )}
          </VStack>
        )}

        {art !== 'krank' && (
          <TextInput
            label="Notiz"
            value={notiz}
            onChange={setNotiz}
            placeholder={art === 'fortbildung' ? 'z. B. Hygieneschulung' : 'z. B. Sommerurlaub'}
          />
        )}

        {/* Bei Krank steht hier bewusst kein Notizfeld: es wäre die erste
            Stelle, an der eine Diagnose landet, und damit läge im
            Zeiterfasser eine Gesundheitsangabe nach Art. 9 DSGVO. */}
        {art === 'krank' && !istBearbeitung && (
          <VStack gap={1.5}>
            <FileInput
              label="Arbeitsunfähigkeitsbescheinigung"
              description="JPG, PNG, WEBP oder PDF, höchstens 10 MB. Sie kann auch später nachgereicht werden."
              placeholder="Datei wählen"
              mode="dropzone"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              maxSize={10 * 1024 * 1024}
              value={auDatei}
              onChange={(files) => setAuDatei(Array.isArray(files) ? (files[0] ?? null) : files)}
            />
            {tage.length >= AU_AB_TAGEN && (
              <HStack gap={1.5} vAlign="center">
                <Sinnbild sinn="hinweis" groesse="zeile" ton="sekundaer" />
                <Text type="supporting" size="sm" color="secondary">
                  Ab dem {AU_AB_TAGEN}. Tag ist die Bescheinigung fällig (§ 5 EFZG).
                </Text>
              </HStack>
            )}
          </VStack>
        )}

        {/* Die Wirkung, während gewählt wird — dieselbe Stelle, an der der
            Reise-Editor seine Pauschale Tag für Tag herleitet. */}
        <VStack gap={2}>
          <Divider />
          {!gueltig ? (
            <HStack gap={3} vAlign="center" paddingBlock={2} wrap="nowrap">
              <Sinnbild sinn="herleitung" groesse="leer" ton="sekundaer" />
              <Text type="supporting" color="secondary">
                Sobald der erste und der letzte Tag stehen, erscheint hier, was die Abwesenheit
                bedeutet.
              </Text>
            </HStack>
          ) : (
            <VStack gap={2}>
              <HStack justify="between" gap={3} vAlign="center">
                <HStack gap={1.5} vAlign="center">
                  <Sinnbild sinn={art} groesse="zeile" ton="sekundaer" />
                  {/* Zwei Zahlen, zwei Numeri: das Substantiv richtet sich nach
                      der Gesamtzahl, das Verb nach den Arbeitstagen. Vorher
                      stand hier „1 von 1 Kalendertag sind Arbeitstage". */}
                  <Text type="body" weight="semibold" hasTabularNumbers>
                    {werktage.length} von {tage.length}{' '}
                    {tage.length === 1 ? 'Kalendertag' : 'Kalendertagen'}{' '}
                    {werktage.length === 1 ? 'ist ein Arbeitstag' : 'sind Arbeitstage'}
                  </Text>
                </HStack>
              </HStack>

              {/* Die Tage einzeln, damit sichtbar ist, welcher nicht zählt —
                  ein Wochenende oder Feiertag mitten in der Spanne ist der
                  häufigste Grund für Nachfragen. */}
              <HStack gap={1} wrap="wrap">
                {tage.map((tag) => {
                  const zaehlt = sollAmTag(tag) > 0;
                  return (
                    <span
                      key={tag}
                      title={`${fmtDateLong(tag)}${zaehlt ? '' : ' – zählt nicht'}`}
                      style={{
                        paddingInline: 'var(--spacing-1-5)',
                        paddingBlock: 'var(--spacing-0-5)',
                        borderRadius: 'var(--radius-inner)',
                        border: `1px ${zaehlt ? 'solid' : 'dashed'} var(--color-text-secondary)`,
                        background: zaehlt ? 'var(--color-background-surface)' : 'transparent',
                      }}
                    >
                      <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                        {fmtWeekdayShort(tag)} {Number(tag.slice(8))}.
                      </Text>
                    </span>
                  );
                })}
              </HStack>

              <Divider />
              <Folge
                art={art}
                werktage={werktage.length}
                restVorher={restVorher}
                restNachher={restNachher}
                saldoVorher={props.saldoMin}
                saldoNachher={saldoNachher}
                anspruch={props.anspruch}
                teiltagMinuten={minutenAktiv ? minuten : null}
              />
            </VStack>
          )}
        </VStack>

        {/* Nur beim Antrag: eine Meldung wird nicht vorher abgestimmt — wer
            krank ist, fragt niemanden um Erlaubnis. Die Bestätigung ist keine
            zweite Genehmigung, sondern die protokollierte Aussage, dass die
            Rücksprache stattgefunden hat. */}
        {istAntrag(art) && (
          <CheckboxInput
            label="Ich bestätige, dass ich dies bereits mit meiner/meinem direkten Vorgesetzten besprochen habe."
            value={ruecksprache}
            onChange={setRuecksprache}
            width="100%"
          />
        )}

        <HStack gap={2} justify="end">
          <Button label="Abbrechen" variant="secondary" onClick={() => props.onOpenChange(false)} />
          {/* Der Knopf benennt, was er tut. Ein Antrag wird als Entwurf
              abgelegt und erst danach eingereicht; eine Meldung gilt in dem
              Moment, in dem hier gedrückt wird — „Speichern" verschwiege das. */}
          <Button
            label={
              istBearbeitung
                ? 'Speichern'
                : istAntrag(art)
                  ? 'Als Entwurf speichern'
                  : `${ART_LABEL[art]} melden`
            }
            variant="primary"
            isLoading={isSaving}
            isDisabled={!gueltig || !minutenGueltig || !rueckspracheGueltig}
            onClick={speichern}
          />
        </HStack>

        {istAntrag(art) && !istBearbeitung && (
          <Text type="supporting" size="sm" color="secondary">
            Der Antrag geht erst zur Prüfung, wenn du ihn danach einreichst – bis dahin kannst du
            ihn frei ändern.
          </Text>
        )}
      </VStack>
    </TafelDialog>
  );
}

/**
 * Was jede Art bedeutet, in einem Satz. Der entscheidende Unterschied steht
 * vorn: Bitte oder Mitteilung.
 */
const ART_BESCHREIBUNG: Record<AbwesenheitArt, string> = {
  urlaub: 'Antrag – die Verwaltung genehmigt ihn, und er kostet Urlaubstage.',
  freizeitausgleich: 'Antrag – die Verwaltung genehmigt ihn, und er wird vom Zeitkonto abgezogen.',
  krank: 'Meldung – gilt sofort, kostet keinen Urlaub und keine Zeit.',
  fortbildung: 'Meldung – gilt sofort und zählt als gearbeitete Zeit.',
};

function Folge(props: {
  art: AbwesenheitArt;
  werktage: number;
  restVorher: number;
  restNachher: number;
  saldoVorher: number;
  saldoNachher: number;
  anspruch: Anspruch;
  teiltagMinuten: number | null;
}) {
  if (props.art === 'urlaub') {
    const reicht = props.restNachher >= 0;
    return (
      <VStack gap={1}>
        <HStack justify="between" gap={3} vAlign="center">
          <Text type="body" hasTabularNumbers>
            Urlaubstage danach
          </Text>
          <Text type="body" weight="semibold" hasTabularNumbers color="inherit">
            <span style={{color: reicht ? undefined : 'var(--color-error)'}}>
              {props.restNachher} von {props.anspruch.jahresanspruch + props.anspruch.uebertrag}
            </span>
          </Text>
        </HStack>
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          Zurzeit frei: {props.restVorher}
          {props.anspruch.uebertrag > 0 && ` (davon ${props.anspruch.uebertrag} aus dem Vorjahr)`}
          {props.anspruch.beantragt > 0 && ` · ${props.anspruch.beantragt} weitere sind beantragt`}.
        </Text>
        {!reicht && (
          <HStack gap={1.5} vAlign="center">
            <Sinnbild sinn="warnung" groesse="zeile" ton="warnung" />
            <Text type="supporting" size="sm" color="secondary">
              Das übersteigt den Anspruch. Du kannst den Antrag stellen – die Verwaltung entscheidet.
            </Text>
          </HStack>
        )}
      </VStack>
    );
  }

  if (props.art === 'freizeitausgleich') {
    return (
      <VStack gap={1}>
        <HStack justify="between" gap={3} vAlign="center">
          <Text type="body">Zeitkonto danach</Text>
          <Text type="body" weight="semibold" hasTabularNumbers color="inherit">
            <span style={{color: props.saldoNachher < 0 ? 'var(--color-error)' : undefined}}>
              {fmtDurationSigned(props.saldoNachher)} Std.
            </span>
          </Text>
        </HStack>
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          Zurzeit: {fmtDurationSigned(props.saldoVorher)} Std.{' '}
          {props.teiltagMinuten !== null
            ? `Dieser Teiltag gibt ${props.teiltagMinuten} Minuten aus; die übrige Arbeitszeit des Tages wird wie sonst gestempelt.`
            : 'Jeder Ausgleichstag gibt das Soll dieses Tages aus.'}
        </Text>
      </VStack>
    );
  }

  return (
    <Text type="supporting" size="sm" color="secondary">
      {props.art === 'krank'
        ? 'Krankheitstage sind saldenneutral: das Soll dieser Tage entfällt, das Zeitkonto bleibt, wie es war.'
        : 'Fortbildungstage zählen als gearbeitete Zeit: das Soll dieser Tage gilt als erfüllt.'}
    </Text>
  );
}
