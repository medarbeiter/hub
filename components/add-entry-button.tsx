'use client';

import {Button} from '@astryxdesign/core';
import {Sinnbild} from './sinnbilder';

/** The one appearance of "Eintrag hinzufügen", identical on every surface. */
export function AddEntryButton({onClick}: {onClick: () => void}) {
  return (
    <Button
      label="Eintrag hinzufügen"
      variant="secondary"
      size="sm"
      icon={<Sinnbild sinn="hinzufuegen" />}
      onClick={onClick}
    />
  );
}
