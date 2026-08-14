'use client';

import {Grid, Text, VisuallyHidden, VStack} from '@astryxdesign/core';
import {AVATARE, type AvatarKey} from '@/lib/avatar';
import {TierAvatar} from './tier-avatar';

export function AvatarAuswahl({
  value,
  onChange,
}: {
  value: AvatarKey;
  onChange: (value: AvatarKey) => void;
}) {
  return (
    <fieldset className="avatar-auswahl">
      <legend>
        <VisuallyHidden>Profilfigur wählen</VisuallyHidden>
      </legend>
      <Text type="supporting" color="secondary" as="p">
        Lokal gespeichert. Du kannst sie später im Profil wechseln.
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
              <TierAvatar avatar={option.key} gross />
              <Text type="label" size="sm" weight="medium">{option.label}</Text>
            </VStack>
          </label>
        ))}
      </Grid>
    </fieldset>
  );
}
