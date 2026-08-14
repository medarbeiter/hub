import {FormularGeruest, LadeBlatt} from '@/components/ladegeruest';

/**
 * Einstellungen: ein blankes Blatt mit Überschrift und Formular — diese Seite
 * trägt (noch) keinen ZeitRahmen, also trägt ihr Gerüst auch kein Kopfband.
 */
export default function Loading() {
  return (
    <LadeBlatt>
      <FormularGeruest gruppen={3} felder={3} />
    </LadeBlatt>
  );
}
