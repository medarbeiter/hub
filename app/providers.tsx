'use client';

import {LayerProvider} from '@astryxdesign/core';
import {Theme} from '@astryxdesign/core/theme';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import {medarbeiterTheme} from '@/theme/medarbeiter';
import de from '@/locales/de.json';
import type {ReactNode} from 'react';

/**
 * `LayerProvider` hält den Ort, an dem Meldungen erscheinen — und er steht hier
 * mit Absicht *innerhalb* von Sprache und Thema.
 *
 * `useToast` würde sich seinen Ort sonst selbst schaffen: eine eigene
 * React-Wurzel neben dem `<body>`, außerhalb dieses Baums. Dort gäbe es weder
 * den deutschen Katalog (der Schließen-Knopf hieße „Dismiss notification") noch
 * das Thema. Ein Anbieter an dieser Stelle kostet nichts und behebt beides.
 *
 * Unten rechts, nicht oben: oben steht die Stempelleiste, und eine Meldung darf
 * nicht über der Handlung liegen, zu der sie rät.
 */
export function Providers({children}: {children: ReactNode}) {
  return (
    <InternationalizationProvider locale="de" messages={{de}}>
      <Theme theme={medarbeiterTheme} mode="light">
        <LayerProvider toast={{position: 'bottomEnd', maxVisible: 3}}>{children}</LayerProvider>
      </Theme>
    </InternationalizationProvider>
  );
}
