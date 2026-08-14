import {Text, VStack} from '@astryxdesign/core';
import {StatusLeiste} from '@/components/bereichs-leiste';
import {AlleGenehmigenButton, PruefListe} from '@/components/pruef-liste';
import {requireRecht} from '@/lib/auth';
import type {ReiseStatus} from '@/lib/db';
import {fmtEuro} from '@/lib/format';
import {reisenZurPruefung} from '@/lib/spesen';
import {reiseAnsicht} from '@/lib/spesen-tafel';
import {REISE_STATUS_SINN, type Sinn} from '@/components/sinnbilder';
import {ZeitRahmen} from '@/components/zeit-rahmen';

export const dynamic = 'force-dynamic';

const FILTER: Array<{value: ReiseStatus | 'alle'; label: string; sinn: Sinn}> = [
  {value: 'eingereicht', label: 'Zu prüfen', sinn: REISE_STATUS_SINN.eingereicht},
  {value: 'genehmigt', label: 'Genehmigt', sinn: REISE_STATUS_SINN.genehmigt},
  {value: 'abgelehnt', label: 'Abgelehnt', sinn: REISE_STATUS_SINN.abgelehnt},
  {value: 'alle', label: 'Alle', sinn: 'reise'},
];

interface PageProps {
  searchParams: Promise<{status?: string}>;
}

export default async function SpesenPruefenPage({searchParams}: PageProps) {
  const actor = await requireRecht('spesen.pruefen');
  const params = await searchParams;
  const status = (FILTER.find((f) => f.value === params.status)?.value ?? 'eingereicht') as
    | ReiseStatus
    | 'alle';

  const eintraege = reisenZurPruefung(status);
  const reisen = eintraege.map((e) => reiseAnsicht(e, actor, e.userName));
  const summe = reisen.reduce((s, r) => s + r.summeCent, 0);
  const personen = new Set(reisen.map((r) => r.userName)).size;

  // Die Zahl in der Kopfzeile zählt immer die Warteschlange, egal welcher
  // Filter offen ist — sonst verschwindet die eigentliche Arbeit aus dem Blick.
  const wartend = status === 'eingereicht' ? reisen.length : reisenZurPruefung('eingereicht').length;

  return (
    <ZeitRahmen
      titel="Spesen prüfen"
      sinn="pruefen"
      /* Die Warteschlange, nicht die offene Auswahl: die Zahl in Anzeigengröße
         ist die Arbeit, die noch aussteht, und die verschwindet nicht, weil
         gerade der Reiter „Genehmigt" offen steht. */
      figur={String(wartend)}
      figurEinheit={wartend === 1 ? 'wartet auf Prüfung' : 'warten auf Prüfung'}
      stand={
        reisen.length === 0
          ? 'Nichts in dieser Auswahl.'
          : `In der Auswahl: ${reisen.length} ${reisen.length === 1 ? 'Reise' : 'Reisen'} von ${personen} ${
              personen === 1 ? 'Person' : 'Personen'
            } · ${fmtEuro(summe)}`
      }
      werkzeuge={status === 'eingereicht' ? <AlleGenehmigenButton anzahl={wartend} /> : null}
      nav={
        <StatusLeiste
          aktiv={status}
          tabs={FILTER.map((f) => ({
            value: f.value,
            label: f.value === 'eingereicht' && wartend > 0 ? `${f.label} (${wartend})` : f.label,
            href: `/spesen/pruefen?status=${f.value}`,
            sinn: f.sinn,
          }))}
        />
      }
      belege={
        <VStack gap={4}>
          <PruefListe reisen={reisen} />
          <Text type="supporting" color="secondary">
            Eine genehmigte Abrechnung rechnet mit den Sätzen, die beim Einreichen galten, und ändert
            ihren Betrag später nicht mehr. Solange eine Reise auf die Prüfung wartet, lässt sich ihr
            Monat nicht abschließen.
          </Text>
        </VStack>
      }
    />
  );
}
