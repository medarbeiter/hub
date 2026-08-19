'use client';

import {Banner, Button, HStack, StackItem, Text, TextArea, VStack} from '@astryxdesign/core';
import {useCallback, useEffect, useState, useTransition} from 'react';
import {profilKommentarAction, profilKommentarLoeschenAction} from '@/app/actions';
import type {ProfilKommentar} from '@/lib/profil-kommentare';
import {PersonZeichen} from './person-zeichen';
import {Sinnbild} from './sinnbilder';

/**
 * Die Kommentare unter einer Personenkarte — „schönes Bild!" und die Antwort
 * darauf, mehr ist hier nicht vorgesehen.
 *
 * ## Geholt, nicht mitgeschleppt
 *
 * Dieselbe Regel wie bei der Karte selbst: eine Liste, die Gesichter zeigt,
 * schickt keine Wortmeldungen mit, die niemand liest. Geladen wird beim
 * Öffnen — und danach nach jeder eigenen Handlung erneut, weil das Ergebnis
 * einer Handlung die einzige Stelle ist, an der die Liste veralten kann. Die
 * Adresse gibt bewusst nichts zwischenzuspeichern (`no-store`), sonst stünde
 * der eigene, gerade abgeschickte Satz fünf Minuten lang nicht da.
 *
 * ## Was der Browser nicht entscheidet
 *
 * Ob geschrieben und ob gelöscht werden darf, sagt der Server je Antwort und
 * je Zeile (`darfSchreiben`, `darfLoeschen`); hier wird es nur gezeichnet. Die
 * Aktionen prüfen es ein zweites Mal — ein ausgeblendeter Knopf ist keine
 * Grenze.
 */
interface Antwort {
  darfSchreiben: boolean;
  eintraege: ProfilKommentar[];
}

export function ProfilKommentare({personId, isOpen}: {personId: number; isOpen: boolean}) {
  const [stand, setStand] = useState<Antwort | null>(null);
  const [text, setText] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [isPending, start] = useTransition();

  const laden = useCallback(
    (signal?: AbortSignal) =>
      fetch(`/api/person/${personId}/kommentare`, {signal})
        .then((antwort) => (antwort.ok ? antwort.json() : null))
        .then((daten: Antwort | null) => daten && setStand(daten))
        .catch(() => {}),
    [personId],
  );

  useEffect(() => {
    // Kein echtes Konto (die Anmeldeseite kennt eine Person mit der Kennung 0),
    // also auch niemand, an dessen Karte etwas stehen könnte.
    if (!isOpen || personId <= 0) return;
    const abbruch = new AbortController();
    laden(abbruch.signal);
    return () => abbruch.abort();
  }, [isOpen, personId, laden]);

  const handeln = (tun: () => Promise<{error: string | null}>) =>
    start(async () => {
      setFehler(null);
      const {error} = await tun();
      if (error) {
        setFehler(error);
        return;
      }
      await laden();
    });

  const senden = () =>
    handeln(async () => {
      const ergebnis = await profilKommentarAction(personId, text);
      if (!ergebnis.error) setText('');
      return ergebnis;
    });

  if (!stand) return null;

  return (
    <VStack gap={3} padding={4}>
      <HStack gap={1.5} vAlign="center">
        <Sinnbild sinn="kommentar" groesse="zeile" ton="sekundaer" />
        <Text type="label" size="sm" color="secondary">
          Kommentare
        </Text>
      </HStack>

      {/* Der Fehler steht am Feld, nicht in der Ecke des Bildschirms: er
          gehört zu dem, was hier gerade getippt wurde. */}
      {fehler && <Banner status="error" title={fehler} />}

      {stand.darfSchreiben && (
        <VStack gap={1.5}>
          <TextArea
            label="Kommentar"
            isLabelHidden
            placeholder="Etwas dazuschreiben…"
            rows={2}
            value={text}
            onChange={setText}
          />
          <HStack justify="end">
            <Button
              label="Kommentieren"
              variant="primary"
              isDisabled={!text.trim()}
              isLoading={isPending}
              onClick={senden}
            />
          </HStack>
        </VStack>
      )}

      {stand.eintraege.length === 0 ? (
        <Text type="supporting" size="sm" color="secondary">
          Noch nichts geschrieben.
        </Text>
      ) : (
        <VStack gap={3}>
          {stand.eintraege.map((k) => (
            <VStack key={k.id} gap={1}>
              <HStack gap={2} vAlign="center" wrap="nowrap">
                {/* Ein Gesicht ist auch hier ein Gesicht: Sprechblase beim
                    Zeigen, Karte beim Klicken, wie überall im Haus. Wer einen
                    Satz liest, will wissen, wer ihn geschrieben hat, und darf
                    dafür nicht erst die Karte schließen und suchen gehen. Die
                    zweite Karte legt sich als eigener Dialog darüber; Escape
                    schließt immer die oberste.

                    Nur die Person, auf deren Karte wir stehen, öffnet keine —
                    dieselbe Regel wie beim großen Bild darüber: sie ist schon
                    die Antwort auf die Frage, mit der jemand hier gelandet
                    ist. */}
                <PersonZeichen
                  person={k.autor}
                  ersatzName={k.autorName}
                  groesse="zeile"
                  mitName
                  karte={k.autor?.id !== personId}
                />
                <StackItem size="fill">
                  <Text type="supporting" size="sm" color="secondary">
                    {k.zeit}
                  </Text>
                </StackItem>
                {k.darfLoeschen && (
                  <Button
                    label="Kommentar löschen"
                    variant="ghost"
                    size="sm"
                    isIconOnly
                    icon={<Sinnbild sinn="entfernen" />}
                    isLoading={isPending}
                    onClick={() => handeln(() => profilKommentarLoeschenAction(k.id))}
                  />
                )}
              </HStack>
              <Text type="body">{k.text}</Text>
            </VStack>
          ))}
        </VStack>
      )}
    </VStack>
  );
}
