/**
 * Dieselbe Nachricht als reiner Text.
 *
 * Jede Nachricht geht in beiden Formen hinaus: nicht jeder Client zeigt HTML,
 * manche Empfänger schalten es bewusst ab, und eine Nachricht, die dann leer
 * ankommt, ist keine.
 *
 * Gebaut wird sie aus der **Nutzlast**, nicht aus dem fertigen HTML. Der
 * naheliegende Weg wäre `toPlainText()` aus `@react-email/render` — der ist
 * zweimal verworfen worden, und beide Gründe gehören hierher:
 *
 *   1. **Er las sich falsch.** Aus zwei Tabellenzellen wurde
 *      „MitarbeiterAnna Berger": eine HTML→Text-Umwandlung weiß nicht, dass
 *      links die Beschriftung und rechts der Wert steht. Die Nutzlast weiß es.
 *   2. **Er zog Prettier mit.** `@react-email/render` importiert an oberster
 *      Stelle `prettier/plugins/html`; Turbopack benannte das Modul beim
 *      Externalisieren um und fand es dann nicht wieder — jede Server-Aktion,
 *      die auch nur mittelbar auf `lib/mail.ts` zeigte, endete in der
 *      Entwicklung mit „Failed to load external module". `serverExternalPackages`
 *      verschob den Fehler bloß auf das Renderpaket selbst.
 *
 * Das HTML entsteht jetzt mit `renderToStaticMarkup` aus `react-dom/server`
 * (siehe lib/mail.ts) und der Text hier — zwei Darstellungen einer Nutzlast,
 * dieselbe Teilung, die diese Anwendung überall macht.
 */

import type {MailInhalt} from '../lib/mail-arten';

export interface TextOptionen {
  anrede: string;
  basisUrl: string | null;
  abwaehlbar: boolean;
}

/** Beschriftungen auf gleiche Breite, damit die Angaben als Spalte lesbar bleiben. */
function angabenBlock(angaben: MailInhalt['angaben']): string[] {
  if (angaben.length === 0) return [];
  const breite = Math.max(...angaben.map((a) => a.label.length));
  return angaben.map((a) => `  ${a.label.padEnd(breite)}   ${a.wert}`);
}

export function alsText(inhalt: MailInhalt, {anrede, basisUrl, abwaehlbar}: TextOptionen): string {
  const zeilen: string[] = ['MEDARBEITER HUB', '', inhalt.titel, '='.repeat(inhalt.titel.length), ''];

  zeilen.push(`Hallo ${anrede},`, '', inhalt.vorspann, '');

  const block = angabenBlock(inhalt.angaben);
  if (block.length > 0) zeilen.push(...block, '');

  if (inhalt.hinweis) {
    zeilen.push(`${inhalt.hinweis.titel}:`, `  ${inhalt.hinweis.text}`, '');
  }

  // Ohne APP_URL trägt die Nachricht keinen Weg zurück — ein Link auf
  // localhost wäre schlimmer als keiner (siehe `basisUrl` in lib/mail-buch.ts).
  if (inhalt.ziel && basisUrl) {
    zeilen.push(`${inhalt.ziel.label}: ${basisUrl}${inhalt.ziel.pfad}`, '');
  }

  if (inhalt.nachsatz) zeilen.push(inhalt.nachsatz, '');

  zeilen.push(
    '--',
    'Diese Nachricht kommt automatisch aus dem MedArbeiter Hub, der Zeiterfassung des Hauses.',
  );
  if (abwaehlbar) {
    zeilen.push(
      basisUrl
        ? `Solche Hinweise lassen sich unter ${basisUrl}/profil abbestellen.`
        : 'Solche Hinweise lassen sich unter Profil → Persönliche Einstellungen abbestellen.',
    );
  }

  return zeilen.join('\n');
}
