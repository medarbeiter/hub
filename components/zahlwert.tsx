'use client';

/**
 * Eine Zahl, die sich ändert.
 *
 * Die Zahlen dieser Anwendung stehen nicht still: die gearbeitete Zeit wächst,
 * während der Tag läuft, der Feierabend rückt näher, der Kontostand kippt beim
 * Blättern von einem Monat in den nächsten. Wird eine solche Zahl einfach
 * ausgetauscht, blinzelt sie — man merkt, dass sich etwas geändert hat, aber
 * nicht, dass sie *dieselbe* Zahl mit einem neuen Wert ist.
 *
 * Deshalb rollt sie: von unten herein, kurz unscharf, mit einem kleinen
 * Einrasten am Ende (siehe `.zahlwert` in globals.css). Der `key` ist der Wert
 * selbst — React hängt das Element bei jedem neuen Wert neu auf, und genau das
 * lässt die Animation wieder von vorn laufen. Bleibt der Wert gleich (der
 * 30-Sekunden-Tick der Uhr trifft dieselbe Minute), passiert nichts.
 *
 * Zum Vorlesen bleibt es ein einziger Textknoten: der Wert wird nicht in
 * Ziffern zerlegt, die eine Sprachausgabe dann einzeln buchstabieren würde.
 */
export function Zahlwert({wert}: {wert: string}) {
  return (
    <span key={wert} className="zahlwert">
      {wert}
    </span>
  );
}
