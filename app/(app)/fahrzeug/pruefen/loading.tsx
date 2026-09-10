import {KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Dienstfahrzeug: Fälle als aufklappbare Zeilen, keine Bühne. */
export default function Loading() {
  return <LadeRahmen belege={<ZeilenGeruest zeilen={4} />} kontext={<KontextGeruest />} />;
}
