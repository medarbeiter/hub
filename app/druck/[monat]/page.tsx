import {notFound} from 'next/navigation';
import {requireUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {fmtDate, fmtDateMitWochentag, fmtDuration, fmtMonth, fmtTime} from '@/lib/format';
import {activeUsers, firstRecordedDate, isMonthLocked, monthRecord} from '@/lib/time';
import {dayTypeCounts} from '@/lib/daytypes';
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
  /**
   * Bis hierher kam nur die Verwaltung — Mitarbeitende wurden wortlos auf die
   * Startseite geschickt. Der eigene Arbeitszeitnachweis ist aber genau das:
   * der eigene. Wer angemeldet ist, bekommt sein Blatt; alle Blätter und die
   * Blätter anderer bleiben der Verwaltung vorbehalten (dieselbe Grenze wie
   * bei den Belegen in `api/beleg/[id]`).
   */
  const user = await requireUser();
  const {monat} = await params;
  const query = await searchParams;
  if (!/^\d{4}-\d{2}$/.test(monat)) notFound();

  const filterId = query.mitarbeiter ? Number(query.mitarbeiter) : null;
  const istVerwaltung = hatRecht(user, 'zeit.team');
  if (!istVerwaltung && filterId !== user.id) notFound();

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
        const abwesenheit = dayTypeCounts(u, monat);
        /**
         * Arbeitstage, an denen weder gestempelt noch eine Tagesart gewählt
         * wurde. Der Bildschirm nennt sie („Nicht gezählt: 3 Arbeitstage ohne
         * Eintrag"), das Blatt ließ sie stillschweigend weg — und unter dem
         * Blatt stehen zwei Unterschriftslinien. Ein Nachweis, der eine Lücke
         * verschweigt, behauptet, es gebe keine. Tage vor dem ersten Eintrag
         * zählen nicht als Lücke (dieselbe Regel wie im Zeitkonto).
         */
        const erster = firstRecordedDate(u.id);
        const luecken = record.days.filter(
          (d) =>
            d.sollMin > 0 &&
            d.segments.length === 0 &&
            d.dayType === null &&
            erster !== null &&
            d.date >= erster,
        );
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
                      <td>{fmtDateMitWochentag(day.date)}</td>
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
                  <td colSpan={3}>Summe ({recorded.length} {recorded.length === 1 ? 'Tag' : 'Tage'})</td>
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
            {/* Die Abwesenheitstage stehen nicht in der Tabelle — sie haben
                keine Zeiten. Auf einem Blatt mit zwei Unterschriftslinien
                dürfen sie trotzdem nicht fehlen: ohne sie sieht ein Monat mit
                zwei Wochen Urlaub aus wie ein Monat mit einem großen Minus. */}
            {abwesenheit.length > 0 && (
              <p style={{marginTop: 12, fontSize: 12}}>
                <strong>Abwesend:</strong>{' '}
                {abwesenheit.map((a) => `${a.days} ${a.days === 1 ? 'Tag' : 'Tage'} ${a.label}`).join(', ')}.
                Diese Tage tragen kein Soll und sind in der Differenz nicht enthalten.
              </p>
            )}
            {luecken.length > 0 && (
              <p style={{marginTop: 12, fontSize: 12}}>
                <strong>Nicht erfasst:</strong> {luecken.length}{' '}
                {luecken.length === 1 ? 'Arbeitstag' : 'Arbeitstage'} ohne Eintrag und ohne Tagesart (
                {luecken.map((d) => fmtDate(d.date)).join(', ')}). Diese Tage sind in Summe, Soll und
                Differenz nicht enthalten.
              </p>
            )}
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
