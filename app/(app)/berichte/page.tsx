import {Badge, Button, HStack, Text, VStack} from '@astryxdesign/core';
import Link from 'next/link';
import {requireRecht} from '@/lib/auth';
import {personAngabe} from '@/lib/avatar';
import {addDays, addMonths, daysInMonth, fmtDuration, fmtDurationSigned, monthOf, todayISO} from '@/lib/format';
import {activeUsers, monthRecord, zeitkontoBalance} from '@/lib/time';
import {dayTypeCounts} from '@/lib/daytypes';
import {MonatLeiste} from '@/components/bereichs-leiste';
import {PersonenTafel, type PersonenZeile} from '@/components/personen-tafel';
import {SaldoTrend} from '@/components/saldo-trend';
import {Sinnbild} from '@/components/sinnbilder';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{monat?: string}>;
}

export default async function BerichtePage({searchParams}: PageProps) {
  await requireRecht('berichte.sehen');
  const params = await searchParams;
  const today = todayISO();
  const month = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : monthOf(today);

  const monthEnd = daysInMonth(month).at(-1)!;
  const zeitkontoThrough = monthEnd < today ? monthEnd : addDays(today, -1);

  const currentMonth = monthOf(today);
  const trendMonths = Array.from({length: 6}, (_, i) => addMonths(month, i - 5));

  const rows = activeUsers().map((u) => ({
    user: u,
    record: monthRecord(u, month),
    zeitkonto: zeitkontoBalance(u, zeitkontoThrough),
    // Wer im Monat abwesend war und warum. Die Lohnabrechnung fragt danach
    // ohnehin; bisher stand es nirgends, obwohl die Zahlen längst da waren.
    abwesenheit: dayTypeCounts(u, month),
    trend: trendMonths.map((m) => {
      const r = monthRecord(u, m);
      return {month: m, diffMin: r.workedMin - r.sollMin, isCurrent: m === currentMonth};
    }),
  }));
  const trendMaxAbs = Math.max(...rows.flatMap((r) => r.trend.map((p) => Math.abs(p.diffMin))), 0);

  const totalIst = rows.reduce((sum, r) => sum + r.record.workedMin, 0);
  const totalSoll = rows.reduce((sum, r) => sum + r.record.sollMin, 0);

  const gesamtSaldo = totalIst - totalSoll;
  const abgeschlossen = rows.filter((r) => r.record.locked).length;

  const zeilen: PersonenZeile[] = rows.map(({user, record, zeitkonto, trend, abwesenheit}) => ({
    id: user.id,
    name: user.name,
    person: personAngabe(user),
    unterzeile: `${Math.round(user.weekly_minutes / 60)} Std./Woche`,
    istMin: record.workedMin,
    sollMin: record.sollMin,
    saldoMin: record.workedMin - record.sollMin,
    kontoMin: zeitkonto,
    abwesend:
      abwesenheit.length === 0 ? (
        <Text type="supporting" size="sm" color="disabled">
          –
        </Text>
      ) : (
        <HStack gap={1} wrap="wrap">
          {abwesenheit.map((a) => (
            <Badge
              key={a.type}
              variant="neutral"
              label={`${a.days} ${a.label}`}
              icon={<Sinnbild sinn={a.type} groesse="zeile" />}
            />
          ))}
        </HStack>
      ),
    grafik: <SaldoTrend points={trend} maxAbsMin={trendMaxAbs} />,
    marken: (
      <HStack gap={1} wrap="wrap" justify="end">
        {record.locked && (
          <Badge variant="info" label="Abgeschlossen" icon={<Sinnbild sinn="gesperrt" groesse="zeile" />} />
        )}
        {record.openSegments > 0 && (
          <Badge
            variant="warning"
            label={`${record.openSegments} offen`}
            icon={<Sinnbild sinn="ohneEnde" groesse="zeile" />}
          />
        )}
      </HStack>
    ),
  }));

  return (
    <ZeitRahmen
      titel="Berichte"
      sinn="berichte"
      figur={fmtDuration(totalIst)}
      figurEinheit="Std. gesamt"
      stand={
        <>
          Soll {fmtDuration(totalSoll)} Std. ·{' '}
          <span style={{color: gesamtSaldo >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
            {fmtDurationSigned(gesamtSaldo)} Std.
          </span>{' '}
          über alle {rows.length} Mitarbeiter
        </>
      }
      figurMeta={
        abgeschlossen > 0 ? (
          <Badge
            variant="info"
            label={`${abgeschlossen} von ${rows.length} abgeschlossen`}
            icon={<Sinnbild sinn="gesperrt" groesse="zeile" />}
          />
        ) : null
      }
      werkzeuge={
        <>
          <a href={`/api/export?monat=${month}`} download style={{textDecoration: 'none'}}>
            <Button label="CSV für Lohnabrechnung" variant="secondary" size="sm" icon={<Sinnbild sinn="csv" />} />
          </a>
          <a href={`/api/export?art=spesen&monat=${month}`} download style={{textDecoration: 'none'}}>
            <Button
              label="Reisekosten (CSV + Belege)"
              variant="secondary"
              size="sm"
              icon={<Sinnbild sinn="csv" />}
            />
          </a>
          <Link href={`/druck/spesen/${month}`} target="_blank" style={{textDecoration: 'none'}}>
            <Button label="Reisekosten (PDF)" variant="secondary" size="sm" icon={<Sinnbild sinn="drucken" />} />
          </Link>
          <Link href={`/druck/${month}`} target="_blank" style={{textDecoration: 'none'}}>
            <Button label="Druckansicht (PDF)" variant="secondary" size="sm" icon={<Sinnbild sinn="drucken" />} />
          </Link>
        </>
      }
      nav={<MonatLeiste route="/berichte" monat={month} today={today} />}
      belege={
        <VStack gap={4}>
          <PersonenTafel
            zeilen={zeilen}
            spalten={['name', 'ist', 'soll', 'saldo', 'konto', 'abwesend', 'grafik', 'marken']}
            grafikKopf="Saldo-Trend"
          />

          <Text type="supporting" color="secondary">
            „Ist/Soll“ zählen erfasste Tage und Tage mit Tagesart; Urlaub, Krankheit und Feiertage
            setzen das Soll auf null, Tage ohne Ende bleiben unzählbar. Das Zeitkonto läuft bis{' '}
            {month === monthOf(today) ? 'gestern' : 'Monatsende'}. Die CSV-Datei enthält alle
            Tageswerte je Mitarbeiter. Jede Spaltenüberschrift sortiert.
          </Text>
        </VStack>
      }
    />
  );
}
