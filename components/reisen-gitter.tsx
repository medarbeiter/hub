'use client';

import {fmtDateLong, fmtEuro} from '@/lib/format';
import {kalendergitter} from '@/lib/kalendergitter';
import {GitterMarke, Monatsgitter, type GitterZelle} from './monatsgitter';
import type {ReiseAnsicht} from './reise-tafel';
import {Sinnbild} from './sinnbilder';

interface ReisenGitterProps {
  reisen: ReiseAnsicht[];
  monat: string;
  /** Tage ohne Soll — sie tragen den Papiergrund wie überall im Gitter. */
  ruhetage: string[];
  heute: string;
  /** Ein Reisetag im Gitter öffnet seine Reise in der Belegliste darunter. */
  onReise?: (reiseId: number) => void;
  /** Die gerade offene Reise — ihre Tage tragen die Goldwäsche. */
  offeneReise?: number | null;
}

/**
 * Die Reisen eines Monats im Monatsgitter.
 *
 * Auch hier war die Bahn die falsche Form, wenn auch aus einem milderen Grund
 * als beim Teamkalender: null bis vier Reisen im Monat ergaben null bis vier
 * Bahnen über eine volle Blattbreite. Im Gitter trägt jeder Reisetag sein
 * eigenes Satzzeichen — halber Kreis für An- und Abreisetag, voller für den
 * Tag dazwischen — und den Betrag, den er einbringt. Damit steht die Regel,
 * für die es sonst die Karte in der Rail braucht, im Bild selbst.
 */
export function ReisenGitter({
  reisen,
  monat,
  ruhetage,
  heute,
  onReise,
  offeneReise,
}: ReisenGitterProps) {
  const gitter = kalendergitter(monat);
  const ruhe = new Set(ruhetage);

  // Ein Kalendertag gehört höchstens einer Reise: Reisen derselben Person
  // dürfen sich nicht überschneiden (lib/spesen.ts prüft das beim Speichern).
  const proTag = new Map<string, {reise: ReiseAnsicht; satzCent: number; grund: string}>();
  for (const reise of reisen) {
    for (const tag of reise.tage) {
      proTag.set(tag.datum, {reise, satzCent: tag.satzCent, grund: tag.grund});
    }
  }

  const offenerTag =
    offeneReise != null
      ? ([...proTag.entries()].find(([, e]) => e.reise.id === offeneReise)?.[0] ?? null)
      : null;

  const zelle = (datum: string): GitterZelle => {
    const eintrag = proTag.get(datum);
    if (!eintrag) return {beschriftung: `${fmtDateLong(datum)} – keine Reise`};
    const {reise, satzCent, grund} = eintrag;
    const vollerTag = satzCent > 0 && grund.toLowerCase().includes('voll');
    return {
      betont: satzCent > 0,
      beschriftung: `${fmtDateLong(datum)}: ${reise.zweck}, ${grund}, ${fmtEuro(satzCent)}`,
      inhalt: (
        <>
          <GitterMarke
            label={reise.zweck}
            titel={`${reise.zweck}${reise.ziel ? ` · ${reise.ziel}` : ''} · ${grund}`}
            /* Halber und voller Satz als halb bzw. ganz gefüllter Kreis —
               dieselben zwei Zeichen wie in der Herleitungskarte. */
            zeichen={
              <Sinnbild
                sinn={vollerTag ? 'satzVoll' : 'satzHalb'}
                groesse="zeile"
                ton="sekundaer"
                form={vollerTag ? 'voll' : 'umriss'}
              />
            }
            leer={satzCent === 0}
          />
          {satzCent > 0 && (
            <GitterMarke label={fmtEuro(satzCent)} titel={`${grund}: ${fmtEuro(satzCent)}`} />
          )}
        </>
      ),
    };
  };

  return (
    <Monatsgitter
      gitter={gitter}
      ruhetage={ruhe}
      heute={heute >= gitter.alleTage[0]! && heute <= gitter.alleTage.at(-1)! ? heute : null}
      zelle={zelle}
      zellhoehe={70}
      onTag={
        onReise
          ? (datum) => {
              const eintrag = proTag.get(datum);
              if (eintrag) onReise(eintrag.reise.id);
            }
          : undefined
      }
      aktiverTag={offenerTag}
    />
  );
}
