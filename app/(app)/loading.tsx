import {BahnenGeruest, KontextGeruest, LadeRahmen} from '@/components/ladegeruest';

/**
 * „Meine Zeit", solange die Route lädt — und zugleich der Rückfall für jede
 * Route ohne eigenes Gerüst.
 *
 * Alle vier Bereiche dieser Seite (Tag, Woche, Monat, Konto) zeichnen Bahnen
 * auf einer gemeinsamen Achse, also passt ein Gerüst für alle vier. Die
 * Nachbarseiten haben andere Formen und darum ihr eigenes `loading.tsx`
 * daneben — siehe `components/ladegeruest.tsx`.
 */
export default function Loading() {
  return <LadeRahmen buehne={<BahnenGeruest />} kontext={<KontextGeruest />} />;
}
