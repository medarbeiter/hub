import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MedArbeiter Hub',
    short_name: 'MedArbeiter Hub',
    description: 'Arbeitszeiterfassung für MedArbeiter: Einstempeln, Pausen, Überstunden und Monatsabschluss.',
    // `id` bindet die installierte Anwendung an eine feste Kennung: ohne sie
    // gilt `start_url` als Identität, und eine spätere Änderung daran ergäbe
    // eine zweite Installation neben der ersten.
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    lang: 'de',
    background_color: '#faf8f3',
    theme_color: '#e1b025',
    icons: [
      {src: '/icon-192.png', sizes: '192x192', type: 'image/png'},
      {src: '/icon-512.png', sizes: '512x512', type: 'image/png'},
    ],
  };
}
