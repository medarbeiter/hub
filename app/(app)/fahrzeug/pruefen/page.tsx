import {StatusLeiste} from '@/components/bereichs-leiste';
import {FahrzeugAnsicht, FALL_STATUS_SINN} from '@/components/fahrzeug-ansicht';
import type {Sinn} from '@/components/sinnbilder';
import {requireRecht} from '@/lib/auth';
import type {FahrzeugFallStatus} from '@/lib/db';
import {faelleZurAbrechnung, fallAnsicht} from '@/lib/fahrzeug';
import {fmtEuro, todayISO} from '@/lib/format';

export const dynamic = 'force-dynamic';

const FILTER: Array<{value: FahrzeugFallStatus | 'alle'; label: string; sinn: Sinn}> = [
  {value: 'geschlossen', label: 'Abzurechnen', sinn: FALL_STATUS_SINN.geschlossen},
  {value: 'abgerechnet', label: 'Abgerechnet', sinn: FALL_STATUS_SINN.abgerechnet},
  {value: 'offen', label: 'Noch offen', sinn: FALL_STATUS_SINN.offen},
  {value: 'alle', label: 'Alle', sinn: 'fahrzeug'},
];

interface PageProps {
  searchParams: Promise<{status?: string}>;
}

/** Die geschlossenen Fahrzeugfälle aller Mitarbeitenden, zum Übernehmen in die Abrechnung. */
export default async function FahrzeugPruefenPage({searchParams}: PageProps) {
  const actor = await requireRecht('spesen.pruefen');
  const params = await searchParams;
  const status = FILTER.find((f) => f.value === params.status)?.value ?? 'geschlossen';

  const faelle = faelleZurAbrechnung(status).map((e) => fallAnsicht(e, actor));
  const wartend = status === 'geschlossen' ? faelle.length : faelleZurAbrechnung('geschlossen').length;
  const summe = faelle.reduce((s, f) => s + f.summeCent, 0);
  const personen = new Set(faelle.map((f) => f.person?.id)).size;

  return (
    <FahrzeugAnsicht
      userId={actor.id}
      modus="abrechnung"
      faelle={faelle}
      heute={todayISO()}
      figur={String(wartend)}
      figurEinheit={wartend === 1 ? 'Fall wartet auf die Abrechnung' : 'Fälle warten auf die Abrechnung'}
      stand={
        faelle.length === 0
          ? 'Nichts in dieser Auswahl.'
          : `In der Auswahl: ${faelle.length} ${faelle.length === 1 ? 'Fall' : 'Fälle'} von ${personen} ${
              personen === 1 ? 'Person' : 'Personen'
            } · ${fmtEuro(summe)}`
      }
      nav={
        <StatusLeiste
          aktiv={status}
          tabs={FILTER.map((f) => ({
            value: f.value,
            label: f.value === 'geschlossen' && wartend > 0 ? `${f.label} (${wartend})` : f.label,
            href: `/fahrzeug/pruefen?status=${f.value}`,
            sinn: f.sinn,
          }))}
        />
      }
    />
  );
}
