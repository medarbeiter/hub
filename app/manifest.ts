import type {MetadataRoute} from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MedArbeiter Zeiterfassung',
    short_name: 'MedArbeiter',
    description: 'Arbeitszeiterfassung für MedArbeiter: Einstempeln, Pausen, Überstunden und Monatsabschluss.',
    start_url: '/',
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
