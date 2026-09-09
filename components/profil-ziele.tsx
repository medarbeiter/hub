'use client';

import {Badge, HStack, StackItem, Text, VStack} from '@astryxdesign/core';
import {fmtDateRange, todayISO} from '@/lib/format';
import type {PublicGoal} from '@/lib/ziele';
import {zielStand} from '@/lib/ziele-arten';
import {Sinnbild} from './sinnbilder';

/**
 * Die geteilten Ziele auf einer Personenkarte. Die Liste kommt mit der Karte
 * (`lib/personenkarte.ts`) — ein Abschnitt, der sich selbst nachlüde, käme zu
 * eigener Zeit an und ließe die Karte springen.
 */
export function ProfilZiele({ziele}: {ziele: PublicGoal[]}) {
  const heute = todayISO();

  return (
    <VStack gap={3} padding={4}>
      <HStack gap={1.5} vAlign="center">
        <Sinnbild sinn="ziele" groesse="zeile" ton="sekundaer" />
        <Text type="label" size="sm" color="secondary">
          Geteilte Ziele
        </Text>
      </HStack>
      {ziele.length === 0 ? (
        <Text type="supporting" size="sm" color="secondary">
          Noch kein Ziel geteilt.
        </Text>
      ) : (
        <VStack gap={3}>
          {ziele.map((ziel) => {
            const stand = zielStand(ziel, heute);
            return (
              <HStack key={ziel.id} gap={3} vAlign="start" wrap="nowrap">
                <StackItem size="fill">
                  <VStack gap={0.5}>
                    <HStack gap={1.5} vAlign="center" wrap="nowrap">
                      <Sinnbild sinn={ziel.erreicht ? 'erfolg' : 'ziele'} groesse="zeile" ton="sekundaer" />
                      <Text type="body" weight="semibold">
                        {ziel.titel}
                      </Text>
                    </HStack>
                    <Text type="supporting" size="sm" color="secondary">
                      {fmtDateRange(ziel.von, ziel.bis)} · {ziel.regel}
                    </Text>
                  </VStack>
                </StackItem>
                <Badge variant={stand.variant} label={stand.label} />
              </HStack>
            );
          })}
        </VStack>
      )}
    </VStack>
  );
}
