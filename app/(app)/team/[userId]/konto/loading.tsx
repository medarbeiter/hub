import {BahnenGeruest, LadeBlatt} from '@/components/ladegeruest';

/** Das Zeitkonto eines Mitarbeiters: Rückverweis, Saldo, dann die Rechnung. */
export default function Loading() {
  return (
    <LadeBlatt zurueck figur>
      <BahnenGeruest anzahl={6} />
    </LadeBlatt>
  );
}
