'use client';

import {Button, Card, Divider, HStack, Heading, StackItem, Text, TextInput, VStack} from '@astryxdesign/core';
import {useRouter} from 'next/navigation';
import {useState, useTransition} from 'react';
import {uebertragSaveAction} from '@/app/actions';
import {sicher} from '@/lib/aktion';
import {Sinnbild} from './sinnbilder';

export interface UebertragZeile {
  userId: number;
  name: string;
  jahresanspruch: number;
  uebertrag: number;
  genehmigt: number;
  rest: number;
}

/**
 * Der Urlaubsübertrag, je Person und Jahr von Hand gesetzt.
 *
 * Bewusst nicht gerechnet: wie viel Resturlaub ins neue Jahr geht und wann er
 * verfällt, hängt an Dingen, die ein Zeiterfasser nicht weiß — Krankheit,
 * Elternzeit, Betriebsvereinbarung, § 7 Abs. 3 BUrlG. Eine Automatik hier wäre
 * eine Zahl, die richtig aussieht und es nicht ist. Also trägt die Verwaltung
 * ein, was gilt, und die Herleitung daneben zeigt, worauf es sich auswirkt.
 */
export function UebertragPflege({jahr, zeilen}: {jahr: string; zeilen: UebertragZeile[]}) {
  const [offen, setOffen] = useState(false);

  return (
    <VStack gap={2}>
      <HStack justify="between" vAlign="center" gap={3} wrap="wrap">
        <HStack gap={1.5} vAlign="center">
          <Sinnbild sinn="urlaub" groesse="zeile" ton="sekundaer" />
          <Text type="label" color="secondary">
            Urlaubsanspruch {jahr}
          </Text>
        </HStack>
        {/* Das Zeichen bleibt dasselbe wie die Handlung: bearbeiten. Ein nach
            unten zeigender Winkel neben „Zuklappen" sagte das Gegenteil. */}
        <Button
          label={offen ? 'Zuklappen' : 'Übertrag pflegen'}
          variant="secondary"
          size="sm"
          icon={<Sinnbild sinn="bearbeiten" />}
          onClick={() => setOffen(!offen)}
        />
      </HStack>

      {offen && (
        <Card padding={0}>
          <VStack gap={0}>
            <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2}>
              <StackItem size="fill">
                <Text type="label" size="sm" color="secondary">
                  Mitarbeiter
                </Text>
              </StackItem>
              <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
                <Text type="label" size="sm" color="secondary">
                  Anspruch
                </Text>
              </span>
              <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
                <Text type="label" size="sm" color="secondary">
                  Genehmigt
                </Text>
              </span>
              <span style={{inlineSize: 72, flexShrink: 0, textAlign: 'end'}}>
                <Text type="label" size="sm" color="secondary">
                  Frei
                </Text>
              </span>
              <span style={{inlineSize: 168, flexShrink: 0}}>
                <Text type="label" size="sm" color="secondary">
                  Übertrag Vorjahr
                </Text>
              </span>
            </HStack>
            {zeilen.map((z) => (
              <VStack key={z.userId} gap={0}>
                <Divider />
                <UebertragZeileForm jahr={jahr} zeile={z} />
              </VStack>
            ))}
          </VStack>
        </Card>
      )}
    </VStack>
  );
}

function UebertragZeileForm({jahr, zeile}: {jahr: string; zeile: UebertragZeile}) {
  const router = useRouter();
  const [wert, setWert] = useState(String(zeile.uebertrag));
  const [isPending, start] = useTransition();
  const [fehler, setFehler] = useState<string | null>(null);

  const geaendert = wert.trim() !== String(zeile.uebertrag);

  const speichern = () =>
    start(async () => {
      setFehler(null);
      const tage = Number(wert);
      if (!Number.isInteger(tage) || tage < 0) {
        setFehler('Bitte eine ganze Zahl ab 0 angeben.');
        return;
      }
      const {error} = await sicher(uebertragSaveAction)(zeile.userId, jahr, tage);
      if (error) {
        setFehler(error);
        return;
      }
      router.refresh();
    });

  return (
    <HStack gap={4} vAlign="center" paddingInline={4} paddingBlock={2} wrap="wrap">
      <StackItem size="fill">
        <VStack gap={0.5}>
          <Text type="body" size="sm" weight="semibold">
            {zeile.name}
          </Text>
          {fehler && (
            <Text type="supporting" size="sm" color="inherit">
              <span style={{color: 'var(--color-error)'}}>{fehler}</span>
            </Text>
          )}
        </VStack>
      </StackItem>
      <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {zeile.jahresanspruch}
        </Text>
      </span>
      <span style={{inlineSize: 96, flexShrink: 0, textAlign: 'end'}}>
        <Text type="supporting" size="sm" color="secondary" hasTabularNumbers>
          {zeile.genehmigt}
        </Text>
      </span>
      <span style={{inlineSize: 72, flexShrink: 0, textAlign: 'end'}}>
        <Text type="body" size="sm" hasTabularNumbers>
          {zeile.rest}
        </Text>
      </span>
      <HStack gap={2} vAlign="center" width={168} wrap="nowrap">
        <TextInput
          label={`Übertrag für ${zeile.name}`}
          isLabelHidden
          value={wert}
          onChange={setWert}
          width={72}
        />
        {geaendert && (
          <Button
            label="Sichern"
            variant="secondary"
            size="sm"
            isLoading={isPending}
            icon={<Sinnbild sinn="bestaetigen" />}
            onClick={speichern}
          />
        )}
      </HStack>
    </HStack>
  );
}
