'use client';

import {Button} from '@astryxdesign/core';
import {Plus} from 'lucide-react';

/** The one appearance of "Eintrag hinzufügen", identical on every surface. */
export function AddEntryButton({onClick}: {onClick: () => void}) {
  return (
    <Button
      label="Eintrag hinzufügen"
      variant="secondary"
      size="sm"
      icon={<Plus size={16} strokeWidth={2} aria-hidden />}
      onClick={onClick}
    />
  );
}
