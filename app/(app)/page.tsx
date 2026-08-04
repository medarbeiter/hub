import {requireUser} from '@/lib/auth';
import {hasAnyRecords, stalePastOpenSegments, todayISO, usualStartMin, weekRecords, zeitkontoBalance} from '@/lib/time';
import {addDays, monthOf} from '@/lib/format';
import {HeuteView} from '@/components/heute-view';
import {MonatView, WocheView} from '@/components/monat-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ansicht?: string; monat?: string; tag?: string}>;
}

/**
 * "Meine Zeit" — one page, three zooms: Heute (default), Woche, Monat.
 * Entirely URL-driven so deep links (?tag=…) keep working.
 */
export default async function MeineZeitPage({searchParams}: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const requestedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.tag ?? '') ? params.tag! : null;

  if (params.ansicht === 'monat') {
    const month = /^\d{4}-\d{2}$/.test(params.monat ?? '')
      ? params.monat!
      : requestedDay
        ? monthOf(requestedDay)
        : monthOf(today);
    return <MonatView user={user} month={month} requestedDay={requestedDay} />;
  }

  if (params.ansicht === 'woche') {
    return <WocheView user={user} anchor={requestedDay ?? today} requestedDay={requestedDay} />;
  }

  const week = weekRecords(user, today);
  const anomalies = stalePastOpenSegments(user.id);
  return (
    <HeuteView
      userId={user.id}
      firstName={user.name.split(' ')[0] ?? user.name}
      week={week.map((d) => ({
        date: d.date,
        workedMin: d.summary.workedMin,
        sollMin: d.sollMin,
        hasSegments: d.segments.length > 0,
      }))}
      zeitkontoMin={zeitkontoBalance(user, addDays(today, -1))}
      anomalies={anomalies.map((s) => ({id: s.id, date: s.date, start_min: s.start_min}))}
      usualStartMin={usualStartMin(user.id)}
      hasHistory={hasAnyRecords(user.id)}
    />
  );
}
