import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@/theme/medarbeiter.css';
import './globals.css';

import type {Metadata} from 'next';
import {Figtree, Poppins} from 'next/font/google';
import type {ReactNode} from 'react';
import {Providers} from './providers';

// Self-hosted via next/font: no runtime requests to Google, no CDN failure
// mode, no employee IPs leaving the house. The theme's font-family tokens
// reference these variables.
const poppins = Poppins({subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-poppins', display: 'swap'});
const figtree = Figtree({subsets: ['latin'], variable: '--font-figtree', display: 'swap'});

export const metadata: Metadata = {
  title: 'MedArbeiter – Zeiterfassung',
  description: 'Arbeitszeiterfassung für MedArbeiter: Einstempeln, Pausen, Überstunden und Monatsabschluss.',
  appleWebApp: {capable: true, title: 'MedArbeiter', statusBarStyle: 'default'},
  icons: {apple: '/apple-touch-icon.png'},
};

export default function RootLayout({children}: {children: ReactNode}) {
  return (
    <html lang="de" className={`${poppins.variable} ${figtree.variable}`}>
      <body>
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<!--
THESIS: The workday itself is the interface: a live stamped day the employee
reads at a glance, refusing the category default of a form beside a stats
grid. Clocking is one glance, one click, from every page.
OWN-WORLD: Astryx components, MedArbeiter theme: white/warm-paper ground,
brand gold #e1b025 as work-segments and primary action, bronze text-gold,
warm stone neutrals, Poppins headings, orange warnings.
STORY: An employee stamps in the persistent clock strip, sees today's total
and the Feierabend prognosis first, the day as a gold-striped band beneath;
Verwaltung scans team rows of the same grammar, corrects inline, locks months
for payroll.
FIRST VIEWPORT: Sticky clock strip on top (status, elapsed, stamp action);
sidebar nav left; center: today's total + prognosis over a compact horizontal
day-strip and the entry rows; right rail: week Soll/Ist strip, Zeitkonto.
FORM: Der gestempelte Tag, horizontal-strip evolution of seed 63a37dc5
(2026-08 hierarchy refactor: 3-second visit first, depth behind tabs).
FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, and DESIGN.md.
-->`,
          }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
