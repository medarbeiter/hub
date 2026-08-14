import {Text} from '@astryxdesign/core';
import {Verweis as Link} from './verweis';
import {fmtWeekdayShort} from '@/lib/format';

interface TagesVerweisProps {
  datum: string;
  breite: number;
  istHeute: boolean;
  istZukunft: boolean;
}

/**
 * Das Datum in der Bahnspalte als Weg zur Abwesenheit dieses Tages.
 *
 * Bis zum Umbau war das eine Ziehfläche (`tage-waehler.tsx`): über mehrere
 * Datumsfelder gezogen entstand eine Spanne. Das war die Notlösung für ein
 * echtes Problem — auf der Bahn daneben wohnt bereits das Ziehen über freie
 * Strecke, das einen Eintrag anlegt, und zwei Ziehgesten auf einer Fläche
 * hätten bei leicht schrägem Zug zwischen „vier Stunden erfasst" und „eine
 * Woche Urlaub beantragt" entschieden.
 *
 * Seit das Monatsgitter auf `/abwesenheit` die Auswahl trägt, ist die Notlösung
 * überflüssig: die Geste sitzt dort auf Kalendertagen, wo sie nichts anderes
 * heißen kann, und Anzeige und Eingabefläche sind dasselbe Objekt. Hier bleibt
 * die Abkürzung für den einzelnen Tag — ein Verweis, den auch eine Tastatur
 * und ein Telefon ohne Weiteres nehmen.
 */
export function TagesVerweis({datum, breite, istHeute, istZukunft}: TagesVerweisProps) {
  return (
    <Link
      href={`/abwesenheit?${new URLSearchParams({von: datum, bis: datum}).toString()}`}
      className="tagesgriff"
      aria-label={`Abwesenheit am ${fmtWeekdayShort(datum)}, ${Number(datum.slice(8))}. erfassen`}
      style={{inlineSize: breite, flexShrink: 0}}
    >
      <Text
        type="label"
        size="sm"
        color={istHeute ? 'accent' : istZukunft ? 'disabled' : 'secondary'}
        weight={istHeute ? 'semibold' : 'normal'}
        hasTabularNumbers
      >
        {fmtWeekdayShort(datum)} {Number(datum.slice(8))}.
      </Text>
    </Link>
  );
}
