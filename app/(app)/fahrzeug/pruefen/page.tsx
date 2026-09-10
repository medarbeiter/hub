import {StatusLeiste} from '@/components/bereichs-leiste';
import {FahrzeugAnsicht} from '@/components/fahrzeug-ansicht';
import type {Sinn} from '@/components/sinnbilder';
import {requireRecht} from '@/lib/auth';
import {faelleZurAbrechnung, fallAnsicht, tankbelegAnsicht, tankbelegeZurAbrechnung, type AbrechnungsFilter} from '@/lib/fahrzeug';
import {fmtEuro, todayISO} from '@/lib/format';

export const dynamic = 'force-dynamic';

const FILTER: Array<{value: AbrechnungsFilter; label: string; sinn: Sinn}> = [
  {value: 'offen', label: 'Abzurechnen', sinn: 'einreichen'},
  {value: 'abgerechnet', label: 'Abgerechnet', sinn: 'abrechnen'},
  {value: 'alle', label: 'Alle', sinn: 'fahrzeug'},
];

interface PageProps {
  searchParams: Promise<{status?: string}>;
}

/** Tankbelege und geschlossene Servicefälle aller Mitarbeitenden, zum Übernehmen in die Abrechnung. */
export default async function FahrzeugPruefenPage({searchParams}: PageProps) {
  const actor = await requireRecht('fahrzeug.abrechnen');
  const params = await searchParams;
  const filter = FILTER.find((f) => f.value === params.status)?.value ?? 'offen';

  const tankbelege = tankbelegeZurAbrechnung(filter).map((e) => tankbelegAnsicht(e, actor));
  const faelle = faelleZurAbrechnung(filter).map((e) => fallAnsicht(e, actor));
  const tankOffen = filter === 'offen' ? tankbelege.length : tankbelegeZurAbrechnung('offen').length;
  const wartend = tankOffen + (filter === 'offen' ? faelle.length : faelleZurAbrechnung('offen').length);
  const summe = tankbelege.reduce((s, b) => s + b.betragCent, 0) + faelle.reduce((s, f) => s + f.summeCent, 0);
  const personen = new Set([...tankbelege.map((b) => b.person?.id), ...faelle.map((f) => f.person?.id)]).size;

  return (
    <FahrzeugAnsicht
      modus="abrechnung"
      tankbelege={tankbelege}
      faelle={faelle}
      heute={todayISO()}
      tankOffen={tankOffen}
      figur={String(wartend)}
      figurEinheit={wartend === 1 ? 'wartet auf die Abrechnung' : 'warten auf die Abrechnung'}
      stand={
        tankbelege.length + faelle.length === 0
          ? 'Nichts in dieser Auswahl.'
          : `In der Auswahl: ${tankbelege.length} ${tankbelege.length === 1 ? 'Tankbeleg' : 'Tankbelege'} und ${faelle.length} ${
              faelle.length === 1 ? 'Servicefall' : 'Servicefälle'
            } von ${personen} ${personen === 1 ? 'Person' : 'Personen'} · ${fmtEuro(summe)}`
      }
      nav={
        <StatusLeiste
          aktiv={filter}
          tabs={FILTER.map((f) => ({
            value: f.value,
            label: f.value === 'offen' && wartend > 0 ? `${f.label} (${wartend})` : f.label,
            href: `/fahrzeug/pruefen?status=${f.value}`,
            sinn: f.sinn,
          }))}
        />
      }
    />
  );
}
