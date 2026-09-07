import {FormularGeruest, LadeRahmen} from '@/components/ladegeruest';

/** Erweiterung: eine Anleitung — kein Zeitraum, keine Leiste. */
export default function Loading() {
  return <LadeRahmen nav={false} belege={<FormularGeruest />} />;
}
