# MedArbeiter Zugangscodes – Chrome-Erweiterung

Trägt die Einmalcodes aus dem Hub (`/zugangscodes`) auf Anmeldeseiten ein.

## Installieren – und aktuell bleiben

Chrome aktualisiert nur, was es über eine Richtlinie installiert hat. Der Hub liefert darum das signierte Paket
und das Update-Manifest selbst (`lib/erweiterung.ts`, `/api/erweiterung/…`), und die Seite **/erweiterung** im Hub
ist der Einrichtungsweg: sie erkennt das System, gibt die Richtlinie zum Doppelklick (`.mobileconfig` auf dem Mac,
`.reg` auf Windows, JSON auf Linux) und meldet, sobald die Erweiterung antwortet. Für alle auf einmal: der Wert für die
Google Admin-Konsole steht ebenfalls dort. Danach: Chrome neu starten, fertig – jede neue Version
(Versionsnummer in `manifest.json` erhöhen) holt Chrome beim nächsten Abgleich, `background.js` bittet beim Start
und täglich darum und lädt sie sofort.

Voraussetzung im Hub: `ERWEITERUNG_KEY` (einmal `bun scripts/erweiterung-schluessel.ts`, dann in die Umgebung – der
Schlüssel bestimmt die Kennung und darf sich nie ändern) und `APP_URL`.

Zum Entwickeln: `chrome://extensions` → Entwicklermodus → „Entpackte Erweiterung laden" → dieser Ordner. Diese Kopie
aktualisiert sich nicht. Bei einem anderen Hub (lokal `http://localhost:3001`): Erweiterung → Einstellungen.

## Was sie tut

- **Feld erkennen**: `autocomplete="one-time-code"`, numerische Felder mit 4–8 Stellen, Felder deren Name/Label/Placeholder nach Code klingt (otp, 2fa, mfa, verification, Sicherheitscode, Einmal…), und Gruppen aus 4–8 Ein-Zeichen-Kästchen. Auch in Frames und bei später eingeblendeten Feldern (SPA).
- **Zuordnen**: der Hub sortiert (`lib/zugangscode-treffer.ts`): gemerkte Seite genau (3) → gleiche Domäne (2) → Dienstname klingt nach der Domäne (1) → Rest (0).
- **Eintragen**: genau *ein* Zugang mit Stufe ≥ 2 → wird sofort eingetragen, daneben steht die Auswahl zum Korrigieren. Sonst erscheint die Auswahl am Feld (Vorschläge zuerst, „Alle anzeigen" mit Suche).
- **Lernen**: wer in der Auswahl oder im Popup einen Zugang wählt, der für diese Seite noch nicht gemerkt war, ordnet ihn ihr zu (`POST /api/zugangscodes`, Protokoll `zugangscode.seite`). Beim nächsten Mal ist er Stufe 3. Falsch gelernte Seiten entfernt man im Hub im Bearbeiten-Dialog (Feld „Seiten").
- **Popup** (Symbolleiste): dieselbe Liste für den offenen Tab; Klick kopiert und trägt ein, wenn die Seite ein Feld hat.

## Grenzen

- Ohne Hub-Sitzung im Browser passiert auf fremden Seiten nichts (kein Banner); das Popup sagt „Bitte anmelden".
- Codes werden nie gespeichert – bei jedem Klick frisch geholt, damit ein gekippter Code nicht eingetragen wird.
- Die Seitenzuordnung ist Anzeigeordnung, keine Freigabe: der Leserkreis eines Zugangs bleibt, was er im Hub ist.
