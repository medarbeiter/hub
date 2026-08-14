import {LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Verbundene Apps: eine Zeile je Anbindung — ohne Zeitraum, also ohne Leiste. */
export default function Loading() {
  return <LadeRahmen nav={false} belege={<ZeilenGeruest zeilen={3} />} />;
}
