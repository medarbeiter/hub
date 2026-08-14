import {requireUser} from '@/lib/auth';
import {
  hasAnyRecords,
  todayISO,
  weekRecords,
  zeitkontoBalance,
  zeitkontoSummary,
} from '@/lib/time';
import {
  addDays,
  fmtDateMitWochentag,
  fmtDurationSigned,
  fmtMonth,
  fmtWeekRange,
  mondayOf,
  monthOf,
  nowMinutes,
} from '@/lib/format';
import {zeitAusUrl} from '@/lib/bereiche';
import {anchorFor, periodRecord} from '@/lib/period';
import {reiseAmTag} from '@/lib/spesen';
import {BereichsLeiste} from '@/components/bereichs-leiste';
import {KontoTafel, KontoVerlauf, type VerlaufMonat} from '@/components/konto-tafel';
import {
  KontoHerleitung,
  KontoKarte,
  WochenUebersicht,
  ZeitraumFortschritt,
} from '@/components/kontext-rail';
import {NachweisKarte} from '@/components/nachweis-karte';
import {StapelAnsicht} from '@/components/stapel-ansicht';
import {TagAnsicht} from '@/components/tag-ansicht';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ansicht?: string; monat?: string; tag?: string}>;
}

/**
 * "Meine Zeit" — one frame, four ranges: Tag, Woche, Monat, Konto. Everything
 * is URL-driven (?ansicht=…&tag=…), so every zoom and every opened day stays a
 * shareable link. `?ansicht=heute` and `?monat=` are kept working for links
 * that were shipped before the ranges were unified.
 */
export default async function MeineZeitPage({searchParams}: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();
  const nowMin = nowMinutes();

  // Dieselbe Regel, die auch die Stempelleiste liest — siehe `zeitAusUrl`.
  const {ansicht, tag} = zeitAusUrl(params, today);

  const nav = <BereichsLeiste ansicht={ansicht} tag={tag} today={today} />;
  const kontoMin = zeitkontoBalance(user, addDays(today, -1));

  // --- Konto: the account itself, at the widest range -----------------------
  if (ansicht === 'konto') {
    const bis = addDays(today, -1);
    const summary = zeitkontoSummary(user, bis);
    const monate = new Map<string, number>();
    for (const row of summary.rows) monate.set(monthOf(row.date), row.runningMin);
    const verlauf: VerlaufMonat[] = [...monate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, standMin]) => ({month, standMin, isCurrent: month === monthOf(today)}));

    return (
      <ZeitRahmen
        titel="Zeitkonto"
        figur={fmtDurationSigned(summary.balanceMin)}
        figurEinheit="Std."
        figurTon={summary.balanceMin >= 0 ? 'positiv' : 'negativ'}
        stand={`Überstunden bis ${fmtDateMitWochentag(summary.through)} · ${summary.recordedDays + summary.absenceDays} gezählte Tage`}
        nav={nav}
        buehne={<KontoVerlauf months={verlauf} />}
        belege={<KontoTafel summary={summary} />}
        kontext={
          <>
            <KontoHerleitung
              recordedDays={summary.recordedDays}
              absenceDays={summary.absenceDays}
              uncountableDays={summary.uncountableDays}
              missingDays={summary.missingDays}
            />
            {/* Der eigene Nachweis, an der Stelle, an der man über die eigenen
                Zeiten nachdenkt. Bis hierher gab es ihn nur im Team-Blatt der
                Verwaltung. */}
            <NachweisKarte userId={user.id} month={monthOf(today)} />
          </>
        }
      />
    );
  }

  // --- Woche / Monat: the same period stacked as day lanes ------------------
  if (ansicht === 'woche' || ansicht === 'monat') {
    const anchor = anchorFor(ansicht, tag, today);
    const period = periodRecord(user, ansicht, anchor, nowMin);
    // The rail speaks the same language as the Kopf: worked so far against the
    // month's whole Soll. monthRecord() answers a different question (settled
    // days only) and would show "6:00 von 8:00" beside a Kopf saying 40:00.
    const monat = ansicht === 'woche' ? periodRecord(user, 'monat', `${monthOf(anchor)}-01`, nowMin) : null;

    return (
      <StapelAnsicht
        userId={user.id}
        titel={ansicht === 'woche' ? `Woche ${fmtWeekRange(mondayOf(anchor))}` : fmtMonth(monthOf(anchor))}
        period={period}
        selectedDate={tag}
        nowMin={nowMin}
        basePath="/"
        nav={nav}
        kontext={
          <>
            {monat && (
              <ZeitraumFortschritt
                titel={fmtMonth(monthOf(anchor))}
                workedMin={monat.workedMin}
                sollMin={monat.sollMin}
                fussnote={
                  monat.queue.length > 0
                    ? `${monat.queue.length} ${monat.queue.length === 1 ? 'Tag braucht' : 'Tage brauchen'} eine Korrektur.`
                    : undefined
                }
              />
            )}
            <KontoKarte balanceMin={kontoMin} />
          </>
        }
      />
    );
  }

  // --- Tag: the running day, or any single day in the past -------------------
  const period = periodRecord(user, 'tag', tag, nowMin);
  const day = period.days[0]!;
  const woche = weekRecords(user, tag);

  // Angeboten, wenn an diesem Tag gearbeitet wurde und noch keine Reise ihn
  // abdeckt — sonst wäre es ein Weg in eine Überschneidung.
  const spesenHref =
    !period.locked && day.record.segments.length > 0 && tag <= today && reiseAmTag(user.id, tag) === null
      ? `/spesen?neu=${tag}`
      : null;

  return (
    <TagAnsicht
      userId={user.id}
      firstName={user.name.split(' ')[0] ?? user.name}
      date={tag}
      isToday={tag === today}
      segments={day.record.segments}
      nowMin={nowMin}
      workedMin={day.record.summary.workedMin}
      pauseMin={day.record.summary.pauseMin}
      sollMin={day.record.sollMin}
      dayType={day.record.dayType}
      dayTypeLabel={day.record.dayTypeLabel}
      issues={day.issues}
      plan={day.plan}
      canEdit={!period.locked}
      lockedNote={
        period.locked ? 'Dieser Monat ist abgeschlossen. Änderungen sind nur über die Verwaltung möglich.' : undefined
      }
      hasHistory={hasAnyRecords(user.id)}
      nextIssue={null}
      spesenHref={spesenHref}
      nav={nav}
      kontext={
        <>
          <WochenUebersicht
            titel={tag === today ? 'Diese Woche' : `Woche ${fmtWeekRange(mondayOf(tag))}`}
            today={today}
            days={woche.map((d) => ({
              date: d.date,
              workedMin: d.summary.workedMin,
              sollMin: d.sollMin,
              hasSegments: d.segments.length > 0,
              isFuture: d.date > today,
            }))}
          />
          <KontoKarte balanceMin={kontoMin} />
        </>
      }
    />
  );
}
