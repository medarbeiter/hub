import {GitterGeruest, KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/**
 * Protokoll: das Dichteband über dem Zeitraum, darunter die Einträge. Der
 * Filter steht über den Zeilen und ist selbst ein Block — er zählt beim
 * Gerüst als erste Zeile mit.
 */
export default function Loading() {
  return (
    <LadeRahmen
      buehne={<GitterGeruest wochen={5} zellhoehe={44} />}
      belege={<ZeilenGeruest zeilen={8} />}
      kontext={<KontextGeruest />}
    />
  );
}
