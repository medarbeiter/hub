'use client';

import {Button, HStack, Text} from '@astryxdesign/core';

export function PrintToolbar() {
  return (
    <div
      className="druck-toolbar"
      style={{
        position: 'sticky',
        top: 0,
        background: 'var(--color-background-body)',
        borderBottom: 'var(--border-width) solid var(--color-border)',
        padding: 'var(--spacing-3) var(--spacing-5)',
      }}
    >
      <HStack justify="between" vAlign="center" gap={3}>
        <Text type="supporting" color="secondary">
          Druckansicht – über „Drucken" als PDF speichern (ein Blatt je Mitarbeiter).
        </Text>
        <Button label="Drucken / Als PDF speichern" variant="primary" size="sm" onClick={() => window.print()} />
      </HStack>
    </div>
  );
}
