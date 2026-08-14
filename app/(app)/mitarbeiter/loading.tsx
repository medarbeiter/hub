import {LadeRahmen, TafelGeruest} from '@/components/ladegeruest';

/** Mitarbeiter: die Belegschaft als Tafel — ohne Zeitraum, also ohne Leiste. */
export default function Loading() {
  return <LadeRahmen nav={false} werkzeuge belege={<TafelGeruest zeilen={8} spalten={3} />} />;
}
