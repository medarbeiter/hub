# Coolify-/Docker-Betrieb: Entwurf

## Ziel

Der MedArbeiter Hub lässt sich in Coolify aus dem Repository als Docker-
Compose-Anwendung installieren. Die Installation fragt alle nötigen Werte ab,
legt beim ersten Start genau ein Verwaltungskonto an, bewahrt sämtliche
Betriebsdaten über Deployments hinweg und wird erst dann von Traefik bedient,
wenn Anwendung und SQLite-Datenbank bereit sind.

## Gewählter Ansatz

Die Anwendung läuft als ein einzelner Container, gebaut mit einem mehrstufigen
Bun-Dockerfile. `docker-compose.yml` ist der Installationsvertrag für Coolify:
Es beschreibt Build, Laufzeitvariablen, Port, Healthcheck und ein benanntes
Volume. Es gibt keinen zweiten Initialisierungsdienst, keine eigene Datenbank
und keine handgeschriebenen Traefik-Router.

Coolify liest die Compose-Datei, hängt seinen verwalteten Traefik-Proxy an das
automatisch erzeugte Netz und ordnet der Anwendung eine Domain für Container-
Port 3000 zu. Die Compose-Datei veröffentlicht deshalb keinen Host-Port, setzt
keinen festen Containernamen und definiert kein eigenes Netz. Das bewahrt
Coolifys Domainverwaltung und Rolling-Update-Verhalten.

## Container-Abbild

Das Dockerfile verwendet offizielle, auf eine Bun-Version festgelegte Images
und drei Stufen:

1. Abhängigkeiten werden mit `bun install --frozen-lockfile` reproduzierbar
   installiert.
2. Next.js wird mit `output: "standalone"` gebaut.
3. Das Laufzeit-Abbild enthält nur Standalone-Ausgabe, statische Dateien,
   öffentliche Dateien und den kleinen Start-/Bootstrap-Pfad.

Der Server lauscht auf `0.0.0.0:3000`, läuft als unprivilegierter Benutzer und
schreibt ausschließlich nach `/app/data`. Eine `.dockerignore` hält lokale
Umgebungsdateien, Daten, Build-Ausgaben, Git-Metadaten und Entwicklungsreste
aus dem Build-Kontext und dem Abbild.

## Persistente Daten

Ein benanntes Compose-Volume wird nach `/app/data` eingehängt. Es umfasst als
eine Sicherungseinheit:

- `medarbeiter.db` einschließlich SQLite-WAL-/SHM-Dateien,
- Belege unter `data/belege/`,
- Arbeitsunfähigkeitsnachweise unter `data/au/`,
- alle künftigen Dateien unterhalb des vorhandenen `data/`-Vertrags.

Die Anwendung bleibt auf genau eine Replik beschränkt. SQLite/WAL und lokale
Dateien werden nicht zwischen gleichzeitig schreibenden Containern geteilt.
Backups sichern das gesamte Volume in einem konsistenten Zustand, nicht nur
die Hauptdatei der Datenbank.

## Umgebungsvariablen

Compose verwendet `${VAR:?}` für Pflichtwerte, damit Coolify sie in der
Oberfläche hervorhebt und einen unvollständigen Start verhindert.

Pflichtwerte:

- `APP_URL`: öffentliche Basisadresse ohne abschließenden Slash, im Betrieb
  eine absolute HTTPS-URL. Für lokale Containerprüfung ist HTTP ausschließlich
  auf `localhost` zulässig.
- `ADMIN_EMAIL`: gültige E-Mail-Adresse des ersten Verwaltungskontos.
- `ADMIN_NAME`: nicht leerer Anzeigename.
- `ADMIN_PASSWORD`: mindestens 12 Zeichen sowie mindestens ein Buchstabe und
  eine Zahl; als Coolify-Secret/Literal zu speichern.

