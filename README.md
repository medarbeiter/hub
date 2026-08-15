# MedArbeiter Hub

Interne Arbeitszeiterfassung für MedArbeiter: Mitarbeiter stempeln sich auf
einer lebendigen Tages-Zeitleiste ein und aus, die Verwaltung prüft, korrigiert
und schließt Monate für die Lohnabrechnung ab.

## Setup

```bash
bun install
bun scripts/seed.ts          # legt das Verwaltungskonto an (Zugangsdaten werden ausgegeben)
bun scripts/seed.ts --demo   # optional: synthetische Demo-Mitarbeiter und -Zeiten
bun run dev                  # http://localhost:3000
```

Die Datenbank liegt unter `data/medarbeiter.db` (SQLite/WAL, wird automatisch
angelegt und migriert). Produktion: `bun run build && bun run start`.

### Adresse

Im Betrieb heißt die Anwendung **hub.med-arbeiter.de**. Diese eine Adresse
steht in `APP_URL` und tut zwei Dinge: sie ist das Ziel der Weiterleitung nach
der Google-Anmeldung und die Basis der Knöpfe in den E-Mails.

**In der Entwicklung bleibt `APP_URL` ungesetzt.** Gesetzt schickte sie den
lokalen OAuth-Rücksprung auf die Produktivadresse, und Links in Testnachrichten
zeigten auf `localhost`. Ohne sie nimmt die Anmeldung den gesehenen Origin, und
eine Nachricht trägt schlicht keinen Knopf — beides richtiger als eine falsche
Adresse.

### Coolify mit Docker Compose

1. In Coolify aus diesem Repository eine **Docker-Compose-Ressource** anlegen
   und `/docker-compose.yml` auswählen.
2. **Raw Compose** deaktiviert lassen. Coolify verwaltet Traefik und TLS; die
   Compose-Datei veröffentlicht deshalb keinen Host-Port.
3. `APP_URL`, `ADMIN_EMAIL`, `ADMIN_NAME` und das geheime/literale
   `ADMIN_PASSWORD` setzen. Enthält das Passwort ein `$`, es in Coolify als
   **Literal** markieren. Google und Resend bleiben optional.
4. Dem Dienst eine Domain auf Container-Port `3000` zuweisen und `APP_URL`
   exakt auf diese HTTPS-Domain setzen.
5. Bereitstellen, auf den gesunden Zustand warten, anmelden und das
   Startpasswort sofort ändern.
6. Das vollständige Volume `medarbeiter-data` sichern. Eine Wiederherstellung
   nur mit einer Anwendungs-Replica und nach dem von Coolify dokumentierten
   Stoppen beziehungsweise Starten durchführen.

Diese SQLite-Bereitstellung muss bei **einer Replica** bleiben.

### Google-Anbindung

