import {Badge, HStack, StatusDot, Text, VStack} from '@astryxdesign/core';
import {requireRecht} from '@/lib/auth';
import {personAngabe} from '@/lib/avatar';
import {fmtDuration, nowMinutes, segmentPoints, spanOf, todayISO} from '@/lib/format';
import {activeUsers, clockState, dayRecord, stalePastOpenSegments} from '@/lib/time';
import {TagLeiste} from '@/components/bereichs-leiste';
import {PersonenReihe} from '@/components/person-zeichen';
import {PersonenTafel, type PersonenZeile} from '@/components/personen-tafel';
import {Sinnbild} from '@/components/sinnbilder';
import {Tagesbahn} from '@/components/tagesbahn';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{tag?: string}>;
}

export default async function TeamPage({searchParams}: PageProps) {
  await requireRecht('zeit.team');
  const params = await searchParams;
  const today = todayISO();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.tag ?? '') && params.tag! <= today ? params.tag! : today;
  const isToday = date === today;
  const nowMin = nowMinutes();

  const rows = activeUsers().map((u) => {
    const record = dayRecord(u, date);
    const state = isToday ? clockState(u.id) : null;
    const anomalies = stalePastOpenSegments(u.id).length;
    return {user: u, record, state, anomalies};
  });

  // One axis for the whole team: rows are only comparable if they share it.
  const span = spanOf(
    rows.flatMap((r) => segmentPoints(r.record.segments, {isToday, nowMin})),
    8,
  );

  const totalWorked = rows.reduce((sum, r) => sum + r.record.summary.workedMin, 0);
  const presentCount = rows.filter((r) => r.state?.status === 'arbeit').length;
  const pauseCount = rows.filter((r) => r.state?.status === 'pause').length;
  const offeneTage = rows.reduce((sum, r) => sum + r.anomalies, 0);
  const anwesende = rows.filter((r) => r.state?.status === 'arbeit').map((r) => personAngabe(r.user));

  /**
   * Der laufende Zustand sortiert, statt zu gruppieren.
   *
   * Bis zum Umbau zerfiel das Blatt in drei Gruppen mit eigenen Überschriften —
   * eine gute Antwort auf „wer ist da", aber eine Tabelle, die in Gruppen
   * zerfällt, lässt sich nicht mehr nach Stunden sortieren. Der Rang macht die
   * Gruppierung zur Vorsortierung: dieselbe erste Lesart, und jede Spalte
   * bleibt ein Sortierschlüssel. Wie viele in welchem Zustand sind, sagt jetzt
   * die Standzeile im Kopf.
   */
  const rang = (status: string | undefined): number =>
    status === 'arbeit' ? 0 : status === 'pause' ? 1 : 2;

  const zeilen: PersonenZeile[] = rows.map(({user, record, state, anomalies}) => ({
    id: user.id,
    name: user.name,
    person: personAngabe(user),
    unterzeile: `${Math.round(user.weekly_minutes / 60)} Std./Woche`,
    href: `/team/${user.id}?tag=${date}`,
    istMin: record.segments.length > 0 ? record.summary.workedMin : null,
    statusRang: isToday ? rang(state?.status) : record.summary.hasOpen ? 0 : 1,
    status: state ? (
      state.status === 'arbeit' ? (
        <StatusDot variant="accent" label="Eingestempelt" isPulsing />
      ) : state.status === 'pause' ? (
        <StatusDot variant="warning" label="Pause" isPulsing />
      ) : (
        <StatusDot variant="neutral" label="Ausgestempelt" />
      )
    ) : record.summary.hasOpen ? (
      <StatusDot variant="warning" label="Offener Eintrag" />
    ) : (
      <StatusDot variant="neutral" label="Keine Auffälligkeiten" />
    ),
    grafik: (
      <Tagesbahn
        date={date}
        segments={record.segments}
        isToday={isToday}
        nowMin={nowMin}
        span={span}
        groesse="band"
      />
    ),
    marken:
      anomalies > 0 ? (
        <Badge
          variant="warning"
          label={anomalies === 1 ? '1 offener Tag' : `${anomalies} offene Tage`}
          icon={<Sinnbild sinn="ohneEnde" groesse="zeile" />}
        />
      ) : null,
  }));

  return (
    <ZeitRahmen
      titel="Team"
      sinn="team"
      /* Die Zahl, wegen der man diese Seite an einem laufenden Tag aufmacht,
         ist „wer ist da" — an einem vergangenen Tag „wie viel wurde erfasst".
         Beide standen bisher klein in der grauen Zeile. */
      figur={isToday ? String(presentCount) : fmtDuration(totalWorked)}
      figurEinheit={isToday ? `von ${rows.length} eingestempelt` : 'Std. erfasst'}
      stand={
        isToday
          ? [
              `${fmtDuration(totalWorked)} Std. heute erfasst`,
              pauseCount > 0 ? `${pauseCount} in Pause` : null,
              `${rows.length - presentCount - pauseCount} abwesend`,
            ]
              .filter(Boolean)
              .join(' · ')
          : `${rows.length} Mitarbeiter an diesem Tag`
      }
      figurMeta={
        <>
          {/* Die Zahl daneben in Gesichtern: „3 von 11" sagt wie viele, die
              Reihe sagt wer — und genau das ist die Frage, wegen der jemand
              diese Seite an einem laufenden Tag aufmacht. Nur heute, denn an
              einem vergangenen Tag steht dort keine Anwesenheit mehr. */}
          {isToday && anwesende.length > 0 && (
            <PersonenReihe
              personen={anwesende}
              beschriftung={`${anwesende.length} eingestempelt`}
              hrefMuster={`/team/:id?tag=${date}`}
            />
          )}
          {offeneTage > 0 && (
            <Badge
              variant="warning"
              label={offeneTage === 1 ? '1 offener Tag im Team' : `${offeneTage} offene Tage im Team`}
              icon={<Sinnbild sinn="ohneEnde" groesse="zeile" />}
            />
          )}
        </>
      }
      nav={<TagLeiste route="/team" tag={date} today={today} />}
      belege={
        <VStack gap={4}>
          <PersonenTafel
            zeilen={zeilen}
            spalten={['status', 'name', 'ist', 'grafik', 'marken', 'handlung']}
            grafikKopf="Tagesverlauf"
            grafikBreite="weit"
            ordnung={[
              {sortKey: 'statusRang', direction: 'ascending'},
              {sortKey: 'name', direction: 'ascending'},
            ]}
            leer={
              <HStack paddingBlock={4} gap={3} vAlign="start" wrap="nowrap">
                <Sinnbild sinn="team" groesse="leer" ton="sekundaer" />
                <Text type="body" color="secondary">
                  Keine aktiven Mitarbeiter erfasst.
                </Text>
              </HStack>
            }
          />

          <Text type="supporting" color="secondary">
            Zeile anklicken, um Zeiten einzusehen und zu korrigieren. Goldene Balken sind
            Arbeitszeit, graue Pausen. Jede Spaltenüberschrift sortiert.
          </Text>
        </VStack>
      }
    />
  );
}
