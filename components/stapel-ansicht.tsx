import type {ReactNode} from 'react';
import {Badge} from '@astryxdesign/core';
import {fmtDuration, fmtDurationSigned, kwOf, weekdayIndex} from '@/lib/format';
import type {PeriodRecord} from '@/lib/period';
import {BahnenStapel, type StapelTag} from './bahnen-stapel';
import {ZeitRahmen} from './zeit-rahmen';

const LOCKED_NOTE = 'Dieser Monat ist abgeschlossen. Änderungen sind nur über die Verwaltung möglich.';

interface StapelAnsichtProps {
  userId: number;
  titel: string;
  period: PeriodRecord;
  selectedDate: string;
  nowMin: number;
  /** "/" for one's own time, "/team/7" for a manager looking at an employee. */
  basePath: string;
  nav: ReactNode;
  kontext: ReactNode;
}

/**
 * Woche and Monat: the same frame, the same lanes, the same rows — only the
 * number of days differs. A month additionally groups its lanes by calendar
 * week, because that is the unit a Soll is actually agreed in.
 */
export function StapelAnsicht(props: StapelAnsichtProps) {
  const {period} = props;

  const days: StapelTag[] = period.days.map((d, index) => {
    const neueWoche = period.kind === 'monat' && (index === 0 || weekdayIndex(d.record.date) === 0);
    const wocheTage = neueWoche
      ? period.days.filter((o) => kwOf(o.record.date) === kwOf(d.record.date))
      : [];
    return {
      date: d.record.date,
      segments: d.record.segments,
      workedMin: d.record.summary.workedMin,
      pauseMin: d.record.summary.pauseMin,
      sollMin: d.record.sollMin,
      hasOpen: d.record.summary.hasOpen,
      dayType: d.record.dayType,
      dayTypeLabel: d.record.dayTypeLabel,
      issues: d.issues,
      plan: d.plan,
      isToday: d.isToday,
      isFuture: d.isFuture,
      gruppeVor: neueWoche
        ? {
            label: `KW ${kwOf(d.record.date)}`,
            workedMin: wocheTage.reduce((s, o) => s + o.record.summary.workedMin, 0),
            sollMin: wocheTage.reduce((s, o) => s + o.record.sollMin, 0),
          }
        : undefined,
    };
  });

  return (
    <ZeitRahmen
      titel={props.titel}
      figur={fmtDuration(period.workedMin)}
      figurEinheit={`von ${fmtDuration(period.sollMin)} Std.`}
      stand={
        period.sollMin === 0 && period.workedMin === 0 ? (
          'Noch nichts erfasst.'
        ) : (
          <>
            {period.saldoIsPartial ? 'Saldo bis gestern ' : 'Saldo '}
            <span style={{color: period.saldoMin >= 0 ? 'var(--color-text-accent)' : 'var(--color-error)'}}>
              {fmtDurationSigned(period.saldoMin)} Std.
            </span>
            {period.queue.length > 0 && (
              <>
                {' · '}
                {period.queue.length} {period.queue.length === 1 ? 'Tag braucht' : 'Tage brauchen'} eine Korrektur
              </>
            )}
          </>
        )
      }
      figurMeta={period.locked ? <Badge variant="info" label="Monat abgeschlossen" /> : undefined}
      nav={props.nav}
      buehne={
        <BahnenStapel
          userId={props.userId}
          days={days}
          span={period.span}
          nowMin={props.nowMin}
          selectedDate={props.selectedDate}
          canEdit={!period.locked}
          lockedNote={period.locked ? LOCKED_NOTE : undefined}
          bereich={period.kind === 'monat' ? 'monat' : 'woche'}
          basePath={props.basePath}
          queue={period.queue}
        />
      }
      kontext={props.kontext}
    />
  );
}
