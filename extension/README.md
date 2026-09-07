# MedArbeiter Zugangscodes – Chrome-Erweiterung

Trägt die Einmalcodes aus dem Hub (`/zugangscodes`) auf Anmeldeseiten ein.

## Installieren – und aktuell bleiben

**Chrome traut auf einem Rechner ohne MDM/Domäne keiner lokalen Richtlinie**, die eine Erweiterung von
außerhalb des Web Stores erzwingt – es streicht den Eintrag still (Chromium: `FilterSensitiveExtensionsInstallForcelist`).
Ein manuell installiertes Profil oder eine `.reg` bringt daher nichts. Es bleiben zwei Wege, beide auf **/erweiterung**:

1. **Chrome Web Store, nicht gelistet** – ein Klick je Rechner, der Store hält aktuell. Einmalig: Developer-Konto
   (5 $), `bun scripts/erweiterung-store-zip.ts > medarbeiter-zugangscodes.zip`, hochladen, Sichtbarkeit „Nicht
   gelistet", dann `ERWEITERUNG_STORE_URL` und `ERWEITERUNG_STORE_ID` in die Umgebung des Hubs. Neue Version =
   Versionsnummer erhöhen, ZIP neu hochladen.
2. **Google Admin-Konsole** – Installation erzwingen für alle, kein Klick auf den Rechnern (einer Cloud-Richtlinie
   traut Chrome). Aus dem Store per Kennung, oder ohne Store per Kennung + Update-URL des Hubs: der Hub signiert das
   Paket selbst (`lib/erweiterung.ts`, `/api/erweiterung/update.xml`, Schlüssel in `data/erweiterung-schluessel.txt`).

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
