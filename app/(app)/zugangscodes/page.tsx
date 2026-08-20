import {Badge, VStack} from '@astryxdesign/core';
import {requireRecht} from '@/lib/auth';
import {hatRecht} from '@/lib/rechte';
import {einParameter} from '@/lib/format';
import {alleRollen} from '@/lib/rollen';
import {activeUsers} from '@/lib/time';
import {aktuelleZugangscodes} from '@/lib/zugangscodes';
import {ZeitRahmen} from '@/components/zeit-rahmen';
import {ZugangscodeFilter} from '@/components/zugangscode-filter';
import {ZugangAnlegen, ZugangscodeTafel} from '@/components/zugangscode-tafel';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Zugangscodes — die Einmalcodes hinterlegter Konten, je Zugang mit
 * Leserkreis: der Firmenbestand für alle, geteilte Kreise, eigene Schlüssel.
 * Jeder mit `zugangscodes.erfassen` hinterlegt eigene Zugänge (nur für sich
 * oder mit Personen geteilt); wer `zugangscodes.verwalten` trägt, gibt auch
 * für alle oder für Rollen frei und pflegt jeden Eintrag. Der Code wird auf
 * dem Server gerechnet und läuft ab — das Geheimnis dahinter erreicht den
 * Browser nie (lib/zugangscodes.ts).
 *
 * Suche (`?suche=` über Dienst und Konto) und Dienst-Auswahl (`?dienst=`)
 * stehen in der Adresse und werden hier zugeschnitten, obwohl die Liste klein
 * ist: die Adresse bleibt die eine Wahrheit (dieselbe Regel wie beim
 * Protokoll), und die halbminütliche Erneuerung der Codes behält den Filter,
 * weil `router.refresh()` genau diese Adresse neu lädt.
 */
export default async function ZugangscodesPage({searchParams}: PageProps) {
  const user = await requireRecht('zugangscodes.sehen');
  const roh = await searchParams;
  const suche = (einParameter(roh.suche) ?? '').trim();
  const dienst = (einParameter(roh.dienst) ?? '').trim();

  const jetztMs = Date.now();
  const darfErfassen = hatRecht(user, 'zugangscodes.erfassen');
  const darfVerwalten = hatRecht(user, 'zugangscodes.verwalten');
  const alle = aktuelleZugangscodes(user, jetztMs);
  // Die Auswahl für den Personenkreis im Formular. Die Namen sind im Haus
  // ohnehin sichtbar (Teamkalender: eine Bahn je Person, für alle).
  const personenWahl = darfErfassen
    ? activeUsers().map((u) => ({value: String(u.id), label: u.name}))
    : [];
  // Der Rollenkreis steht nur Verwaltenden offen — alle anderen brauchen die
  // Liste nicht und bekommen sie auch nicht.
  const rollenWahl = darfVerwalten
    ? alleRollen().map((r) => ({value: r.schluessel, label: r.label}))
    : [];
  // Aus der ungefilterten Menge, und die Abfrage sortiert bereits nach Dienst.
  const dienste = [...new Set(alle.map((c) => c.dienst))];

  const klein = suche.toLowerCase();
  const codes = alle.filter(
    (c) =>
      (dienst === '' || c.dienst === dienst) &&
      (klein === '' ||
        c.dienst.toLowerCase().includes(klein) ||
        (c.konto ?? '').toLowerCase().includes(klein)),
  );
  const gefiltert = suche !== '' || dienst !== '';

  return (
    <ZeitRahmen
      titel="Zugangscodes"
      figur={String(codes.length)}
      figurEinheit={codes.length === 1 ? 'Zugang' : 'Zugänge'}
      stand={
        gefiltert
          ? `${alle.length} ${alle.length === 1 ? 'Zugang' : 'Zugänge'} insgesamt · Filter aktiv`
          : 'Einmalcodes für hinterlegte Konten – sie erneuern sich von selbst.'
      }
      figurMeta={dienst !== '' ? <Badge variant="neutral" label={dienst} /> : null}
      werkzeuge={
        darfErfassen ? (
          <ZugangAnlegen selbstId={user.id} darfVerwalten={darfVerwalten} personenWahl={personenWahl} rollenWahl={rollenWahl} />
        ) : null
      }
      belege={
        <VStack gap={4}>
          {/* Über nichts filtert niemand — die Leiste erscheint erst, wenn es
              Zugänge gibt, und bleibt, solange ein Filter greift (sonst käme
              man aus einer leeren Trefferliste nicht mehr heraus). */}
          {(alle.length > 0 || gefiltert) && <ZugangscodeFilter dienste={dienste} />}
          <ZugangscodeTafel
            codes={codes}
            serverJetztMs={jetztMs}
            selbstId={user.id}
            darfVerwalten={darfVerwalten}
            personenWahl={personenWahl}
            rollenWahl={rollenWahl}
            gefiltert={gefiltert}
          />
        </VStack>
      }
    />
  );
}
