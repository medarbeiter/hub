import {Badge, Card, Divider, HStack, Heading, StackItem, Text, VStack} from '@astryxdesign/core';
import {MonatJahrLeiste} from '@/components/bereichs-leiste';
import {Sinnbild} from '@/components/sinnbilder';
import {
  BelegungsKurve,
  HeuteAbwesend,
  KalenderLegende,
  TeamJahresRaster,
  TeamKalender,
  type KalenderSpanne,
  type KalenderZeile,
} from '@/components/team-kalender';
import {ZeitRahmen} from '@/components/zeit-rahmen';
import {abwesenheitenImZeitraum} from '@/lib/abwesenheit';
import {ART_LABEL, fmtTage, istWirksam, sichtbareArt, tageDerSpanne} from '@/lib/abwesenheit-arten';
import {requireRecht} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {istMonatJahrBereich, type MonatJahrBereich} from '@/lib/bereiche';
import {bundeslandFor} from '@/lib/daytypes';
import type {Abwesenheit} from '@/lib/db';
import {holidaysInRange} from '@/lib/feiertage';
import {
  addDays,
  dailySollMinutes,
  einParameter,
  fmtDate,
  fmtDateLong,
  fmtDateRange,
  istMonat,
  letzterTagDesMonats,
  monthOf,
  todayISO,
} from '@/lib/format';
import {belegungGrenze} from '@/lib/settings';
import {activeUsers} from '@/lib/time';
import {personAngabe} from '@/lib/avatar';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Der Teamkalender: wer im Zeitraum abwesend ist, eine Bahn je Person.
 *
 * **Was hier bewusst nicht steht.** Für Kolleginnen und Kollegen wird die Art
 * der Abwesenheit nicht bloß ausgeblendet, sondern gar nicht erst an den
 * Browser geschickt: „Urlaub" gegen „Krank" ist eine Gesundheitsangabe nach
 * Art. 9 DSGVO, und was im Browser ankommt, ist einsehbar. Die Tatsache der
 * Abwesenheit dagegen teilt das Team ohnehin — sie ist es, wegen der man
 * überhaupt in den Kalender schaut. Die Verwaltung sieht die Art, und jede
 * Person sieht sie in der eigenen Zeile.
 *
 * Entwürfe und abgelehnte Anträge stehen nicht drin: der eine ist noch
 * niemandes Sache, der andere findet nicht statt.
 */
