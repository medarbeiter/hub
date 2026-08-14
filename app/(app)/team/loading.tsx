import {LadeRahmen, TafelGeruest} from '@/components/ladegeruest';

/** Team: eine Zeile je Person mit Ist, Soll und Saldo, unter einer Tagesleiste. */
export default function Loading() {
  return <LadeRahmen werkzeuge belege={<TafelGeruest zeilen={7} spalten={4} />} />;
}
