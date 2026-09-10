import {FahrzeugAnsicht} from '@/components/fahrzeug-ansicht';
import {requireUser} from '@/lib/auth';
import {faelleFor, fallAnsicht} from '@/lib/fahrzeug';
import {fmtEuro, todayISO} from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{neu?: string}>;
}

/** Dienstfahrzeug: die eigenen Fälle, offene zuerst. */
export default async function FahrzeugPage({searchParams}: PageProps) {
  const user = await requireUser();
  const params = await searchParams;
  const faelle = faelleFor(user.id).map((e) => fallAnsicht(e, user));
  const offene = faelle.filter((f) => f.status === 'offen');
  const offenCent = offene.reduce((s, f) => s + f.summeCent, 0);
  const wartend = faelle.filter((f) => f.status === 'geschlossen').length;

  return (
    <FahrzeugAnsicht
      userId={user.id}
      modus="eigen"
      faelle={faelle}
      heute={todayISO()}
      neu={params.neu !== undefined}
      figur={fmtEuro(offenCent)}
      figurEinheit={offene.length === 1 ? 'im offenen Fall' : 'in offenen Fällen'}
      stand={
        faelle.length === 0
          ? 'Noch kein Fall angelegt.'
          : `${offene.length} ${offene.length === 1 ? 'offener Fall' : 'offene Fälle'}${
              wartend > 0 ? ` · ${wartend} ${wartend === 1 ? 'wartet' : 'warten'} auf die Abrechnung` : ''
            }`
      }
    />
  );
}
