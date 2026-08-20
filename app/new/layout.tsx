import type {ReactNode} from 'react';

/**
 * `/new` war als eigenes, HeroUI-basiertes Blatt gedacht, in das die alte
 * Astryx-Welt Route für Route hätte ziehen sollen. Der Plan drehte sich um:
 * die Organisation stellte auf Astryx um, also holt dieses Segment jetzt
 * nach, was `/login` bereits ist — kein eigenes Stilblatt mehr nötig, es
 * trägt dieselbe Astryx-Theming-Kette wie der Rest der Anwendung.
 */
export default function NeuLayout({children}: {children: ReactNode}) {
  return <>{children}</>;
}
