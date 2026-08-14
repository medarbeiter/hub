import {getSessionUser} from '@/lib/auth';
import {hatRecht, rolleLabel} from '@/lib/rechte';
import {fmtDate, fmtDuration, fmtEuroPlain, fmtTime, monthOf, todayISO} from '@/lib/format';
import {protokollSeite} from '@/lib/protokoll';
import {aktionLabel, BEREICH_LABEL, istBereich, type ProtokollBereich} from '@/lib/protokoll-arten';
import {REISE_STATUS_LABEL, reisenForMonth} from '@/lib/spesen';
import {activeUsers, isMonthLocked, monthRecord} from '@/lib/time';

const CSV_HEADERS = (dateiname: string): HeadersInit => ({
  'Content-Type': 'text/csv; charset=utf-8',
  'Content-Disposition': `attachment; filename="${dateiname}"`,
});

/**
 * CSV export for payroll: one row per employee per recorded day, German
 * column labels, semicolon separator, UTF-8 BOM so Excel opens it cleanly.
 *
 * `?art=spesen` liefert stattdessen die Reisekostenabrechnungen des Monats —
 * dieselben Konventionen, damit beide Dateien in derselben Tabelle landen.
 */
export async function GET(request: Request): Promise<Response> {
  const user = await getSessionUser();
  if (!user || !hatRecht(user, 'berichte.sehen')) {
    return new Response('Nicht berechtigt.', {status: 403});
  }
  const url = new URL(request.url);
  const month = /^\d{4}-\d{2}$/.test(url.searchParams.get('monat') ?? '')
    ? url.searchParams.get('monat')!
    : monthOf(todayISO());

  if (url.searchParams.get('art') === 'spesen') return spesenCsv(month);
  if (url.searchParams.get('art') === 'protokoll') return protokollCsv(url);

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
  return new Response(csv, {headers: CSV_HEADERS(`medarbeiter-zeiten-${month}.csv`)});
}

/** Eine Zeile je Reise, plus eine Summenzeile je Mitarbeiter. */
function spesenCsv(month: string): Response {
  const lines: string[] = [
    'Mitarbeiter;Von;Bis;Anlass;Ziel;Reisetage;Abwesenheit (Std.);Pauschale (EUR);Belege (EUR);Summe (EUR);Status;Genehmigt am',
  ];

  for (const u of activeUsers()) {
    const reisen = reisenForMonth(u.id, month);
    if (reisen.length === 0) continue;
    for (const {reise, rechnung} of reisen) {
      lines.push(
        [
          u.name,
          fmtDate(reise.start_date),
          fmtDate(reise.end_date),
          feld(reise.zweck),
          feld(reise.ziel ?? ''),
          String(rechnung.tage.length),
          fmtDuration(rechnung.abwesenheitMin),
          fmtEuroPlain(rechnung.pauschaleCent),
          fmtEuroPlain(rechnung.belegeCent),
          fmtEuroPlain(rechnung.summeCent),
          REISE_STATUS_LABEL[reise.status],
          reise.entschieden_at ? reise.entschieden_at.slice(0, 10) : '',
        ].join(';'),
      );
    }
    const summe = reisen.reduce((s, r) => s + r.rechnung.summeCent, 0);
    lines.push(
      [u.name, `Summe ${month}`, '', '', '', '', '', '', '', fmtEuroPlain(summe), '', ''].join(';'),
    );
  }

  const csv = '﻿' + lines.join('\r\n');
  return new Response(csv, {headers: CSV_HEADERS(`medarbeiter-spesen-${month}.csv`)});
}

/**
 * Das Protokoll als Datei — mit denselben Filtern, die auf der Seite gesetzt
 * sind. Eine Betriebsprüfung fragt nach einem Ausschnitt („alles, was den
 * August berührt hat"), nicht nach der ganzen Datenbank, und ein Auszug, der
 * nicht dem entspricht, was am Bildschirm stand, taugt als Nachweis nichts.
 *
 * Das Siegel jeder Zeile geht mit: erst damit lässt sich der Auszug gegen die
 * Datenbank halten.
 */
