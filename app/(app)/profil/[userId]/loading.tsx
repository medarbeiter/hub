import {KontextGeruest, LadeRahmen, ZeilenGeruest} from '@/components/ladegeruest';

export default function Loading() {
  return <LadeRahmen nav={false} werkzeuge belege={<ZeilenGeruest zeilen={3} />} kontext={<KontextGeruest karten={[132]} />} />;
}