Die Anmeldung funktioniert auch über Google (Knopf und One-Tap-Hinweis auf der
Zugangsseite; abgebildet wird auf das verknüpfte Konto, sonst auf die
Firmen-E-Mail). Der Einrichtungsassistent verlangt die Verknüpfung mit einem
Google-Konto, und genehmigte Urlaube sowie gemeldete Abwesenheiten landen
automatisch im Google Kalender der betroffenen Person (Krankmeldungen nur als „Abwesend" — keine
Gesundheitsangabe verlässt das Haus). Dafür braucht die Anwendung einen
OAuth-Client aus der [Google Cloud Console](https://console.cloud.google.com/):

1. Projekt anlegen, **Google Calendar API** aktivieren.
2. OAuth-Zustimmungsbildschirm einrichten (interne Nutzung, Scopes
   `openid email` und `…/auth/calendar.events`).
3. OAuth-Client vom Typ **Webanwendung** anlegen; autorisierte
   Weiterleitungs-URI: `https://hub.med-arbeiter.de/api/google/callback`
   (lokal zusätzlich `http://localhost:3000/api/google/callback`) **und**
   autorisierte JavaScript-Quelle: `https://hub.med-arbeiter.de` (lokal
   zusätzlich `http://localhost:3000`) — ohne die Quelle funktionieren der
   eingebettete Google-Knopf und der One-Tap-Hinweis nicht.
4. Zugangsdaten in `.env` hinterlegen (Bun lädt sie selbst, kein dotenv):

```bash
GOOGLE_CLIENT_ID=…apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=…
# Nur Entwicklung ohne Zugangsdaten: simulierten Verbinden-Knopf freischalten.
# MOCK_GOOGLE_OAUTH=1
```

### E-Mail-Versand

Anträge, Entscheidungen, Monatsabschlüsse und Zugangsdaten gehen zusätzlich per
E-Mail hinaus — über [Resend](https://resend.com), gestaltet mit
[React Email](https://react.email). Wer entscheidet, bekommt die Post: der
Empfängerkreis kommt aus dem Recht (`abwesenheit.pruefen`, `spesen.pruefen`),
nie aus der Rolle. Krankmeldungen heißen auch hier nur „Abwesend" — dieselbe
Regel wie im Google Kalender, aus demselben Grund.

```bash
RESEND_API_KEY=re_…
```

Ohne Schlüssel läuft alles unverändert weiter: es geht nur nichts hinaus,
stattdessen steht jede Nachricht in der Server-Konsole und im Versandbuch als
„übersprungen". Zwei Stellschrauben liegen in der Anwendung selbst:

- **Einstellungen → E-Mail-Benachrichtigungen** (Verwaltung): Versand an/aus,
  Absender, und die letzten fünf Zustellungen mit ihrem Ausgang.
- **Profil → Nachrichten per E-Mail** (jede und jeder): sechs der acht
  Nachrichtenarten lassen sich abbestellen. Zugangspost — Startpasswort und
  zurückgesetztes Kennwort — nicht: sie ist die einzige, die jemanden vor der
  ersten Anmeldung erreicht.

#### Die Absenderdomain

Der Absender ist `MedArbeiter Hub <zeit@hub.med-arbeiter.de>`, und
**hub.med-arbeiter.de ist bei Resend verifiziert** — nachgemessen am
2026-08-10: Resend nimmt Post von dieser Subdomain an und weist
`med-arbeiter.de` mit 403 ab. Es ist also nichts einzurichten; der Versand
läuft.

Dass die Subdomain verifiziert ist und die Hauptdomain nicht, ist die richtige
Aufteilung und keine Lücke: die Zustellbarkeit der Hauspost hängt so nicht
daran, wie sich diese Anwendung verhält. Ein Absender auf `med-arbeiter.de`
wäre folglich auch kein Versehen, das stillschweigend durchginge — er würde
abgewiesen.

Falls die Domain je neu eingerichtet werden muss
([Resend-Dashboard](https://resend.com/domains) → Domains → Add Domain), sind
es drei DNS-Einträge im Zonenfile von `med-arbeiter.de`: ein `MX` und ein `TXT`
(SPF) auf `send.hub`, ein `TXT` (DKIM) auf `resend._domainkey.hub`. Empfohlen,
aber nicht von Resend erzeugt: DMARC auf `_dmarc.hub`
(`v=DMARC1; p=none; rua=mailto:…`) — ohne ihn stellen Gmail und Outlook zu,
sortieren aber strenger.

Weist Resend einen Versand ab, verschwindet das nicht still: die Zeile steht
als **fehlgeschlagen** samt Grund unter Einstellungen → „Zuletzt versendet",
und beim Anlegen eines Kontos sagt der Passwortdialog, dass die Nachricht nicht
hinausging und das Startpasswort persönlich weitergegeben werden muss.

Der API-Schlüssel in `.env` ist ein reiner **Sending-Key** — er kann Domains
weder anlegen noch lesen. Das ist Absicht: was er kann, ist Post verschicken;
was er nicht kann, kann er auch nicht kaputtmachen. Wer den Domänenstatus
sehen will, schaut ins Dashboard.

## Oberflächen

| Route | Wer | Zweck |
|---|---|---|
| `/` (Heute) | alle | Live-Zeitleiste, Ein-/Ausstempeln, Wochenübersicht, Zeitkonto |
| `/zeiten` | alle | Monatshistorie, Tagesdetail, eigene Korrekturen |
| `/team` | Verwaltung | Alle Mitarbeiter als Mini-Zeitleisten, Live-Status, Anomalien |
| `/abschluss` | Verwaltung | Monatsabschluss je Mitarbeiter (sperrt den Monat) |
| `/berichte` | Verwaltung | Monatssummen, Zeitkonten, CSV-Export, Druckansicht (PDF) |
| `/druck/[monat]` | Verwaltung | Druckoptimierter Arbeitszeitnachweis, ein Blatt je Mitarbeiter |

## Grundregeln der Fachlogik

- Segmente (`arbeit`/`pause`) gehören zu genau einem Kalendertag und enden nie
  nach Mitternacht. Ein offenes Segment an einem vergangenen Tag ist ein
  vergessenes Ausstempeln — es wird nie automatisch geschlossen, sondern als
  Warnung angezeigt und manuell korrigiert.
- Das Zeitkonto zählt nur erfasste Tage (Ist − Soll je Tag mit Einträgen).
- Abgeschlossene Monate sind schreibgeschützt; Korrekturen protokollieren, wer
  sie vorgenommen hat.

Weitere Dokumentation: `PRODUCT.md` (Produktwahrheit), `DESIGN.md` (visuelles
System), `CLAUDE.md` (Arbeitsregeln für KI-Sessions).
