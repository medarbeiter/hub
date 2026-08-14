import {AbwesenheitAnsicht} from '@/components/abwesenheit-ansicht';
import type {AbwesenheitAnsicht as AbwesenheitZeile} from '@/components/abwesenheit-stapel';
import {MonatJahrLeiste} from '@/components/bereichs-leiste';
import {
  abwesenheitenForMonth,
  abwesenheitenForYear,
  anspruchFor,
  mitTagen,
} from '@/lib/abwesenheit';
import {istAntrag, tageDerSpanne} from '@/lib/abwesenheit-arten';
import {requireUser} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {istMonatJahrBereich, type MonatJahrBereich} from '@/lib/bereiche';
import {bundeslandFor} from '@/lib/daytypes';
import {holidaysInRange} from '@/lib/feiertage';
import {dailySollMinutes, monthOf, todayISO} from '@/lib/format';
import {zeitkontoSummary} from '@/lib/time';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ansicht?: string; monat?: string; von?: string; bis?: string}>;
}

/** Der letzte Tag eines Monats, ohne Kalenderrechnerei über Monatslängen. */
function letzterTag(monat: string): string {
  const [jahr, m] = monat.split('-').map(Number);
  return `${monat}-${String(new Date(jahr!, m!, 0).getDate()).padStart(2, '0')}`;
}

export default async function AbwesenheitPage({searchParams}: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const today = todayISO();

  const ansicht: MonatJahrBereich = istMonatJahrBereich(params.ansicht) ? params.ansicht : 'monat';
  // Anders als bei den Spesen darf der Zeitraum in der Zukunft liegen: ein
  // Urlaub wird beantragt, bevor er stattfindet.
  const monat = /^\d{4}-\d{2}$/.test(params.monat ?? '') ? params.monat! : monthOf(today);
  const jahr = monat.slice(0, 4);

  const eintraege = ansicht === 'monat'
    ? abwesenheitenForMonth(user.id, monat)
    : abwesenheitenForYear(user.id, jahr);

  const abwesenheiten: AbwesenheitZeile[] = eintraege.map((a) => {
    const mit = mitTagen(a, user);
    return {
      id: a.id,
      von: a.von,
      bis: a.bis,
      art: a.art,
      status: a.status,
      notiz: a.notiz,
      tage: mit.tage,
      arbeitstage: mit.arbeitstage,
      locked: mit.locked,
      auFehlt: mit.auFehlt,
      auDateiName: a.au_datei_name,
      // Was hier entschieden wird, entscheidet lib/abwesenheit.ts noch einmal —
      // die Knöpfe zeigen nur, was ohnehin erlaubt wäre.
      darfBearbeiten: !mit.locked && (a.status !== 'genehmigt' || hatRecht(user, 'abwesenheit.pruefen')),
      darfEinreichen: istAntrag(a.art) && a.status === 'entwurf' && !mit.locked,
      darfZurueckziehen: a.status === 'eingereicht',
      entscheidungNotiz: a.entscheidung_notiz,
      selbstGenehmigt: a.selbst_genehmigt === 1,
    };
  });

  const vonISO = ansicht === 'monat' ? `${monat}-01` : `${jahr}-01-01`;
  const bisISO = ansicht === 'monat' ? letzterTag(monat) : `${jahr}-12-31`;

  // Der Editor rechnet mit, während gewählt wird — dafür braucht er den
  // Feiertagskalender als Daten. Bewusst über den Jahreswechsel hinaus, weil
  // eine Spanne im Dezember in den Januar reichen darf.
  const land = bundeslandFor(user);
  const feiertage = land
    ? [...holidaysInRange(`${Number(jahr) - 1}-01-01`, `${Number(jahr) + 1}-12-31`, land).keys()]
    : [];

  // Die Ruhetage des gezeigten Monats: Wochenenden und Feiertage. Sie
  // hinterlegen die Zellen des Gitters und machen damit sichtbar, warum zwölf
  // Kalendertage nur acht Urlaubstage kosten.
  const feiertageSatz = new Set(feiertage);
  const ruhetage = tageDerSpanne(vonISO, bisISO).filter(
    (t) => feiertageSatz.has(t) || dailySollMinutes(user, t) === 0,
  );

  return (
    <AbwesenheitAnsicht
      userId={user.id}
      ansicht={ansicht}
      abwesenheiten={abwesenheiten}
      vonISO={vonISO}
      bisISO={bisISO}
      monat={monat}
      ruhetage={ruhetage}
      jahr={jahr}
      anspruch={anspruchFor(user, jahr)}
      saldoMin={zeitkontoSummary(user, today).balanceMin}
      wochenMinuten={user.weekly_minutes}
      feiertage={feiertage}
      neuVon={/^\d{4}-\d{2}-\d{2}$/.test(params.von ?? '') ? params.von! : null}
      neuBis={/^\d{4}-\d{2}-\d{2}$/.test(params.bis ?? '') ? params.bis! : null}
      heute={today}
      nav={<MonatJahrLeiste route="/abwesenheit" ansicht={ansicht} monat={monat} today={today} nachVorn />}
    />
  );
}
