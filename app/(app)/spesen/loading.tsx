import {GitterGeruest, KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Reisen & Spesen: das Monatsgitter der Reisetage, darunter die Reisen. */
export default function Loading() {
  return (
    <LadeRahmen buehne={<GitterGeruest />} belege={<ZeilenGeruest zeilen={4} />} kontext={<KontextGeruest />} />
  );
}
