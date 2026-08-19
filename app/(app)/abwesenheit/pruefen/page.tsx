import {Text, VStack} from '@astryxdesign/core';
import {AbwesenheitPruefListe, type PruefZeile} from '@/components/abwesenheit-pruefliste';
import {StatusLeiste} from '@/components/bereichs-leiste';
import {ABWESENHEIT_STATUS_SINN, type Sinn} from '@/components/sinnbilder';
import {UebertragPflege} from '@/components/uebertrag-pflege';
import {ZeitRahmen} from '@/components/zeit-rahmen';
import {abwesenheitenZurPruefung, anspruchFor} from '@/lib/abwesenheit';
import {restanspruch} from '@/lib/abwesenheit-arten';
import {requireRecht} from '@/lib/auth';
import type {AbwesenheitStatus} from '@/lib/db';
import {monthOf, todayISO} from '@/lib/format';
import {allUsers} from '@/lib/users';

export const dynamic = 'force-dynamic';

const FILTER: Array<{value: AbwesenheitStatus | 'alle'; label: string; sinn: Sinn}> = [
  {value: 'eingereicht', label: 'Zu prüfen', sinn: ABWESENHEIT_STATUS_SINN.eingereicht},
  {value: 'gemeldet', label: 'Meldungen', sinn: ABWESENHEIT_STATUS_SINN.gemeldet},
  {value: 'genehmigt', label: 'Genehmigt', sinn: ABWESENHEIT_STATUS_SINN.genehmigt},
  {value: 'abgelehnt', label: 'Abgelehnt', sinn: ABWESENHEIT_STATUS_SINN.abgelehnt},
];

interface PageProps {
  searchParams: Promise<{status?: string; offen?: string}>;
}

export default async function AbwesenheitPruefenPage({searchParams}: PageProps) {
  const actor = await requireRecht('abwesenheit.pruefen');
  const params = await searchParams;
  const status = (FILTER.find((f) => f.value === params.status)?.value ?? 'eingereicht') as
    | AbwesenheitStatus
    | 'alle';

  const jahr = monthOf(todayISO()).slice(0, 4);
  const nutzer = new Map(allUsers().map((u) => [u.id, u]));

  const zeilen: PruefZeile[] = abwesenheitenZurPruefung(status).map((e) => {
    const user = nutzer.get(e.abwesenheit.user_id);
    // Was nach einer Genehmigung übrig bliebe. Nur beim Urlaub eine Zahl: bei
    // einer Meldung gibt es keinen Anspruch, der sich ändern könnte.
    const restNachher =
      user && e.abwesenheit.art === 'urlaub'
        ? restanspruch(anspruchFor(user, jahr)) -
          (e.abwesenheit.status === 'genehmigt' ? 0 : e.arbeitstage.length)
        : null;
    return {
      id: e.abwesenheit.id,
      userName: e.userName,
      person: e.person,
      von: e.abwesenheit.von,
      bis: e.abwesenheit.bis,
      art: e.abwesenheit.art,
      status: e.abwesenheit.status,
      notiz: e.abwesenheit.notiz,
      kalendertage: e.tage.length,
      arbeitstage: e.arbeitstage.length,
      minuten: e.abwesenheit.minuten,
      ruecksprache: e.abwesenheit.ruecksprache_vorgesetzte === 1,
      auDateiName: e.abwesenheit.au_datei_name,
      auFehlt: e.auFehlt,
      restNachher,
      istEigene: e.abwesenheit.user_id === actor.id,
    };
  });

  const wartend =
    status === 'eingereicht' ? zeilen.length : abwesenheitenZurPruefung('eingereicht').length;
  const personen = new Set(zeilen.map((z) => z.userName)).size;
  const tage = zeilen.reduce((s, z) => s + z.arbeitstage, 0);

  return (
    <ZeitRahmen
      titel="Abwesenheit prüfen"
      sinn="pruefen"
      figur={String(wartend)}
      figurEinheit={wartend === 1 ? 'wartet auf Entscheidung' : 'warten auf Entscheidung'}
      stand={
        zeilen.length === 0
          ? 'Nichts in dieser Auswahl.'
          : `In der Auswahl: ${zeilen.length} ${zeilen.length === 1 ? 'Eintrag' : 'Einträge'} von ${personen} ${
              personen === 1 ? 'Person' : 'Personen'
            } · ${tage} ${tage === 1 ? 'Tag' : 'Tage'}`
      }
      /* Kein `werkzeuge` und damit bewusst kein „Alle genehmigen" wie bei den
         Spesen: eine Reise ist geschehen und wird nur nachgerechnet, ein
         Urlaubsantrag ist eine Entscheidung über eine Woche, in der jemand
         fehlen wird. */
      nav={
        <StatusLeiste
          aktiv={status}
          tabs={FILTER.map((f) => ({
            value: f.value,
            label: f.value === 'eingereicht' && wartend > 0 ? `${f.label} (${wartend})` : f.label,
            href: `/abwesenheit/pruefen?status=${f.value}`,
            sinn: f.sinn,
          }))}
        />
      }
      belege={
        <VStack gap={5}>
          <AbwesenheitPruefListe zeilen={zeilen} zeigeId={Number(params.offen) || null} />

          <UebertragPflege
            jahr={jahr}
            zeilen={[...nutzer.values()]
              .filter((u) => u.active === 1)
              .map((u) => {
                const a = anspruchFor(u, jahr);
                return {
                  userId: u.id,
                  name: u.name,
                  jahresanspruch: a.jahresanspruch,
                  uebertrag: a.uebertrag,
                  genehmigt: a.genehmigt,
                  rest: restanspruch(a),
                };
              })}
          />

          <Text type="supporting" color="secondary">
            Abgezogen wird bei der Genehmigung. Solange ein Antrag auf die Entscheidung wartet, lässt
            sich sein Monat nicht abschließen. Eine Krankmeldung durchläuft keine Prüfung – sie steht
            unter „Meldungen", damit sichtbar ist, wo eine Bescheinigung fehlt.
          </Text>
        </VStack>
      }
    />
  );
}
