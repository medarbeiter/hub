import {FahrzeugAnsicht} from '@/components/fahrzeug-ansicht';
import {requireRecht} from '@/lib/auth';
import {faelleFor, fallAnsicht, tankbelegAnsicht, tankbelegeFor} from '@/lib/fahrzeug';
import {fmtEuro, todayISO} from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{neu?: string}>;
}

/** Dienstfahrzeug: die eigenen Tank-/Ladebelege und Servicefälle. */
export default async function FahrzeugPage({searchParams}: PageProps) {
  const user = await requireRecht('fahrzeug.erfassen');
  const params = await searchParams;
  const tankbelege = tankbelegeFor(user.id).map((e) => tankbelegAnsicht(e, user));
  const faelle = faelleFor(user.id).map((e) => fallAnsicht(e, user));

  const tankOffen = tankbelege.filter((b) => !b.abgerechnet);
  const faelleOffen = faelle.filter((f) => f.status !== 'abgerechnet');
  const offenCent = tankOffen.reduce((s, b) => s + b.betragCent, 0) + faelleOffen.reduce((s, f) => s + f.summeCent, 0);
  const wartend = tankOffen.length + faelle.filter((f) => f.status === 'geschlossen').length;

  return (
    <FahrzeugAnsicht
      modus="eigen"
      tankbelege={tankbelege}
      faelle={faelle}
      heute={todayISO()}
      neu={params.neu === 'tanken' || params.neu === 'service' ? params.neu : undefined}
      figur={fmtEuro(offenCent)}
      figurEinheit="noch nicht abgerechnet"
      stand={
        tankbelege.length + faelle.length === 0
          ? 'Noch nichts hochgeladen.'
          : `${tankOffen.length} ${tankOffen.length === 1 ? 'Tankbeleg' : 'Tankbelege'} · ${faelleOffen.length} ${
              faelleOffen.length === 1 ? 'Servicefall' : 'Servicefälle'
            } offen${wartend > 0 ? ` · ${wartend} ${wartend === 1 ? 'wartet' : 'warten'} auf die Abrechnung` : ''}`
      }
    />
  );
}
