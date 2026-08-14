import {LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Die Warteschlange: eine Zeile je Antrag, aufklappbar. Kein Zeitraum, nur Reiter. */
export default function Loading() {
  return <LadeRahmen belege={<ZeilenGeruest zeilen={5} />} />;
}
