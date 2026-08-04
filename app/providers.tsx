'use client';

import {Theme} from '@astryxdesign/core/theme';
import {InternationalizationProvider} from '@astryxdesign/core/i18n';
import {medarbeiterTheme} from '@/theme/medarbeiter';
import de from '@/locales/de.json';
import type {ReactNode} from 'react';

export function Providers({children}: {children: ReactNode}) {
  return (
    <InternationalizationProvider locale="de" messages={{de}}>
      <Theme theme={medarbeiterTheme} mode="light">
        {children}
      </Theme>
    </InternationalizationProvider>
  );
}
