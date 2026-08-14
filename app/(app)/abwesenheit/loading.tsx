import {GitterGeruest, KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

/** Abwesenheit: das Monatsgitter als Auswahlfläche, darunter die Spannen. */
export default function Loading() {
  return (
    <LadeRahmen buehne={<GitterGeruest />} belege={<ZeilenGeruest zeilen={4} />} kontext={<KontextGeruest />} />
  );
}
