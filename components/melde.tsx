'use client';

import {Button, HStack, Text, VStack, useToast} from '@astryxdesign/core';
import {useCallback, type ReactNode} from 'react';
import {Sinnbild, type Sinn} from './sinnbilder';

/**
 * Das eine Tor für jede Meldung im Haus.
 *
 * Vorher trug jede Meldung ihre eigene Farbwahl: der ArbZG-Hinweis und der
 * Stempelfehler standen fest in der Leiste, die Korrekturliste war eine
 * handgebaute Meldung unten rechts, die Ausstempel-Bestätigung eine zweite,
 * unabhängig davon gestylt. Vier Stellen, die dieselbe Frage beantworten
 * mussten — welche Farbe, welches Zeichen, bleibt sie stehen oder geht sie
 * von selbst — und es jedes Mal neu taten. `useMelde` beantwortet sie einmal.
 *
 * Die vier Töne sind die, die das Thema ohnehin führt (`--color-error`,
 * `--color-warning`, `--color-success`, Bronze-Akzent für den neutralen
 * Hinweis) — keine neue Palette, nur ihre konsequente Zuordnung auf Astryx'
 * eigene zwei Meldungsfarben (`info`/`error`). Jede Meldung landet auf der
 * Tinte des Hauses (`app/providers.tsx`, `LayerProvider`), und weil mehrere
 * gleichzeitig stehen können, ist das Stapeln — Astryx' eigenes, siehe
 * `ToastViewport` — der Regelfall, nicht ein Sonderfall, den jede Aufrufstelle
 * selbst lösen müsste.
 *
 * Was frei bleibt: der Inhalt. Eine einfache Meldung bekommt Titel, Text und
 * bis zu einer Handlungsreihe aus dem Baukasten unten (`MeldeInhalt`); eine
 * so eigene wie die Korrekturliste (`attention-toast.tsx`, mit ihrer
 * Tagesliste) reicht ihren eigenen `body` durch und bekommt trotzdem
 * denselben Ton, dieselbe Voreinstellung fürs Stehenbleiben, denselben Ort.
 */
export type MeldeTon = 'fehler' | 'warnung' | 'erfolg' | 'hinweis';

export interface MeldeAktion {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

export interface MeldeOptions {
  ton: MeldeTon;
  /** Ignoriert, wenn `body` gesetzt ist. */
  titel?: string;
  text?: ReactNode;
  aktionen?: MeldeAktion[];
  /** Ersetzt den gebauten Inhalt vollständig — für Meldungen, die mehr als
   *  Titel/Text/Handlung brauchen (die Tagesliste der Korrekturmeldung). */
  body?: ReactNode;
  /**
   * Bleibt stehen, bis sie weggeklickt oder durch dieselbe `uniqueID` ersetzt
   * wird. Voreinstellung: jeder Ton außer `erfolg` bleibt stehen — eine
   * Bestätigung darf gehen, ein Fehler, eine Warnung oder ein Hinweis soll
   * gelesen werden, nicht verpasst.
   */
  dauerhaft?: boolean;
  autoHideDuration?: number;
  /** Dieselbe ID ersetzt eine stehende Meldung an Ort und Stelle statt eine
   *  zweite zu stapeln — für Meldungen, die einen fortlaufenden Zustand
   *  begleiten (den ArbZG-Hinweis der Stempelleiste). */
  uniqueID?: string;
  onHide?: (grund: 'auto' | 'manual') => void;
}

const SINN: Record<MeldeTon, Sinn> = {
  fehler: 'fehler',
  warnung: 'warnung',
  erfolg: 'bestaetigen',
  hinweis: 'hinweis',
};

const ICON_TON: Record<MeldeTon, 'fehler' | 'warnung' | 'erfolg' | 'akzent'> = {
  fehler: 'fehler',
  warnung: 'warnung',
  erfolg: 'erfolg',
  hinweis: 'akzent',
};

/** Astryx kennt nur zwei Meldungsfarben — der Fehler bekommt seine eigene,
 *  alles andere läuft über die neutrale und trägt seinen Ton im Zeichen. */
const TOAST_TYP: Record<MeldeTon, 'info' | 'error'> = {
  fehler: 'error',
  warnung: 'info',
  erfolg: 'info',
  hinweis: 'info',
};

/** Der gebaute Inhalt: Zeichen und Titel, wahlweise Text, wahlweise eine
 *  Handlungsreihe. Dieselbe Kante wie bei „Jetzt korrigieren" in der
 *  Korrekturmeldung — Astryx' getönte `secondary`-Füllung ist auf der Tinte
 *  Weiß bei 10 % und erreicht dort keine 3:1, die Kante schafft es. */
function MeldeInhalt({
  ton,
  titel,
  text,
  aktionen,
}: {
  ton: MeldeTon;
  titel: string;
  text?: ReactNode;
  aktionen?: MeldeAktion[];
}) {
  return (
    <VStack gap={2}>
      <HStack gap={2} vAlign="start" wrap="nowrap">
        <Sinnbild sinn={SINN[ton]} groesse="zeile" ton={ICON_TON[ton]} />
        <Text type="label" weight="medium">
          {titel}
        </Text>
      </HStack>
      {text && (
        <Text type="supporting" color="secondary">
          {text}
        </Text>
      )}
      {aktionen && aktionen.length > 0 && (
        <HStack gap={2} wrap="wrap">
          {aktionen.map((aktion) => (
            <Button
              key={aktion.label}
              label={aktion.label}
              variant="secondary"
              size="sm"
              icon={aktion.icon}
              onClick={aktion.onClick}
              style={{boxShadow: 'inset 0 0 0 1px var(--color-icon-secondary)'}}
            />
          ))}
        </HStack>
      )}
    </VStack>
  );
}

export type MeldeFn = (options: MeldeOptions) => () => void;

export function useMelde(): MeldeFn {
  const showToast = useToast();

  return useCallback(
    (options: MeldeOptions) => {
      const {ton, titel, text, aktionen, body, dauerhaft, autoHideDuration, uniqueID, onHide} = options;
      return showToast({
        type: TOAST_TYP[ton],
        isAutoHide: dauerhaft === undefined ? ton === 'erfolg' : !dauerhaft,
        autoHideDuration,
        uniqueID,
        onHide,
        body: body ?? <MeldeInhalt ton={ton} titel={titel ?? ''} text={text} aktionen={aktionen} />,
      });
    },
    [showToast],
  );
}
