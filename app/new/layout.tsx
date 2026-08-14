import './neu.css';

import type {ReactNode} from 'react';

/**
 * Das neue Blatt. Eigenes Segment, eigenes Stilblatt — die alte Astryx-Welt
 * unter `/` bleibt unverändert, bis sie Route für Route hierher zieht.
 *
 * Kein `I18nProvider`: HeroUI bringt in diesem Ablauf keine eingebaute
 * Zeichenkette an die Oberfläche. Sobald eine erscheint, kommt er als
 * Client-Hülle hierher — er ist ein Client-Bauteil und darf hier nicht direkt
 * stehen.
 */
export default function NeuLayout({children}: {children: ReactNode}) {
  return <div className="neu-wurzel">{children}</div>;
}
