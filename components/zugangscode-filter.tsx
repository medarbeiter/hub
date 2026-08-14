'use client';

import {Button, HStack, Selector, TextInput} from '@astryxdesign/core';
import {useRouter, useSearchParams} from 'next/navigation';
import {useEffect, useState, useTransition} from 'react';
import {Sinnbild, umriss} from './sinnbilder';

interface ZugangscodeFilterProps {
  /** Alle Dienste, ungefiltert — eine gewählte Auswahl darf die Liste nicht leeren. */
  dienste: string[];
}

/**
 * Suche und Dienst-Auswahl über den Zugangscodes. Dieselbe Regel wie bei der
 * Protokoll-Filterleiste: geschrieben wird ausschließlich in die Adresse,
 * eigener Zustand ist nur das Suchfeld bis zum Abschicken. So überlebt der
 * Filter das Neuladen und die halbminütliche Erneuerung der Codes
 * (`router.refresh()` behält die Adresse) — und „such mal nach dem
 * Shop-Konto" ist ein Verweis, kein Klickweg.
 */
export function ZugangscodeFilter({dienste}: ZugangscodeFilterProps) {
  const router = useRouter();
  const params = useSearchParams();
  const [laeuft, starte] = useTransition();
  const [suche, setSuche] = useState(params.get('suche') ?? '');

  // Kommt die Seite mit einer anderen Adresse zurück (Zurück-Knopf), zieht
  // das Feld mit.
  useEffect(() => {
    setSuche(params.get('suche') ?? '');
  }, [params]);

  const setze = (aenderungen: Record<string, string | null>) => {
    const naechste = new URLSearchParams(params.toString());
    for (const [schluessel, wert] of Object.entries(aenderungen)) {
      if (wert === null || wert === '') naechste.delete(schluessel);
      else naechste.set(schluessel, wert);
    }
    starte(() => router.push(`/zugangscodes?${naechste.toString()}`));
  };

  const hatFilter = params.get('suche') !== null || params.get('dienst') !== null;

  return (
    <HStack gap={2} vAlign="end" wrap="wrap">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setze({suche});
        }}
      >
        <TextInput
          label="Suche"
          isLabelHidden
          placeholder="Dienst oder Konto …"
          value={suche}
          onChange={setSuche}
          size="sm"
          width={216}
          startIcon={umriss('suchen')}
          hasClear
        />
      </form>

      <Selector
        label="Dienst"
        isLabelHidden
        size="sm"
        width={168}
        placeholder="Alle Dienste"
        hasClear
        value={params.get('dienst')}
        options={dienste.map((d) => ({value: d, label: d}))}
        onChange={(v) => setze({dienst: v})}
      />

      {hatFilter && (
        <Button
          label="Filter zurücksetzen"
          variant="ghost"
          size="sm"
          icon={<Sinnbild sinn="erneut" />}
          isLoading={laeuft}
          onClick={() => starte(() => router.push('/zugangscodes'))}
        />
      )}
    </HStack>
  );
}
