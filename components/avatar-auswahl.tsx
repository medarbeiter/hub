'use client';

import {Avatar, Button, Grid, Text, VisuallyHidden, VStack} from '@astryxdesign/core';
import {useState} from 'react';
import {AVATARE, type AvatarKey} from '@/lib/avatar';

export function AvatarAuswahl({
  value,
  onChange,
  hatBild = false,
}: {
  value: AvatarKey;
  onChange: (value: AvatarKey) => void;
  hatBild?: boolean;
}) {
  // Mit eigenem Foto ist die Figur nur noch der Rückfall — der Bogen tritt
  // zurück, statt neben dem Bild eine zweite Wahl vorzutäuschen. Wer den
  // Rückfall trotzdem ändern will, klappt ihn auf.
  const [aufgeklappt, setAufgeklappt] = useState(false);
  if (hatBild && !aufgeklappt) {
    return (
      <fieldset className="avatar-auswahl">
        <legend>
          <VisuallyHidden>Profilfigur wählen</VisuallyHidden>
        </legend>
        <Text type="supporting" color="secondary" as="p">
          Dein hochgeladenes Bild ersetzt die Tierfigur. Sie bleibt als Rückfall gespeichert und
          erscheint erst wieder, wenn du das Bild entfernst.
        </Text>
        <Button
          label="Rückfall-Figur ändern"
          variant="secondary"
          onClick={() => setAufgeklappt(true)}
        />
      </fieldset>
    );
  }
  return (
    <fieldset className="avatar-auswahl">
      <legend>
        <VisuallyHidden>Profilfigur wählen</VisuallyHidden>
      </legend>
      <Text type="supporting" color="secondary" as="p">
        {hatBild
          ? 'Diese Figur erscheint nur, wenn du dein hochgeladenes Bild entfernst.'
          : 'Lokal gespeichert. Du kannst sie später im Profil wechseln.'}
      </Text>
      <Grid columns={{minWidth: 104, max: 5, repeat: 'fit'}} gap={2} width="100%">
        {AVATARE.map((option) => (
          <label className="avatar-option" key={option.key}>
            <input
              type="radio"
              name="avatar-wahl"
              value={option.key}
              checked={value === option.key}
              onChange={() => onChange(option.key)}
            />
            <VStack gap={1} align="center">
              {/* Kein Personenzeichen: hier steht eine Figur zur Wahl, kein Mensch.
                  Die Beschriftung darunter sagt schon, was es ist. */}
              <Avatar size={60} src={option.bild} alt="" tooltip={false} />
              <Text type="label" size="sm" weight="medium">{option.label}</Text>
            </VStack>
          </label>
        ))}
      </Grid>
    </fieldset>
  );
}
