import {GitterGeruest, KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Teamkalender: das Monatsgitter mit einer Spur je Person, darunter die Wege. */
export default function Loading() {
  return (
    <LadeRahmen
      buehne={<GitterGeruest zellhoehe={78} />}
      belege={<ZeilenGeruest zeilen={4} />}
      kontext={<KontextGeruest />}
    />
  );
}
