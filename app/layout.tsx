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
THESIS: The workday itself is the interface: a live day-timeline the employee
stamps onto, refusing the category default of a form beside a stats grid.
Clocking is one glance, one click.
OWN-WORLD: Astryx components, MedArbeiter theme: white/warm-paper ground,
brand gold #e1b025 as work-segments and primary action, bronze text-gold,
warm stone neutrals, Poppins headings, orange warnings.
STORY: An employee sees their day as segments, stamps in or out with the one
state-coupled button, trusts the record; Verwaltung scans team rows of the
same timelines, corrects inline, locks months for payroll.
FIRST VIEWPORT: Sidebar nav left; center: today's vertical timeline with
growing gold segment; right rail: state card with primary stamp action, week
Soll/Ist strip, Zeitkonto.
FORM: Tages-Timeline, candidate 3 of 7, seed 63a37dc5.
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
