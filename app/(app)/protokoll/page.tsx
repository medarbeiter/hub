import {Badge, Button, Card, HStack, Heading, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {MonatJahrLeiste} from '@/components/bereichs-leiste';
import {KettenPruefung} from '@/components/ketten-pruefung';
import {ProtokollBand, ProtokollGitter} from '@/components/protokoll-band';
import {ProtokollFilter} from '@/components/protokoll-filter';
import {ProtokollListe, type ProtokollZeile} from '@/components/protokoll-liste';
import {Sinnbild} from '@/components/sinnbilder';
import {ZeitRahmen} from '@/components/zeit-rahmen';
import {requireUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {istMonatJahrBereich, type MonatJahrBereich} from '@/lib/bereiche';
import {bundeslandFor} from '@/lib/daytypes';
import {holidaysInRange} from '@/lib/feiertage';
import {
  addDays,
  dailySollMinutes,
  einParameter,
  fmtDate,
  fmtDateMitWochentag,
  istMonat,
  letzterTagDesMonats,
  monthOf,
  todayISO,
} from '@/lib/format';
import {protokollBeteiligte, protokollProTag, protokollSeite, type ProtokollFilter as Filter} from '@/lib/protokoll';
import {
  BEREICH_LABEL,
  ERFASSUNG_LABEL,
  istBereich,
  istEingriff,
  istErfassungsart,
} from '@/lib/protokoll-arten';

export const dynamic = 'force-dynamic';

/** Wie viele Zeilen auf eine Seite gehen. */
const JE_SEITE = 50;

/**
 * Jeder Parameter kann als Feld ankommen (`?suche=a&suche=b`) — Next reicht
 * das so durch. Genommen wird der erste; geprüft wird jeder einzeln weiter
 * unten.
 */
type RohParams = Record<string, string | string[] | undefined>;

interface PageProps {
  searchParams: Promise<RohParams>;
}

/** Die eingefrorenen Werte einer Zeile als Paare — der Server liest das JSON, nicht der Browser. */
function paare(json: string | null): Array<[string, string]> {
  if (!json) return [];
  try {
    const werte = JSON.parse(json) as Record<string, unknown>;
    return Object.entries(werte).map(([k, v]) => [k, String(v)]);
  } catch {
    return [];
  }
}

/**
 * Das Protokoll.
 *
 * Zwei Leserschaften, eine Seite. Die Verwaltung sieht alles und filtert nach
 * Person, Bereich und Tag; ein Mitarbeiter sieht, was den eigenen Datensatz
 * berührt hat — das ist die Auskunft nach Art. 15 DSGVO und zugleich das, was
 * jemandem erlaubt, einer Korrektur zu widersprechen. Der Zuschnitt liegt
 * nicht in der Seite, sondern in `protokollSeite()`: eine Sichtbarkeitsregel,
 * die in der Anzeige steht, ist eine Sichtbarkeitsregel, an der man vorbeikommt.
 */
export default async function ProtokollPage({searchParams}: PageProps) {
  const user = await requireUser();
  const roh = await searchParams;
  const params: Record<string, string | undefined> = Object.fromEntries(
    Object.entries(roh).map(([k, v]) => [k, einParameter(v)]),
  );
  const today = todayISO();
  const istVerwaltung = hatRecht(user, 'protokoll.alle');

  const ansicht: MonatJahrBereich = istMonatJahrBereich(params.ansicht) ? params.ansicht : 'monat';
  const monat = istMonat(params.monat) ? params.monat : monthOf(today);
  const jahr = monat.slice(0, 4);
  const zeitraumVon = ansicht === 'monat' ? `${monat}-01` : `${jahr}-01-01`;
  const zeitraumBis = ansicht === 'monat' ? letzterTagDesMonats(monat) : `${jahr}-12-31`;

  // Ein gewählter Tag verengt den Zeitraum, statt ihn zu ersetzen: das Band
  // zeigt weiter den ganzen Monat, damit man sieht, wo man gerade steht.
  const tag =
    /^\d{4}-\d{2}-\d{2}$/.test(params.tag ?? '') && params.tag! >= zeitraumVon && params.tag! <= zeitraumBis
      ? params.tag!
      : null;

  const seite = Math.max(1, Number(params.seite ?? '1') || 1);
  const erfassung = istErfassungsart(params.erfassung) ? params.erfassung : null;
  // Wer nach der Erfassungsart fragt, will die Zeilen dieser Art sehen — auch
  // die gestempelten, die als Routine gelten. Sonst wählte man „Gestempelt"
  // und bekäme eine leere Seite: die Vorauswahl zeigt Eingriffe, und
  // Einstempeln ist keiner. Die Frage selbst ist der Zuschnitt.
  const nurEingriffe = params.nur !== 'alles' && erfassung === null;

  const basis: Filter = {
    sichtbarFuer: user,
    bereich: istBereich(params.bereich) ? params.bereich : null,
    betroffenId: istVerwaltung && params.person ? Number(params.person) || null : null,
    akteurId: istVerwaltung && params.akteur ? Number(params.akteur) || null : null,
    erfassung,
    suche: params.suche ?? null,
  };

  const {eintraege, gesamt} = protokollSeite({
    ...basis,
    vonISO: tag ?? zeitraumVon,
    bisISO: tag ?? zeitraumBis,
    nurEingriffe,
    sortierung: params.sortierung === 'alt' ? 'alt' : 'neu',
    limit: JE_SEITE,
    offset: (seite - 1) * JE_SEITE,
  });

  // Das Band zeigt immer den ganzen Zeitraum — auch wenn die Liste auf einen
  // Tag gefiltert ist. Sonst verlöre man beim Hineinzoomen den Zusammenhang,
  // der überhaupt der Grund war hinzusehen.
  const bandTage = protokollProTag({...basis, vonISO: zeitraumVon, bisISO: zeitraumBis});
  // Nur laden, was die Filterleiste auch anbietet: ein Mitarbeiter filtert
  // nicht nach Person, und dann hat seine Seite auch keine Namensliste
  // mitzuschicken.
  const beteiligte = istVerwaltung
    ? protokollBeteiligte({sichtbarFuer: user})
    : {akteure: [], betroffene: []};

  // Die Ruhetage hinterlegen die Zellen des Gitters — reine Lesehilfe: an einem
  // Sonntag wird selten korrigiert, und genau das soll man sehen können.
  const land = bundeslandFor(user);
  const feiertage = land ? holidaysInRange(zeitraumVon, zeitraumBis, land) : new Map<string, string>();
  const ruhetage: string[] = [];
  for (let d = zeitraumVon; d <= zeitraumBis; d = addDays(d, 1)) {
    if (feiertage.has(d) || dailySollMinutes(user, d) === 0) ruhetage.push(d);
  }

  const zeilen: ProtokollZeile[] = eintraege.map((e) => ({
    id: e.id,
    tag: fmtDateMitWochentag(e.ts.slice(0, 10)),
    uhrzeit: e.ts.slice(11, 16),
    akteur: e.akteur_name,
    akteurRolle: e.akteur_rolle,
    betroffen: e.betroffen_name,
    bereich: e.bereich,
    aktion: e.aktion,
    gegenstand: e.gegenstand,
    // Nur, wenn er etwas anderes sagt als der Zeitpunkt der Handlung: eine
    // Korrektur am selben Tag braucht die Angabe nicht.
    datum: e.datum && e.datum.slice(0, 10) !== e.ts.slice(0, 10) ? fmtDate(padMonat(e.datum)) : null,
    fehler: e.meldung,
    vorher: paare(e.vorher),
    nachher: paare(e.nachher),
    hash: e.hash,
    vorherHash: e.vorher_hash,
  }));

  const eingriffeImZeitraum = bandTage.reduce((s, t) => s + t.eingriffe, 0);
  const fehlerImZeitraum = bandTage.reduce((s, t) => s + t.fehler, 0);
  const routineImZeitraum = bandTage.reduce((s, t) => s + t.routine, 0);
  const seiten = Math.max(1, Math.ceil(gesamt / JE_SEITE));

  const mitSeite = (n: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) p.set(k, String(v));
    p.set('seite', String(n));
    return `/protokoll?${p.toString()}`;
  };

  return (
    <ZeitRahmen
      titel="Protokoll"
      figur={String(eingriffeImZeitraum)}
      /* Kurz halten: die Einheit steht in `large` neben der Anzeigenzahl, und
         auf dem Telefon schrumpft die Zahl — „Eingriffe im Zeitraum" erschlug
         sie dort und las sich als Überschrift statt als Maßeinheit. Der
         Zeitraum steht ohnehin im Navigator darunter. Dieselbe Lehre wie beim
         Urlaubsanspruch auf der Abwesenheitsseite. */
      figurEinheit={eingriffeImZeitraum === 1 ? 'Eingriff' : 'Eingriffe'}
      stand={
        eingriffeImZeitraum + routineImZeitraum === 0
          ? istVerwaltung
            ? 'In diesem Zeitraum wurde nichts erfasst und nichts geändert.'
            : 'An deinem Datensatz wurde in diesem Zeitraum nichts geändert.'
          : [
              `${routineImZeitraum} ${routineImZeitraum === 1 ? 'Erfassung' : 'Erfassungen'}`,
              fehlerImZeitraum > 0
                ? `${fehlerImZeitraum} ${fehlerImZeitraum === 1 ? 'Versuch abgewiesen' : 'Versuche abgewiesen'}`
                : null,
              istVerwaltung ? null : 'Dein eigener Datensatz',
            ]
              .filter(Boolean)
              .join(' · ')
      }
      figurMeta={
        <>
          {istBereich(params.bereich ?? '') && (
            <Badge variant="neutral" label={BEREICH_LABEL[params.bereich as keyof typeof BEREICH_LABEL]} />
          )}
          {erfassung && <Badge variant="neutral" label={ERFASSUNG_LABEL[erfassung]} />}
          {fehlerImZeitraum > 0 && (
            <Badge
              variant="error"
              label={`${fehlerImZeitraum} abgewiesen`}
              icon={<Sinnbild sinn="fehler" groesse="zeile" />}
            />
          )}
        </>
      }
      nav={<MonatJahrLeiste route="/protokoll" ansicht={ansicht} monat={monat} today={today} />}
      buehne={
        <VStack gap={4}>
          <ProtokollFilter
            akteure={beteiligte.akteure}
            betroffene={beteiligte.betroffene}
            darfNachPersonFiltern={istVerwaltung}
          />
          {/* Im Monat das Gitter, im Jahr das Band: eine Dichte über 365 Tage
              ist als Streifen noch lesbar (die Höhe *ist* die Auskunft), ein
              Monat mit 29 leeren Spalten war es nicht. */}
          {ansicht === 'monat' ? (
            <ProtokollGitter
              tage={bandTage}
              monat={monat}
              ruhetage={ruhetage}
              heute={today >= zeitraumVon && today <= zeitraumBis ? today : null}
              gewaehlt={tag}
            />
          ) : (
            <ProtokollBand
              tage={bandTage}
              vonISO={zeitraumVon}
              bisISO={zeitraumBis}
              heute={today >= zeitraumVon && today <= zeitraumBis ? today : null}
              gewaehlt={tag}
            />
          )}
        </VStack>
      }
      belege={
        <VStack gap={3}>
          <ProtokollListe zeilen={zeilen} mitBetroffen={istVerwaltung} />
          {seiten > 1 && (
            <HStack gap={2} vAlign="center" justify="between" wrap="wrap">
              <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                {(seite - 1) * JE_SEITE + 1}–{Math.min(seite * JE_SEITE, gesamt)} von {gesamt}
              </Text>
              <HStack gap={2} vAlign="center">
                {seite > 1 ? (
                  <Link href={mitSeite(seite - 1)} scroll={false} style={{textDecoration: 'none'}}>
                    <Button label="Neuer" variant="secondary" size="sm" icon={<Sinnbild sinn="zurueck" />} />
                  </Link>
                ) : (
                  <Button label="Neuer" variant="secondary" size="sm" icon={<Sinnbild sinn="zurueck" />} isDisabled />
                )}
                <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                  Seite {seite} von {seiten}
                </Text>
                {seite < seiten ? (
                  <Link href={mitSeite(seite + 1)} scroll={false} style={{textDecoration: 'none'}}>
                    <Button label="Älter" variant="secondary" size="sm" icon={<Sinnbild sinn="weiter" />} />
                  </Link>
                ) : (
                  <Button label="Älter" variant="secondary" size="sm" icon={<Sinnbild sinn="weiter" />} isDisabled />
                )}
              </HStack>
            </HStack>
          )}
        </VStack>
      }
      kontext={
        <>
          {istVerwaltung && (
            <Card padding={4}>
              <VStack gap={3}>
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="siegel" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Unversehrtheit</Heading>
                </HStack>
                <KettenPruefung />
              </VStack>
            </Card>
          )}

          <Card padding={4}>
            <VStack gap={2}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                <Heading level={3}>Was hier steht</Heading>
              </HStack>
              <Text type="supporting" color="secondary">
                Jede Änderung am Datensatz mit Zeitpunkt, handelnder Person und den Werten davor und
                danach – auch die Versuche, die abgewiesen wurden.
              </Text>
              {/* Die Auskunft, wegen der ein Prüfer das Protokoll aufschlägt:
                  eine gestempelte Stunde ist gemessen, eine nachgetragene
                  behauptet. Beides ist zulässig – aber es muss dastehen. */}
              <Text type="supporting" size="sm" color="secondary">
                Bei jeder erfassten Zeit steht, wie sie hierher kam: <b>Gestempelt</b> an der Uhr zum
                Zeitpunkt selbst, <b>Nachgetragen</b> später von Hand eingegeben, <b>Automatisch</b> von
                der Anwendung vorläufig gesetzt. Die Auswahl „Erfassung“ oben zeigt jeweils nur eine
                davon.
              </Text>
              <Text type="supporting" size="sm" color="secondary">
                {istVerwaltung
                  ? 'Die Vorauswahl zeigt die Eingriffe. Das laufende Stempeln steht ebenfalls im Protokoll und lässt sich dazuschalten – es wäre sonst die Mehrheit aller Zeilen.'
                  : 'Du siehst alles, was deinen eigenen Datensatz berührt hat – auch deine eigenen Stempelungen. Wer eine deiner Zeiten korrigiert hat, steht hier mit Namen.'}
              </Text>
              <Text type="supporting" size="sm" color="secondary">
                Das Protokoll lässt sich nicht ändern und nicht löschen: die Datenbank weist beides ab.
              </Text>
            </VStack>
          </Card>

          {istVerwaltung && (
            <Card padding={4}>
              <VStack gap={3}>
                <HStack gap={2} vAlign="center">
                  <Sinnbild sinn="csv" groesse="gross" ton="sekundaer" />
                  <Heading level={3}>Ausgabe</Heading>
                </HStack>
                <Text type="supporting" color="secondary">
                  Das Protokoll dieses Zeitraums als Datei – mit denselben Filtern, die oben gesetzt sind.
                </Text>
                <a href={csvAdresse(params, zeitraumVon, zeitraumBis, nurEingriffe)} download style={{textDecoration: 'none'}}>
                  <Button label="CSV herunterladen" variant="secondary" size="sm" icon={<Sinnbild sinn="csv" />} />
                </a>
              </VStack>
            </Card>
          )}
        </>
      }
    />
  );
}

/** „2026-08" aus dem Datumsfeld wird als Monatserster gelesen. */
function padMonat(datum: string): string {
  return /^\d{4}-\d{2}$/.test(datum) ? `${datum}-01` : datum;
}

function csvAdresse(
  params: Record<string, string | undefined>,
  von: string,
  bis: string,
  nurEingriffe: boolean,
): string {
  const p = new URLSearchParams({art: 'protokoll', von, bis});
  if (params.tag) p.set('tag', params.tag);
  if (params.bereich) p.set('bereich', params.bereich);
  if (params.person) p.set('person', params.person);
  if (params.akteur) p.set('akteur', params.akteur);
  if (params.suche) p.set('suche', params.suche);
  if (params.erfassung) p.set('erfassung', params.erfassung);
  if (!nurEingriffe) p.set('nur', 'alles');
  return `/api/export?${p.toString()}`;
}
