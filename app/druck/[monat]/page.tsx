import {notFound} from 'next/navigation';
import {requireVerwaltung} from '@/lib/auth';
import {fmtDate, fmtDuration, fmtMonth, fmtTime, fmtWeekdayShort} from '@/lib/format';
import {activeUsers, isMonthLocked, monthRecord} from '@/lib/time';
import {PrintToolbar} from '@/components/print-toolbar';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{monat: string}>;
  searchParams: Promise<{mitarbeiter?: string}>;
}

/**
 * Print-optimized monthly sheet (one page per employee; ?mitarbeiter=<id>
 * narrows to one). "Als PDF speichern" via the browser's print dialog
 * produces the payroll PDF.
 */
export default async function DruckPage({params, searchParams}: PageProps) {
  await requireVerwaltung();
  const {monat} = await params;
  const query = await searchParams;
  if (!/^\d{4}-\d{2}$/.test(monat)) notFound();

  const filterId = query.mitarbeiter ? Number(query.mitarbeiter) : null;
  const users = activeUsers().filter((u) => filterId === null || u.id === filterId);
  if (users.length === 0) notFound();

  return (
    <main style={{background: 'white', color: '#1c1917', fontFamily: 'Figtree, sans-serif'}}>
      <style>{`
        @media print {
          .druck-toolbar { display: none; }
          .druck-blatt { break-after: page; }
        }
        .druck-blatt { max-width: 720px; margin: 0 auto; padding: 40px 24px; }
        .druck-tabelle { width: 100%; border-collapse: collapse; font-size: 13px; }
        .druck-tabelle th { text-align: left; font-weight: 600; border-bottom: 2px solid #1c1917; padding: 6px 8px; }
        .druck-tabelle td { border-bottom: 1px solid #d8d2c6; padding: 5px 8px; font-variant-numeric: tabular-nums; }
        .druck-tabelle td.num, .druck-tabelle th.num { text-align: right; }
        .druck-summe td { font-weight: 600; border-top: 2px solid #1c1917; border-bottom: none; }
      `}</style>
      <PrintToolbar />
      {users.map((u) => {
        const record = monthRecord(u, monat);
        const recorded = record.days.filter((d) => d.segments.length > 0);
        const locked = isMonthLocked(u.id, monat);
        return (
          <section key={u.id} className="druck-blatt">
            <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 16}}>
              <div>
                <h1 style={{fontFamily: 'Poppins, sans-serif', fontSize: 20, margin: 0}}>
                  Arbeitszeitnachweis – {fmtMonth(monat)}
                </h1>
                <p style={{margin: '4px 0 0', fontSize: 14}}>
                  {u.name} · {Math.round(u.weekly_minutes / 60)} Std./Woche ·{' '}
                  {locked ? 'Monat abgeschlossen' : 'Monat nicht abgeschlossen'}
                </p>
              </div>
              <p style={{fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 16, margin: 0}}>MedArbeiter</p>
            </header>
            <table className="druck-tabelle">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Beginn</th>
                  <th>Ende</th>
                  <th className="num">Arbeitszeit</th>
                  <th className="num">Pause</th>
                  <th className="num">Soll</th>
                  <th className="num">Differenz</th>
                  <th>Notizen</th>
                </tr>
              </thead>
              <tbody>
                {recorded.map((day) => {
                  const first = day.segments[0]!;
                  const last = day.segments.at(-1)!;
                  const open = day.segments.some((s) => s.end_min === null);
                  const diff = day.summary.workedMin - day.sollMin;
                  return (
                    <tr key={day.date}>
                      <td>
                        {fmtWeekdayShort(day.date)}, {fmtDate(day.date)}
                      </td>
                      <td>{fmtTime(first.start_min)}</td>
                      <td>{open ? 'offen' : fmtTime(last.end_min!)}</td>
                      <td className="num">{fmtDuration(day.summary.workedMin)}</td>
                      <td className="num">{fmtDuration(day.summary.pauseMin)}</td>
                      <td className="num">{fmtDuration(day.sollMin)}</td>
                      <td className="num">
                        {diff >= 0 ? '+' : ''}
                        {fmtDuration(diff)}
                      </td>
                      <td>
                        {day.segments
                          .map((s) => s.note)
                          .filter(Boolean)
                          .join(' / ')}
                      </td>
                    </tr>
                  );
                })}
                <tr className="druck-summe">
                  <td colSpan={3}>Summe ({recorded.length} Tage)</td>
                  <td className="num">{fmtDuration(record.workedMin)}</td>
                  <td className="num" />
                  <td className="num">{fmtDuration(record.sollMin)}</td>
                  <td className="num">
                    {record.workedMin - record.sollMin >= 0 ? '+' : ''}
                    {fmtDuration(record.workedMin - record.sollMin)}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
            <footer style={{marginTop: 48, display: 'flex', gap: 48, fontSize: 12}}>
              <div style={{flex: 1, borderTop: '1px solid #1c1917', paddingTop: 6}}>Datum, Unterschrift Mitarbeiter</div>
              <div style={{flex: 1, borderTop: '1px solid #1c1917', paddingTop: 6}}>Datum, Unterschrift Verwaltung</div>
            </footer>
          </section>
        );
      })}
    </main>
  );
}
