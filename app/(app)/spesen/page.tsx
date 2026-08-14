import {MonatJahrLeiste} from '@/components/bereichs-leiste';
import type {JahresMonat} from '@/components/reisen-stapel';
import {SpesenAnsicht} from '@/components/spesen-ansicht';
import {requireUser} from '@/lib/auth';
import {istMonatJahrBereich, type MonatJahrBereich} from '@/lib/bereiche';
import {bundeslandFor} from '@/lib/daytypes';
import {holidaysInRange} from '@/lib/feiertage';
import {addDays, addMonths, dailySollMinutes, monthOf, todayISO} from '@/lib/format';
import {reisenForMonth, reisenForYear} from '@/lib/spesen';
import {reiseAnsicht} from '@/lib/spesen-tafel';
import {spesenSaetze} from '@/lib/settings';
import {segmentsForDay} from '@/lib/time';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ansicht?: string; monat?: string; neu?: string}>;
}

/** Der letzte Tag eines Monats, ohne Kalenderrechnerei über Monatslängen. */
function letzterTag(monat: string): string {
  const [jahr, m] = monat.split('-').map(Number);
  return `${monat}-${String(new Date(jahr!, m!, 0).getDate()).padStart(2, '0')}`;
}

export default async function SpesenPage({searchParams}: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const ansicht: MonatJahrBereich = istMonatJahrBereich(params.ansicht) ? params.ansicht : 'monat';
  const ausUrl = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : null;
  // Nichts nach dem laufenden Monat: eine Reise wird nach der Rückkehr abgerechnet.
  const monat = ausUrl && ausUrl <= monthOf(today) ? ausUrl : monthOf(today);
  const jahr = monat.slice(0, 4);

  const eintraege = ansicht === 'monat' ? reisenForMonth(user.id, monat) : reisenForYear(user.id, jahr);
  const reisen = eintraege.map((e) => reiseAnsicht(e, user));

  // Die Rail zeigt immer das ganze Jahr, egal welcher Zeitraum offen ist.
  const jahrEintraege = ansicht === 'jahr' ? eintraege : reisenForYear(user.id, jahr);
  const jahrSummeCent = jahrEintraege.reduce((s, e) => s + e.rechnung.summeCent, 0);

  const monate: JahresMonat[] =
    ansicht === 'jahr'
      ? Array.from({length: 12}, (_, i) => {
          const m = `${jahr}-${String(i + 1).padStart(2, '0')}`;
          const drin = jahrEintraege.filter((e) => monthOf(e.reise.start_date) === m);
          return {
            monat: m,
            summeCent: drin.reduce((s, e) => s + e.rechnung.summeCent, 0),
            reisen: drin.length,
            tage: drin.reduce((s, e) => s + e.rechnung.tage.length, 0),
          };
        })
      : [];

  // Erster Einstempel- und letzter Ausstempelzeitpunkt je Tag: das Angebot im
  // Editor, aus dem gestempelten Tag eine Abwesenheit zu machen.
  const stempelZeiten: Record<string, {vonMin: number; bisMin: number}> = {};
  for (const datum of stempelKandidaten(monat, today, params.neu)) {
    const segments = segmentsForDay(user.id, datum).filter((s) => s.kind === 'arbeit');
    if (segments.length === 0) continue;
    const erstes = segments[0]!;
    const letztes = segments.at(-1)!;
    stempelZeiten[datum] = {
      vonMin: erstes.start_min,
      bisMin: letztes.end_min ?? erstes.start_min,
    };
  }

  const neuDatum = /^\d{4}-\d{2}-\d{2}$/.test(params.neu ?? '') ? params.neu! : null;

  // Die Ruhetage hinterlegen die Zellen des Gitters. Sie folgen dem Kalender
  // der lesenden Person — bei den Spesen ändern sie nichts an der Rechnung,
  // sondern sind reine Lesehilfe: eine Reise über ein Wochenende zählt
  // trotzdem, anders als eine Abwesenheit.
  const land = bundeslandFor(user);
  const vonISO = ansicht === 'monat' ? `${monat}-01` : `${jahr}-01-01`;
  const bisISO = ansicht === 'monat' ? letzterTag(monat) : `${jahr}-12-31`;
  const feiertage = land ? holidaysInRange(vonISO, bisISO, land) : new Map<string, string>();
  const ruhetage: string[] = [];
  for (let d = vonISO; d <= bisISO; d = addDays(d, 1)) {
    if (feiertage.has(d) || dailySollMinutes(user, d) === 0) ruhetage.push(d);
  }

  return (
    <SpesenAnsicht
      userId={user.id}
      ansicht={ansicht}
      reisen={reisen}
      monate={monate}
      vonISO={vonISO}
      bisISO={bisISO}
      monat={monat}
      ruhetage={ruhetage}
      jahr={jahr}
      jahrSummeCent={jahrSummeCent}
      jahrReisen={jahrEintraege.length}
      saetze={spesenSaetze()}
      stempelZeiten={stempelZeiten}
      neuDatum={neuDatum}
      heute={today}
      nav={<MonatJahrLeiste route="/spesen" ansicht={ansicht} monat={monat} today={today} />}
    />
  );
}

/**
 * Für welche Tage die Stempelzeiten geladen werden. Ein ganzes Jahr Tag für Tag
 * abzufragen wäre Verschwendung — der Editor braucht sie für den offenen Monat,
 * den Monat davor und den Tag, der aus „Als Dienstreise abrechnen" kommt.
 */
function stempelKandidaten(monat: string, today: string, neu: string | undefined): string[] {
  const ende = letzterTag(monat) > today ? today : letzterTag(monat);
  const tage: string[] = [];
  for (let d = `${addMonths(monat, -1)}-01`; d <= ende; d = addDays(d, 1)) tage.push(d);
  if (neu && /^\d{4}-\d{2}-\d{2}$/.test(neu) && !tage.includes(neu)) tage.push(neu);
  return tage;
}
