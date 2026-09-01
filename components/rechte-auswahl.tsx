'use client';

/**
 * Die eine Rechte-Auswahl — gruppiert nach Bereich, nicht mehr nach Stufe.
 *
 * Beide Rechte-Formulare (Rollenbündel in rollen-verwaltung.tsx, Zusatzrechte
 * in user-manager.tsx) zeichnen ihre Haken hierüber: eine CheckboxList je
 * Bereich in der Reihenfolge des ersten Auftretens im Vokabular — eingebaute
 * Bereiche zuerst, die der angebundenen Apps dahinter. Ein Recht ist so dort
 * zu finden, wo es hingehört („medarbeiterAI"), statt irgendwo in einer
 * langen Stufenliste. Die Stufe steht nur noch als Marke an der Zeile, und
 * nur wo sie warnt: „Kritisch" — alles andere sagt die Beschreibung selbst.
 */
import {Badge, CheckboxList, CheckboxListItem} from '@astryxdesign/core';
import type {RechtEintrag} from '@/lib/rechte';

interface RechteAuswahlProps {
  /** Was zur Wahl steht, in Vokabular-Reihenfolge — der Aufrufer hat Fremdes/Gebündeltes bereits aussortiert. */
  eintraege: RechtEintrag[];
  value: string[];
  onChange: (rechte: string[]) => void;
  /** Steht vor jedem Gruppentitel — die Zusatzrechte sagen „Zusätzlich: ". */
  praefix?: string;
}

export function RechteAuswahl({eintraege, value, onChange, praefix = ''}: RechteAuswahlProps) {
  const bereiche: string[] = [];
  for (const eintrag of eintraege) {
    if (!bereiche.includes(eintrag.bereich)) bereiche.push(eintrag.bereich);
  }
  return (
    <>
      {bereiche.map((bereich) => {
        const gruppe = eintraege.filter((eintrag) => eintrag.bereich === bereich);
        const schluessel = new Set(gruppe.map((eintrag) => eintrag.schluessel));
        return (
          <CheckboxList
            key={bereich}
            label={`${praefix}${bereich}`}
            value={value.filter((recht) => schluessel.has(recht))}
            onChange={(values) =>
              onChange([...value.filter((recht) => !schluessel.has(recht)), ...values])
            }
            density="compact"
            hasDividers
          >
            {gruppe.map((eintrag) => (
              <CheckboxListItem
                key={eintrag.schluessel}
                value={eintrag.schluessel}
                label={eintrag.label}
                description={eintrag.beschreibung}
                endContent={eintrag.stufe === 'kritisch' ? <Badge variant="neutral" label="Kritisch" /> : undefined}
              />
            ))}
          </CheckboxList>
        );
      })}
    </>
  );
}
