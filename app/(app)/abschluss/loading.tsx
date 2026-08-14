import {LadeRahmen, TafelGeruest} from '@/components/ladegeruest';

/** Monatsabschluss: dieselbe Personentafel, plus die Sammelhandlung im Kopf. */
export default function Loading() {
  return <LadeRahmen werkzeuge belege={<TafelGeruest zeilen={7} spalten={4} />} />;
}
