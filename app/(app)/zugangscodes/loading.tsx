import {LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Zugangscodes: eine Zeile je Zugang — ohne Zeitraum, also ohne Leiste. */
export default function Loading() {
  return <LadeRahmen nav={false} belege={<ZeilenGeruest zeilen={4} />} />;
}
