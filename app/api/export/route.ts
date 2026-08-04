import {getSessionUser} from '@/lib/auth';
import {fmtDuration, fmtTime, monthOf, todayISO} from '@/lib/format';
import {activeUsers, isMonthLocked, monthRecord} from '@/lib/time';

/**
 * CSV export for payroll: one row per employee per recorded day, German
 * column labels, semicolon separator, UTF-8 BOM so Excel opens it cleanly.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user || user.role !== 'verwaltung') {
    return new Response('Nicht berechtigt.', {status: 403});
  }
  const url = new URL(request.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('monat') ?? '')
    ? url.searchParams.get('monat')!
    : monthOf(todayISO());

  const lines: string[] = [
    'Mitarbeiter;Datum;Beginn;Ende;Arbeitszeit (Std.);Pause (Std.);Soll (Std.);Differenz (Std.);Status;Notizen',
  ];

  for (const u of activeUsers()) {
    const record = monthRecord(u, month);
    const locked = isMonthLocked(u.id, month);
    for (const day of record.days) {
      if (day.segments.length === 0) continue;
      const first = day.segments[0]!;
      const last = day.segments.at(-1)!;
      const open = day.segments.some((s) => s.end_min === null);
      const notes = day.segments
        .map((s) => s.note)
        .filter(Boolean)
        .join(' / ');
      lines.push(
        [
          u.name,
          day.date,
          fmtTime(first.start_min),
          open ? 'offen' : fmtTime(last.end_min!),
          fmtDuration(day.summary.workedMin),
          fmtDuration(day.summary.pauseMin),
          fmtDuration(day.sollMin),
          fmtDuration(day.summary.workedMin - day.sollMin),
          open ? 'OFFEN' : locked ? 'Abgeschlossen' : 'Erfasst',
          notes.replaceAll(';', ','),
        ].join(';'),
      );
    }
    lines.push(
      [
        u.name,
        `Summe ${month}`,
        '',
        '',
        fmtDuration(record.workedMin),
        '',
        fmtDuration(record.sollMin),
        fmtDuration(record.workedMin - record.sollMin),
        locked ? 'Abgeschlossen' : 'Offen',
        '',
      ].join(';'),
    );
  }

  const csv = '﻿' + lines.join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="medarbeiter-zeiten-${month}.csv"`,
    },
  });
}
