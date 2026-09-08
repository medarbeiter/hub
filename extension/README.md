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

- **Feld erkennen** – in drei Stufen, damit ein Farbwähler oder eine Postleitzahl nie eins ist: `autocomplete="one-time-code"` oder ein Wort, das nur ein Einmalcode trägt (otp, 2fa, mfa, authenticator, verification, Sicherheitscode, Bestätigungscode, Einmal…), zählt allein. Ein Wort, das dagegen spricht (PLZ, postal, zip, color, hex, IBAN, Gutschein, Datum, CVC, Karte, Suche, Menge, Telefonnummer, Geburt …), schließt aus. Das Schwache – „code", „pin", „token", ein numerisches Feld mit 4–8 Stellen, Gruppen aus 4–8 Ein-Zeichen-Kästchen – zählt nur, wenn die Seite selbst von einem Code, einer Bestätigung oder Anmeldung in zwei Schritten spricht. Auch in Frames und bei später eingeblendeten Feldern (SPA).
- **Pause**: im Popup „Pausieren" → auf dieser Seite aus (dauerhaft, je Domäne), für eine Stunde, bis morgen früh, oder ganz ausschalten; „Fortsetzen" hebt es auf. Die Auswahl am Feld hat dafür „Hier aus". Gespeichert als `pause` in `chrome.storage.local`; solange sie greift, gibt es kein Zeichen, keine Auswahl, keine Frage und keinen Blick auf QR-Codes. Ein ⏸ am Symbol zeigt Aus/Zeitpause.
- **Zuordnen**: der Hub sortiert (`lib/zugangscode-treffer.ts`): gemerkte Seite genau (3) → gleiche Domäne (2) → Dienstname klingt nach der Domäne (1) → Rest (0).
- **Zeichen im Feld**: wie beim Passwortmanager sitzt ein kleines Zeichen am rechten Rand des erkannten Feldes; es bleibt, solange das Feld da ist, und öffnet die Auswahl – auch ohne Hub-Sitzung (dann sagt sie, was fehlt).
- **Eintragen**: genau *ein* Zugang mit Stufe ≥ 2 → wird sofort eingetragen, daneben steht die Auswahl zum Korrigieren. Sonst erscheint die Auswahl am Feld (Vorschläge zuerst, „Alle anzeigen" mit Suche).
- **Absenden**: nach jedem Eintragen drückt sie den Knopf, den ein Mensch jetzt drücken würde – im Formular des Feldes (sonst im nächsten Container mit einem Knopf) der sichtbare, freigegebene Knopf, dessen Beschriftung nach Bestätigen/Weiter/Verify klingt, sonst der Submit-Knopf; ohne Knopf `form.requestSubmit()`, wenn sonst kein Pflichtfeld leer ist. Erst nach 300 ms, und nur, wenn das Feld noch da ist und den Code noch trägt – eine Seite, die bei sechs Ziffern von selbst weiterlädt, wird nicht zweimal abgeschickt.
- **Konto erkennen** (ein Dienst, mehrere Konten – TikTok, Instagram …): unter den Zugängen der Seite gewinnt der, dessen *Konto* (Handle, E-Mail, Name) auf der Seite vorkommt – im Seitentext, in einem Eingabefeld, oder als das, was zuletzt in ein Benutzer-/E-Mail-Feld derselben Domäne getippt wurde (zehn Minuten in `chrome.storage.local`, nie ein Passwort). Genau ein Treffer → eingetragen; in der Auswahl steht er zuerst mit „dieses Konto".
- **Lernen – nie still**: nach jedem Eintragen eines Zugangs, den die Seite nicht genau kannte (Stufe < 3), fragt eine Tafel unten rechts „Diese Seite merken?" mit Ja/Nein – dieselbe helle Tafel wie die Auswahl am Feld und das Popup (`tafel.css`, eine Datei für alle drei). Die Frage liegt in `chrome.storage.local` und überlebt das Weiterladen, das der Code meist auslöst: jede Seite derselben Domäne zeigt sie, bis sie beantwortet ist (zehn Minuten). Ja = `POST /api/zugangscodes` (Protokoll `zugangscode.seite`), beim nächsten Mal Stufe 3. Hat der Dienst weitere Konten, die die Seite noch nicht kennt, stehen sie als Kästchen dabei – eine Frage, mehrere Zugänge. Falsch gemerkte Seiten entfernt man im Hub im Bearbeiten-Dialog (Feld „Seiten").
- **Popup** (Symbolleiste): dieselbe Liste für den offenen Tab; Klick kopiert und trägt ein, wenn die Seite ein Feld hat. „＋" führt zum Anlegen im Hub.
- **Neuen Zugang erkennen**: auf einer Einrichtungsseite („Authenticator-App einrichten") liest sie den QR-Code (jedes quadratische `img`/`canvas`/`svg`, im Hintergrund per `jsqr.js` dekodiert – fremde Bilder holt der Hintergrund mit Host-Berechtigung) oder den Schlüssel als Text (Base32 in Vierergruppen, nur wenn die Seite von 2FA/Authenticator spricht) und zeigt „Zugang im Hub speichern?" mit Dienst und Konto zum Nachbessern. Ja = `POST /api/zugangscodes {otpauth|secret, dienst, konto, host}`: „Nur für mich", Seite sofort gemerkt (Protokoll `zugangscode.anlegen`), und ein Codefeld auf derselben Seite wird gleich befüllt. Nein gilt einen Tag. Nie ohne Hub-Sitzung, nie still.

## Grenzen

- Ohne Hub-Sitzung im Browser passiert auf fremden Seiten nichts (kein Banner); das Popup sagt „Bitte anmelden". Wer sich dann in einem anderen Tab anmeldet, muss die Seite nicht neu laden: `background.js` sieht das Sitzungs-Cookie kommen (`cookies`-Berechtigung) und jede Seite fragt von selbst neu.
- Codes werden nie gespeichert – bei jedem Klick frisch geholt, damit ein gekippter Code nicht eingetragen wird.
- Die Seitenzuordnung ist Anzeigeordnung, keine Freigabe: der Leserkreis eines Zugangs bleibt, was er im Hub ist.
