'use client';

import {Button, HStack, Text, VStack} from '@astryxdesign/core';
import {useState, useTransition} from 'react';
import {protokollPruefenAction} from '@/app/actions';
import {AKTION_FEHLGESCHLAGEN} from '@/lib/aktion';
import {useMelde} from './melde';
import {Sinnbild} from './sinnbilder';

interface Befund {
  geprueft: number;
  heil: boolean;
  ersterBruch: {id: number; ts: string; grund: string} | null;
}

/**
 * Die Nachrechnung der Kette.
 *
 * Bewusst ein Knopf und keine Angabe, die beim Seitenaufbau schon dasteht:
 * geprüft werden alle Zeilen, und das kostet bei Zehntausenden spürbar Zeit.
 * Wichtiger aber — eine Zahl, die immer schon da ist, wird nicht gelesen. Ein
 * Nachweis, den jemand *anstößt*, ist eine Handlung mit einem Ergebnis, und
 * genau so wird er später auch berichtet.
 */
export function KettenPruefung() {
  const [befund, setBefund] = useState<Befund | null>(null);
  const [laeuft, starte] = useTransition();
  const melde = useMelde();

  return (
    <VStack gap={3}>
      <Text type="supporting" color="secondary">
        Jede Zeile trägt den Fingerabdruck ihres Inhalts und den ihrer Vorgängerin. Ändern und Löschen
        weist die Datenbank selbst ab; wer daran vorbei geht, zerreißt die Kette an einer auffindbaren
        Stelle.
      </Text>

      <Button
        label={befund ? 'Erneut prüfen' : 'Kette prüfen'}
        variant="secondary"
        size="sm"
        icon={<Sinnbild sinn={befund ? 'erneut' : 'siegel'} />}
        isLoading={laeuft}
        onClick={() =>
          starte(async () => {
            // Hier gibt es keinen `{error}`, in den das Netz aus `lib/aktion.ts`
            // fallen könnte — und einen Befund zu erfinden, wäre eine Aussage
            // über die Unversehrtheit der Kette, die niemand nachgerechnet
            // hat. Also bleibt der alte Befund stehen und der Fehlschlag wird
            // gesagt: kein Urteil ist besser als ein erfundenes.
            try {
              setBefund(await protokollPruefenAction());
            } catch (fehler) {
              console.error('[MedArbeiter] Kettenprüfung nicht abgeschlossen', fehler);
              melde({ton: 'fehler', titel: AKTION_FEHLGESCHLAGEN, dauerhaft: true});
            }
          })
        }
      />

      {befund && (
        <HStack gap={1.5} vAlign="start" wrap="nowrap">
          <span style={{display: 'flex', paddingBlockStart: 'var(--spacing-0-5)'}}>
            <Sinnbild
              sinn={befund.heil ? 'bestaetigen' : 'warnung'}
              groesse="zeile"
              ton={befund.heil ? 'akzent' : 'fehler'}
            />
          </span>
          <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
            {befund.heil
              ? `${befund.geprueft} ${befund.geprueft === 1 ? 'Zeile' : 'Zeilen'} geprüft, Kette ungebrochen.`
              : `Kette gebrochen bei Zeile ${befund.ersterBruch?.id} (${befund.ersterBruch?.ts}): ${befund.ersterBruch?.grund}`}
          </Text>
        </HStack>
      )}
    </VStack>
  );
}
