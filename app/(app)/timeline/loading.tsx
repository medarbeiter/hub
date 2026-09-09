import {KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

export default function Loading() {
  return <LadeRahmen werkzeuge belege={<ZeilenGeruest zeilen={8} />} kontext={<KontextGeruest />} />;
}
