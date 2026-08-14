import {FormularGeruest, KontextGeruest, LadeRahmen} from '@/components/ladegeruest';

/** Profil: die persönlichen Einstellungen als Formular, ohne Zeitraum. */
export default function Loading() {
  return (
    <LadeRahmen nav={false} belege={<FormularGeruest gruppen={2} felder={3} />} kontext={<KontextGeruest />} />
  );
}
