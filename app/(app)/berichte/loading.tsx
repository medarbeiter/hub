import {LadeRahmen, TafelGeruest} from '@/components/ladegeruest';

/** Berichte: die Personentafel mit der Ausgabe im Kopf. */
export default function Loading() {
  return <LadeRahmen werkzeuge belege={<TafelGeruest zeilen={7} spalten={5} />} />;
}
