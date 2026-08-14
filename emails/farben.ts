/**
 * Die Hausfarben, für den Posteingang eingefroren.
 *
 * Überall sonst gilt „Tokens statt Hex" — hier nicht, und zwar nicht aus
 * Bequemlichkeit: eine E-Mail hat kein `:root`. Outlook rendert über Word,
 * viele Clients streichen `<style>` heraus, und eine `var(--color-accent)`
 * käme als leere Deklaration an, also als *keine* Farbe. Was in einer
 * Nachricht farbig sein soll, muss als Hex im `style`-Attribut stehen.
 *
 * Die Werte sind wörtliche Kopien aus `theme/medarbeiterTheme.ts` (heller
 * Modus, den die Anwendung ohnehin erzwingt). Damit die Kopie nicht
 * auseinanderläuft, prüft `tests/kontrast.test.ts` beide Seiten gegen
 * dieselben Zahlen — driftet ein Token, fällt der Test hier mit.
 */
export const MAILFARBEN = {
  /** Markengold: der Kopfbalken und der Knopf. Trägt nie Text in Schriftgröße. */
  gold: '#e1b025',
  /** Die dunkle Tinte auf Gold — nie Weiß, dieselbe Regel wie in der Anwendung. */
  aufGold: '#231a02',
  /** Bronze: Gold auf Textgröße heruntergestuft. Links und Betonungen. */
  bronze: '#7c5f05',
  /** Goldwäsche: die Fläche unter einem Hinweis. */
  goldWaesche: '#f7edd2',

  ink: '#1c1917',
  stein: '#67625a',
  papier: '#faf8f3',
  weiss: '#ffffff',
  pergament: '#f5f2ea',
  kante: '#d8d2c6',

  /* Je Status zwei Werte, wie im ganzen Haus: die **Füllung** identifiziert
     (Streifen, Punkt, Abzeichen), die **Tinte** ist dieselbe Bedeutung auf
     Textgröße heruntergestuft, weil die Füllung als Schrift die 4,5:1 nicht
     schafft. Dieselbe Abstufung wie beim Gold (Fläche #e1b025, Text #7c5f05). */
  erfolgFuellung: '#198100',
  erfolg: '#007004',
  erfolgWaesche: '#c5e5c0',
  warnungFuellung: '#dd7200',
  warnung: '#6e3500',
  warnungWaesche: '#fad0b5',
  fehlerFuellung: '#e33f4a',
  fehler: '#a50c25',
  fehlerWaesche: '#facecb',
} as const;

/**
 * Die Streifenfarbe über dem Kopf und die Fläche eines Hinweises, je Ton —
 * dieselbe Zuordnung, die `components/melde.tsx` für die Meldung im Fenster
 * trifft. Eine genehmigte Reise ist im Posteingang so grün wie am Bildschirm.
 */
export const TON_FARBEN = {
  hinweis: {streifen: MAILFARBEN.gold, flaeche: MAILFARBEN.goldWaesche, tinte: MAILFARBEN.bronze},
  erfolg: {streifen: MAILFARBEN.erfolgFuellung, flaeche: MAILFARBEN.erfolgWaesche, tinte: MAILFARBEN.erfolg},
  warnung: {streifen: MAILFARBEN.warnungFuellung, flaeche: MAILFARBEN.warnungWaesche, tinte: MAILFARBEN.warnung},
  fehler: {streifen: MAILFARBEN.fehlerFuellung, flaeche: MAILFARBEN.fehlerWaesche, tinte: MAILFARBEN.fehler},
} as const;