Optionale Werte:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`

Feste Laufzeitwerte sind `NODE_ENV=production`, `HOSTNAME=0.0.0.0` und
`PORT=3000`. `MOCK_GOOGLE_OAUTH` wird nicht in den Produktionsvertrag
aufgenommen.

## Erststart und Migrationen

Vor dem Next.js-Server führt der Container einen Bun-Startpfad aus. Dieser
öffnet die vorhandene Datenbank über `getDb()` und führt damit die bestehenden,
append-only Migrationen aus. Danach prüft er die Bootstrap-Werte und die Zahl
der vorhandenen Benutzer.

Ist die Tabelle `users` leer, wird innerhalb einer Transaktion genau ein
aktives Konto mit Rolle `verwaltung`, 40 Wochenstunden und dem gehashten
Startpasswort angelegt. `must_change_password` wird gesetzt, damit der normale
erste Login das persönliche Passwort verlangt. Ist bereits mindestens ein
Benutzer vorhanden, verändert der Bootstrap keinerlei Konto- oder
Passwortdaten. Ein Neustart oder Deployment ist damit idempotent.

Fehlende oder ungültige Pflichtwerte beenden den Prozess vor dem Webserver mit
einer deutschen, geheimnisfreien Fehlermeldung. Das Passwort selbst wird nie
protokolliert. Nach erfolgreichem Bootstrap ersetzt sich der Startprozess durch
den Next.js-Prozess, sodass Signale und geordnetes Herunterfahren funktionieren.

## Healthcheck und Fehlerverhalten

`GET /api/health` ist ohne Anmeldung erreichbar. Der Handler führt eine
minimale SQLite-Abfrage aus und antwortet bei Erfolg mit Status 200 und
`{"status":"ok"}`. Bei einem Datenbankfehler antwortet er mit Status 503 und
einer generischen Meldung; Pfade, SQL und interne Fehler gelangen nicht an den
Client. Beide Antworten werden nicht gecacht.

Compose prüft diesen Endpunkt innerhalb des Containers mit Bun selbst, sodass
kein `curl`- oder `wget`-Paket nur für den Healthcheck installiert werden muss.
Startfrist, Intervall, Timeout und Fehlversuche erlauben Migrationen beim
Containerstart, erkennen danach aber zeitnah einen Ausfall. Coolify/Traefik
routet nur zu einem gesunden Container.

## Traefik und Domain

Die normale Coolify-Docker-Compose-Bereitstellung wird verwendet, nicht „Raw
Compose Deployment“. Coolify verbindet seinen Proxy automatisch mit dem
Stack-Netz. Nach dem Einlesen der Compose-Datei wird der Domain in Coolify der
Dienst auf Port 3000 zugewiesen; Coolify übernimmt Router, TLS-Zertifikat und
HTTP-zu-HTTPS-Weiterleitung.

Explizite `traefik.*`-Labels wären nur für Raw Compose oder besondere
Middlewares nötig und bleiben deshalb aus. `APP_URL` muss exakt der in Coolify
vergebenen externen HTTPS-Adresse entsprechen, weil OAuth-Rücksprünge und
E-Mail-Links diesen Wert verwenden.

## Dokumentation und Installation

Die deutsche README erhält einen kompakten Coolify-Ablauf:

1. Repository als Docker-Compose-Ressource anlegen.
2. `docker-compose.yml` auswählen und Raw Compose deaktiviert lassen.
3. Pflichtvariablen setzen, optionale Integrationen bei Bedarf ergänzen.
4. Domain dem Dienst auf Port 3000 zuweisen und denselben Wert als `APP_URL`
   setzen.
5. Deployen, Healthcheck abwarten, mit dem Bootstrap-Konto anmelden und das
   Startpasswort ändern.
6. Volume-Backups und Wiederherstellung konfigurieren.

Die `.env.example` dokumentiert denselben Vertrag für lokale Compose-Prüfungen
und vermeidet echte Zugangsdaten. Ein Hinweis erklärt Coolifys „Literal“-Option
für Passwörter mit Dollarzeichen.

## Prüfung

Automatische Tests decken die Bootstrap-Validierung, die einmalige Anlage,
Idempotenz und den Schutz eines vorhandenen Kontos ab. Der Health-Handler wird
für erfolgreichen und fehlgeschlagenen Datenbankzugriff geprüft, ohne interne
Fehler nach außen zu geben.

Vor Abschluss werden außerdem ausgeführt:

- `bun test`
- `bun run build`
- `docker compose config`
- Docker-Image bauen
- Container mit frischem Volume starten und Healthcheck/Erstanmeldung prüfen
- Container mit demselben Volume neu erstellen und Persistenz/Idempotenz prüfen
- bestätigen, dass der Laufzeitprozess nicht root ist und kein Host-Port
  veröffentlicht wird

Falls Docker in der Arbeitsumgebung nicht verfügbar ist, bleiben die
Docker-spezifischen Prüfungen ausdrücklich als nicht ausgeführt markiert; Build
und Anwendungstests müssen trotzdem erfolgreich sein.

## Nicht im Umfang

- mehrere Replikate oder ein Wechsel von SQLite auf einen Server-Datenbankdienst
- ein eigener Reverse Proxy oder manuelle TLS-Zertifikate
- ein Administrationskonto, das bei jedem Start aus Variablen synchronisiert
  oder zurückgesetzt wird
- automatische externe Backups; dokumentiert wird der zu sichernde Umfang,
  die Zielablage bleibt Sache der Coolify-Installation
- Veröffentlichung eines vorgebauten Images in einer Registry
