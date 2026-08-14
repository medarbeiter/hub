import {LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Die Warteschlange der Reisen: Zeilen und die Sammelhandlung im Kopf. */
export default function Loading() {
  return <LadeRahmen werkzeuge belege={<ZeilenGeruest zeilen={5} />} />;
}