function protokollCsv(url: URL): Response {
  const p = url.searchParams;
  const tag = /^\d{4}-\d{2}-\d{2}$/.test(p.get('tag') ?? '') ? p.get('tag')! : null;
  const von = tag ?? (/^\d{4}-\d{2}-\d{2}$/.test(p.get('von') ?? '') ? p.get('von')! : undefined);
  const bis = tag ?? (/^\d{4}-\d{2}-\d{2}$/.test(p.get('bis') ?? '') ? p.get('bis')! : undefined);

  const filter = {
    vonISO: von,
    bisISO: bis,
    bereich: istBereich(p.get('bereich') ?? undefined) ? (p.get('bereich') as ProtokollBereich) : null,
    betroffenId: p.get('person') ? Number(p.get('person')) || null : null,
    akteurId: p.get('akteur') ? Number(p.get('akteur')) || null : null,
    suche: p.get('suche'),
    nurEingriffe: p.get('nur') !== 'alles',
    sortierung: 'alt' as const,
  };

  // Vollständig geblättert statt bei der Seitengrenze abgeschnitten. Der erste
  // Bau nahm die 500 Zeilen, die `protokollSeite()` höchstens gibt — bei
  // fünfzig Mitarbeitern und eingeschaltetem Stempeln ist ein gewöhnlicher
  // Monat aber vierstellig, und die Datei hätte die *ältesten* 500 enthalten
  // und dabei vollständig ausgesehen. Ein Auszug, der stillschweigend endet,
  // ist als Nachweis schlimmer als gar keiner.
  const SEITE = 500;
  const OBERGRENZE = 50_000;
  const eintraege = [];
  for (let offset = 0; offset < OBERGRENZE; offset += SEITE) {
    const stapel = protokollSeite({...filter, limit: SEITE, offset}).eintraege;
    eintraege.push(...stapel);
    if (stapel.length < SEITE) break;
  }

  const lines: string[] = [
    'Zeitpunkt;Bereich;Vorgang;Gegenstand;Betrifft;Ausgeführt von;Rolle;Geschäftstag;Vorher;Nachher;Ergebnis;Meldung;Siegel',
  ];
  for (const e of eintraege) {
    lines.push(
      [
        e.ts,
        istBereich(e.bereich) ? BEREICH_LABEL[e.bereich] : e.bereich,
        aktionLabel(e.aktion),
        feld(e.gegenstand),
        feld(e.betroffen_name ?? ''),
        feld(e.akteur_name),
        e.akteur_rolle ? rolleLabel(e.akteur_rolle) : '',
        e.datum ?? '',
        feld(werteText(e.vorher)),
        feld(werteText(e.nachher)),
        e.ergebnis === 'fehler' ? 'Abgewiesen' : 'Ausgeführt',
        feld(e.meldung ?? ''),
        e.hash,
      ].join(';'),
    );
  }

  const csv = '﻿' + lines.join('\r\n');
  const spanne = von && bis ? `${von}_${bis}` : 'gesamt';
  return new Response(csv, {headers: CSV_HEADERS(`medarbeiter-protokoll-${spanne}.csv`)});
}

/** Die eingefrorenen Werte als „Feld: Wert" — lesbar in einer Tabellenzelle. */
function werteText(json: string | null): string {
  if (!json) return '';
  try {
    return Object.entries(JSON.parse(json) as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${v}`)
      .join(' | ');
  } catch {
    return '';
  }
}

/**
 * Semikolons im Freitext würden die Spalten sprengen — dieselbe Regel wie bei
 * den Notizen. Zeilenumbrüche ebenso, in beiden Schreibweisen.
 *
 * Und ein führendes `=`, `+`, `-` oder `@` bekommt ein Apostroph vorangestellt:
 * Excel und LibreOffice lesen eine so beginnende Zelle als **Formel**. Das ist
 * keine Theorie — das Protokoll hält die bei einer gescheiterten Anmeldung
 * eingegebene Adresse fest, und die kann jeder eintippen, der das Anmeldefeld
 * erreicht. Ohne diese Zeile könnte jemand ohne Zugangsdaten eine Formel in
 * die Datei schreiben, die die Verwaltung später öffnet.
 */
function feld(value: string): string {
  const sauber = value.replaceAll(';', ',').replaceAll('\r\n', ' ').replaceAll('\n', ' ').replaceAll('\r', ' ');
  return /^[=+\-@\t]/.test(sauber) ? `'${sauber}` : sauber;
}
