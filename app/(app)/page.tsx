import {requireUser} from '@/lib/auth';
import {hasAnyRecords, stalePastOpenSegments, todayISO, usualStartMin, weekRecords, zeitkontoBalance} from '@/lib/time';
import {addDays} from '@/lib/format';
import {HeuteView} from '@/components/heute-view';

export const dynamic = 'force-dynamic';

export default async function HeutePage() {
  const user = await requireUser();
  const today = todayISO();
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