export default async function KalenderPage({searchParams}: PageProps) {
  const user = await requireRecht('kalender.sehen');
  const params = await searchParams;
  const today = todayISO();

  const ansicht: MonatJahrBereich = istMonatJahrBereich(einParameter(params.ansicht))
    ? (einParameter(params.ansicht) as MonatJahrBereich)
    : 'monat';
  const monatRoh = einParameter(params.monat);
  const monat = istMonat(monatRoh) ? monatRoh : monthOf(today);
  const jahr = monat.slice(0, 4);
  const vonISO = ansicht === 'monat' ? `${monat}-01` : `${jahr}-01-01`;
  const bisISO = ansicht === 'monat' ? letzterTagDesMonats(monat) : `${jahr}-12-31`;

  const darfArtSehen = hatRecht(user, 'kalender.gruende');
  const darfPruefen = hatRecht(user, 'abwesenheit.pruefen');
  const alle = [...activeUsers()].sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const grenze = belegungGrenze();

  // Der Ruhetags-Hintergrund ist eine Lesehilfe für das ganze Blatt und folgt
  // deshalb dem Kalender der lesenden Person. Die Anspruchsrechnung tut das
  // nicht — sie rechnet je Mitarbeiter mit dessen eigenem Bundesland
  // (lib/abwesenheit.ts) und bleibt davon unberührt.
  const land = bundeslandFor(user);
  const feiertage = land ? holidaysInRange(vonISO, bisISO, land) : new Map<string, string>();
  const ruhetage = tageDerSpanne(vonISO, bisISO).filter(
    (t) => feiertage.has(t) || dailySollMinutes(user, t) === 0,
  );

  const zeilen: KalenderZeile[] = alle.map((person) => {
    const selbst = person.id === user.id;
    const sichtbar = abwesenheitenImZeitraum(person.id, vonISO, bisISO).filter(
      (a) => istWirksam(a.status) || a.status === 'eingereicht',
    );
    return {
      userId: person.id,
      name: person.name,
      // Nur das Zeichen: dieses Blatt schickt eine Zeile je Person an jeden
      // Browser im Haus. Rolle und Adresse holt die Personenkarte beim Öffnen
      // nach, statt sie mit jeder Zeile mitzuschicken.
      person: personAngabe({
        id: person.id,
        name: person.name,
        avatar_key: person.avatar_key,
        avatar_datei: person.avatar_datei,
      }),
      selbst,
      spannen: sichtbar.map((a): KalenderSpanne => {
        // Auf den Ausschnitt beschnitten: eine Spanne über den Monatswechsel
        // soll am Rand des Bandes enden, nicht daneben.
        const von = a.von < vonISO ? vonISO : a.von;
        const bis = a.bis > bisISO ? bisISO : a.bis;
        // Je Mitarbeiter mit dessen eigenem Feiertagskalender gerechnet — die
        // Hinterlegung im Band folgt der lesenden Person, die Zählung nicht.
        const eigeneFeiertage = bundeslandFor(person)
          ? holidaysInRange(von, bis, bundeslandFor(person)!)
          : new Map<string, string>();
        const zaehlendeTage = tageDerSpanne(von, bis).filter(
          (t) => dailySollMinutes(person, t) > 0 && !eigeneFeiertage.has(t),
        );
        const art = sichtbareArt(a.art, darfArtSehen, selbst);
        return {
          id: a.id,
          von,
          bis,
          art,
          // Wohin der Sprung geht — am Server entschieden, weil hier schon
          // steht, wer was sehen darf. Ohne sichtbare Art gibt es kein Ziel:
          // eine Adresse mit dem Status darin sagte sonst über eine fremde
          // Abwesenheit genau das, was ihr Grund verschweigt.
          ziel:
            art === null
              ? null
              : selbst
                ? `/abwesenheit?ansicht=monat&monat=${monthOf(a.von)}`
                : darfPruefen
                  ? `/abwesenheit/pruefen?status=${a.status}&offen=${a.id}`
                  : null,
          beantragt: a.status === 'eingereicht',
          arbeitstage: zaehlendeTage.length,
          zaehlendeTage,
        };
      }),
    };
  });

  // Wie viele gleichzeitig — die Zahl, wegen der man vor einem Urlaubsantrag
  // hierher schaut. Gezählt wird nur, was feststeht; ein Antrag bindet nichts.
  const wirksamAm = (datum: string): KalenderZeile[] =>
    zeilen.filter((z) => z.spannen.some((s) => !s.beantragt && s.von <= datum && s.bis >= datum));

  const heuteImBild = today >= vonISO && today <= bisISO;
  const arbeitstageDesZeitraums = tageDerSpanne(vonISO, bisISO).filter((t) => !ruhetage.includes(t));
  let spitzenTag: string | null = null;
  let spitze = 0;
  for (const tag of arbeitstageDesZeitraums) {
    const anzahl = wirksamAm(tag).length;
    if (anzahl > spitze) {
      spitze = anzahl;
      spitzenTag = tag;
    }
  }

  const heuteWeg = heuteImBild ? wirksamAm(today) : [];
  const spannenGesamt = zeilen.reduce((s, z) => s + z.spannen.length, 0);

  /**
   * Der erste Arbeitstag nach der Rückkehr.
   *
   * Gerechnet wird bewusst auf **ungeschnittenen** Spannen und mit dem
   * Feiertagskalender der abwesenden Person: die Spannen im Band sind auf den
   * Monat beschnitten, und ein Urlaub vom 1. August bis zum 15. September
   * hätte im August-Blatt sonst „zurück am 1.9." gemeldet — mitten aus dem
   * Urlaub heraus. Und ein Feiertag außerhalb des gezeigten Monats steht in
   * der Karte des Blattes gar nicht, sodass die Rückkehr auf ihn hätte fallen
   * können.
   */
  const zurueckAm = (userId: number, laufendBis: string): string | null => {
    const person = alle.find((p) => p.id === userId);
    if (!person) return null;
    const suchEnde = addDays(laufendBis, 60);
    const land = bundeslandFor(person);
    const eigeneFeiertage = land ? holidaysInRange(laufendBis, suchEnde, land) : new Map<string, string>();
    // Alle wirksamen Spannen der Person im Suchfenster, ungeschnitten.
    const weiterWeg = abwesenheitenImZeitraum(person.id, laufendBis, suchEnde).filter((a) =>
      istWirksam(a.status),
    );
    for (let i = 1; i <= 60; i++) {
      const tag = addDays(laufendBis, i);
      if (dailySollMinutes(person, tag) === 0 || eigeneFeiertage.has(tag)) continue;
      if (weiterWeg.some((a) => a.von <= tag && a.bis >= tag)) continue;
      return tag;
    }
    return null;
  };

  const heuteListe = heuteWeg.map((z) => {
    const laufend = z.spannen.find((s) => !s.beantragt && s.von <= today && s.bis >= today)!;
    // Das echte Ende der Spanne, nicht das des Ausschnitts.
    const ungeschnitten = abwesenheitenImZeitraum(z.userId, today, today).find(
      (a) => istWirksam(a.status) && a.von <= today && a.bis >= today,
    );
    return {
      name: z.name,
      art: laufend.art,
      zurueck: zurueckAm(z.userId, ungeschnitten?.bis ?? laufend.bis),
      tage: laufend.arbeitstage,
    };
  });

  // Die Belege: alle Spannen des Zeitraums als Zeilen, nach Beginn geordnet —
  // das Band zeigt die Lage, die Liste die Einzelheiten.
  const belege = zeilen
    .flatMap((z) => z.spannen.map((s) => ({...s, name: z.name, selbst: z.selbst})))
    .sort((a, b) => a.von.localeCompare(b.von) || a.name.localeCompare(b.name, 'de'));

  return (
    <ZeitRahmen
      titel="Teamkalender"
      figur={String(heuteImBild ? heuteWeg.length : spitze)}
      /* Kurz: die Einheit steht neben der Anzeigenzahl und schrumpft auf dem
         Telefon mit ihr. „von 9 heute abwesend" las sich dort als Überschrift
         und verschluckte die Zahl davor — was die Zahl bedeutet, sagt die
         Standzeile darunter in einem ganzen Satz. */
      figurEinheit={`von ${alle.length}`}
      stand={
        spannenGesamt === 0
          ? `${ansicht === 'monat' ? 'In diesem Monat' : 'In diesem Jahr'} ist niemand abwesend.`
          : [
              heuteImBild ? 'heute abwesend' : 'gleichzeitig abwesend (Spitze)',
              `${spannenGesamt} ${spannenGesamt === 1 ? 'Abwesenheit' : 'Abwesenheiten'} im Zeitraum`,
              /* Die Spitze stand hier als Nachsatz („am meisten am Do, 6.
                 August: 1"), weil es kein Bild dafür gab. Im Monat gibt es
                 jetzt die Belegungskurve; im Jahr nicht, dort bleibt der Satz. */
              ansicht === 'jahr' && spitzenTag && spitze > 0
                ? `am meisten am ${fmtDateLong(spitzenTag)}: ${spitze}`
                : null,
            ]
              .filter(Boolean)
              .join(' · ')
      }
      nav={<MonatJahrLeiste route="/kalender" ansicht={ansicht} monat={monat} today={today} nachVorn />}
      buehne={
        <VStack gap={3}>
          <HStack gap={1.5} vAlign="center">
            <Sinnbild sinn={ansicht} groesse="zeile" ton="sekundaer" />
            <Text type="label" color="secondary">
              {ansicht === 'monat' ? 'Abwesenheiten im Monat' : 'Abwesenheiten im Jahr'}
            </Text>
          </HStack>
          {ansicht === 'monat' ? (
            <>
              <TeamKalender
                zeilen={zeilen}
                monat={monat}
                heute={heuteImBild ? today : null}
                ruhetage={ruhetage}
              />
              {/* Die Kurve steht unter dem Gitter und nicht darin: das Gitter
                  sagt „wer wann", die Kurve „wie viele auf einmal" — die eine
                  Größe, für die eine durchlaufende Achse das richtige Gerät
                  ist. */}
              <BelegungsKurve
                zeilen={zeilen}
                monat={monat}
                grenze={grenze}
                gesamt={alle.length}
              />
            </>
          ) : (
            <TeamJahresRaster zeilen={zeilen} jahr={jahr} heute={heuteImBild ? today : null} />
          )}
        </VStack>
      }
      belege={
        belege.length > 0 ? (
          <VStack gap={0}>
            <HStack gap={1.5} vAlign="center" paddingBlock={2}>
              <Sinnbild sinn="abwesenheit" groesse="zeile" ton="sekundaer" />
              <Text type="label" color="secondary">
                Im Zeitraum
              </Text>
            </HStack>
            <Divider />
            {belege.map((b) => (
              <VStack key={`${b.id}-${b.name}`} gap={0}>
                <HStack gap={3} vAlign="center" paddingBlock={2} paddingInline={2} wrap="wrap">
                  <span style={{inlineSize: 168, flexShrink: 0}}>
                    <Text type="label" size="sm" weight={b.selbst ? 'semibold' : 'medium'} maxLines={1}>
                      {b.name}
                    </Text>
                  </span>
                  <span style={{inlineSize: 132, flexShrink: 0}}>
                    <Text type="supporting" color="secondary" hasTabularNumbers>
                      {fmtDateRange(b.von, b.bis)}
                    </Text>
                  </span>
                  <StackItem size="fill">
                    <HStack gap={2} vAlign="center" wrap="wrap">
                      {b.art ? (
                        <Badge
                          variant="neutral"
                          label={ART_LABEL[b.art]}
                          icon={<Sinnbild sinn={b.art} groesse="zeile" />}
                        />
                      ) : (
                        <Text type="supporting" size="sm" color="secondary">
                          Abwesend
                        </Text>
                      )}
                      {b.beantragt && (
                        <Badge
                          variant="info"
                          label="Beantragt"
                          icon={<Sinnbild sinn="einreichen" groesse="zeile" />}
                        />
                      )}
                    </HStack>
                  </StackItem>
                  <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
                    {fmtTage(b.arbeitstage)}
                  </Text>
                </HStack>
                <Divider />
              </VStack>
            ))}
          </VStack>
        ) : undefined
      }
      kontext={
        <>
          <Card padding={4}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="tag" groesse="gross" ton="sekundaer" />
                <Heading level={3}>Heute abwesend</Heading>
              </HStack>
              {heuteImBild ? (
                <HeuteAbwesend namen={heuteListe} />
              ) : (
                <Text type="supporting" color="secondary">
                  Heute liegt außerhalb des gezeigten Zeitraums.
                </Text>
              )}
            </VStack>
          </Card>

          <Card padding={4}>
            <VStack gap={3}>
              <HStack gap={2} vAlign="center">
                <Sinnbild sinn="herleitung" groesse="gross" ton="sekundaer" />
                <Heading level={3}>{ansicht === 'monat' ? 'Was das Gitter zeigt' : 'Was das Raster zeigt'}</Heading>
              </HStack>
              <KalenderLegende mitArten={darfArtSehen} jahr={ansicht === 'jahr'} />
              <Divider />
              <Text type="supporting" size="sm" color="secondary">
                {darfArtSehen
                  ? 'Im Gitter steht, wer weg ist. Den Grund zeigt die Sprechblase, wenn du auf ein Bild zeigst – und ein Klick führt zum Vorgang. Für alle anderen steht dort nur, dass jemand weg ist: der Grund ist eine Gesundheitsangabe und geht Kollegen nichts an.'
                  : 'Im Gitter steht, wer weg ist. Warum, steht dort bewusst nicht: das wäre eine Gesundheitsangabe. Bei deinen eigenen Tagen zeigt die Sprechblase dir die Art, weil es deine Daten sind.'}
              </Text>
              <Text type="supporting" size="sm" color="secondary">
                Gezählt werden nur Tage mit einem Soll. Wochenenden und Feiertage sind hinterlegt und
                kosten nichts.
              </Text>
            </VStack>
          </Card>
        </>
      }
    />
  );
}
