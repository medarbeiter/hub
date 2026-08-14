'use client';

import Link, {useLinkStatus} from 'next/link';
import type {ComponentProps} from 'react';

/**
 * Der Puls eines angeklickten Verweises.
 *
 * `useLinkStatus` darf nur *unterhalb* eines `<Link>` laufen — es liest den
 * Zustand des Verweises, in dem es steht. Darum ist der Puls ein eigenes,
 * leeres Kind: es trägt nur das Merkmal `data-laedt`, und `:has()` holt es in
 * globals.css an den Anker zurück, der die Bewegung wirklich zeigt (siehe
 * `.link-puls`).
 *
 * Getrennt vom `Verweis` unten, weil einige Verweise ihr `<Link>` nicht selbst
 * bauen: Astryx' `Tab` erzeugt seinen Anker über `as` und reicht keine eigenen
 * Eigenschaften durch — dort wird `LinkPuls` von Hand hineingestellt.
 */
export function LinkPuls() {
  const {pending} = useLinkStatus();
  return <span aria-hidden className="link-puls" data-laedt={pending ? 'true' : 'false'} />;
}

/**
 * Der eine Verweis der Anwendung: ein `next/link`, der sagt, dass er arbeitet.
 *
 * Zwischen Klick und neuem Bild liegt eine Serverantwort. Ohne Rückmeldung ist
 * das für den Benutzer nicht von „nichts passiert" zu unterscheiden, und die
 * übliche Folge ist der zweite Klick. Der Puls schließt genau diese Lücke —
 * bis das Ladegerüst der Zielroute übernimmt.
 *
 * **Jeder Verweis, der die Seite wechselt, geht hierdurch.** Ein blankes
 * `next/link` bleibt nur dort richtig, wo der Klick die Seite gar nicht
 * verlässt (ein Anker auf derselben Seite) oder wo der Browser übernimmt (ein
 * Download aus `/api/beleg/…`).
 *
 * Das Modul ist eine Klientenkomponente, damit auch eine Serverkomponente es
 * einsetzen kann: sie reicht nur Zeichenketten hinein, und die Grenze verläuft
 * dann hier.
 */
export function Verweis(props: ComponentProps<typeof Link>) {
  return (
    <Link {...props}>
      <LinkPuls />
      {props.children}
    </Link>
  );
}
