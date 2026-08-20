# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) with React and TypeScript, run and installed via Bun (`bun install`, `bun run dev`). E-Mail über Resend, gestaltet mit React Email (`@react-email/components`). UI built on the Astryx design system: `@astryxdesign/core` components with `@astryxdesign/theme-neutral`, conventions documented by `@astryxdesign/cli init`. User-committed decision (2026-08-04), superseding the earlier `Bun.serve()` HTML-imports plan.

## Users

Office/desk employees of a single company (realistic scale: 15–50 people), logging their working hours from a desktop browser at their workplace. Secondary audience: managers/back-office staff (role "Verwaltung") who review, correct, and approve those hours and prepare payroll-relevant summaries.

## Product Purpose

An internal employee time-tracking tool (Arbeitszeiterfassung) for one organization. Employees record when they work; managers keep those records accurate and approved; the company gets reliable monthly figures for payroll. Success means every employee's hours are captured completely and correctly with minimal daily effort, and month-end reporting requires no manual spreadsheet work.

## Operating Context

- Used during the normal office workday in a desktop browser; clock in/out happens at the start/end of work and around breaks.
- German-speaking workplace: the entire UI is in German.
- German labor-law context (ArbZG-shaped concepts): Arbeitszeit, Pausen, Überstunden/Zeitkonto, and the duty to record working time. Records feed payroll.
- Single shared instance for one company — no multi-tenant accounts or per-company settings.

## Capabilities and Constraints

Confirmed scope (built 2026-08-04):

- **Live clock in/out** — one state-coupled control (Einstempeln / Pause / Ausstempeln) in a persistent sticky clock strip on every authenticated page, writing onto the live stamped day. Mis-click protection: clock-out is undoable for 30 s; re-clock-in within the merge window (default 2 min, settings table) continues the previous entry; micro-pauses below the window are absorbed. Night shifts split at midnight on the next stamp action.
- **"Meine Zeit"** — one page with URL-driven zooms Heute / Woche / Monat (`/?ansicht=…`); Heute is optimized for the three-second visit (total + Feierabend prognosis + compact day-strip + entry rows).
- **Manual time entries** — enter or correct segments after the fact (date, start, end, Art, Notiz); corrections record who edited (`edited_by`) for payroll traceability.
- **Approvals & corrections** — both modes: per-entry corrections anytime plus a formal **Monatsabschluss** lock per employee per month; locked months are read-only until Verwaltung unlocks.
- **Reports & export** — monthly summaries, Zeitkonto balances, semicolon-CSV (UTF-8 BOM, Excel-ready) and a print-optimized monthly sheet ("Als PDF speichern", one page per employee with signature lines).

Decided model facts:

- Roles are permission bundles maintained in the app itself, not hardcoded gates: whoever holds `rollen.verwalten` creates, renames, re-bundles and deletes roles on /mitarbeiter — granting only rights they themselves hold, never locking themselves out, and never deleting a role an account still carries. Seeded (`lib/rollen.ts`, migration 27): `mitarbeiter`, `fulfillment`, `vertrieb` carry the base rights (own time, own absences, own trips, team calendar, access codes); `verwaltung` and `geschaeftsfuehrung` carry every right. Individual accounts can be granted extra rights beyond their bundle (`benutzer_rechte`), maintained in the Mitarbeiterverwaltung and written to the Protokoll. Every action and surface checks a named right (`hatRecht`), never a role. "Verwaltung" in this document reads as "whoever holds the corresponding right".
- Auth: email/password with hashed passwords (argon2 via `Bun.password`) and 30-day session cookies.
- Sollzeit: per-employee weekly minutes (`users.weekly_minutes`), spread over Mo–Fr.
- **Zeitkonto counts days that are accounted for**: days with entries, plus days with a day type. Urlaub/Krank/Feiertag set the effective Soll to 0, Fortbildung counts as having worked it, Freizeitausgleich spends it. A past day with an unfinished entry is uncountable (never counted as zero) and a working day with neither entry nor day type is excluded — both are named on the Zeitkonto page instead of hidden behind a footnote.
- Forgotten clock-outs stay open as **anomalies**; they block Monatsabschluss and surface as warnings until manually corrected. One exception: a segment still open from exactly yesterday within 12 h elapsed counts as a running night shift and is split at midnight on the next stamp action — anything older is never auto-closed.
- Segments never cross midnight; times are server-local (Europe/Berlin deployment).
- Language: German only. Astryx built-ins are localized via `locales/de.json`; the English-hardcoded Required/Optional field indicators are deliberately unused.

Added 2026-08-05 — **Reisen & Spesen** (Spesenabrechnung):

- Photographers away from the office record a **Reise** (departure, return, purpose, destination) in its own area `/spesen`, and the app derives the Verpflegungsmehraufwand from it. The duration is never typed and never calculated by hand — the editor shows the day-by-day derivation live while the trip is being entered, and names the rule behind each amount.
- **Per calendar day, not per hour.** Single-day trip: ≥ 8 h absence → half rate, below → no claim. Multi-day: half rate for arrival and departure day regardless of hours, full rate for each day fully in between. Elapsed hours stop mattering once the trip crosses midnight.
- **Dated rate table**, editable by Verwaltung: 14 €/28 € until 2025-09-30, 10 €/20 € from 2025-10-01. The tier is chosen by the trip's departure date and frozen onto the claim at submission.
- **Belege** (Übernachtung, Fahrt, Parken, Ticket, Sonstiges) with an optional JPG/PNG/WEBP/PDF attachment, stored outside `public/` and served only to the owner and Verwaltung.
- **Workflow**: Entwurf → Eingereicht → Genehmigt / Abgelehnt (with a required German reason). Verwaltung reviews in `/spesen/pruefen`, where the claim is drawn over the employee's stamped days. An eingereichte Reise blocks the Monatsabschluss of its month; a locked month freezes its trips.
- Export: `/api/export?art=spesen&monat=…` produces the same Excel-ready semicolon CSV as the time export.
- Deliberately out of scope (user decision): Kürzung bei gestellten Mahlzeiten, and a kilometre allowance.

Added 2026-08-06 — **Abwesenheit** (Urlaub, Krank, Freizeitausgleich, Fortbildung as spans):

- **An absence is a period, not a day.** It used to be set one day at a time from a six-item dropdown in the day's toolbar, which meant navigating to each date in turn — fourteen interactions to book a two-week holiday, and no record that the fourteen days belonged together. There is now a `/abwesenheit` area where a span is stated once, and the day types the Zeitkonto reads are derived from it.
- **Four arts, two kinds of act, stated at the point of choosing.** *Antrag* — Urlaub and Freizeitausgleich ask for something and spend a balance; they take effect only once Verwaltung approves. *Meldung* — Krank and Fortbildung state a fact and take effect at once. Feiertag is no longer settable at all: it comes from the Bundesland calendar, and being able to write it by hand was a one-click path to a fabricated paid day off.
- **The consequence is shown while the request is being made.** How many of the selected calendar days actually cost anything (weekends and holidays inside a span cost nothing), and what the balance reads afterwards — remaining leave for Urlaub, the Zeitkonto for Freizeitausgleich. Exceeding the entitlement warns but never refuses; Verwaltung decides.
- **Urlaubsanspruch** per employee (`users.urlaubstage_jahr`, default 30), plus a carry-over Verwaltung enters per year. Deducted on approval, not on submission. Accrual, pro-rata for mid-year hires and forfeiture dates are deliberately *not* computed — they depend on facts a time tracker does not hold.
- **§ 9 BUrlG is implemented**: falling ill during approved leave returns those days, but only where a certificate backs them. Without an AU the leave stays spent — which is what the statute says, not a limitation.
- **Krank has no free-text field anywhere.** It would be the first place someone types a diagnosis, and that would make this a health record under Art. 9 GDPR. Dates plus an optional AU (required from day 3, § 5 EFZG), stored outside `public/` and readable only by the employee and Verwaltung.
- **Workflow**: Entwurf → Eingereicht → Genehmigt / Abgelehnt (German reason required), reviewed in `/abwesenheit/pruefen` with the remaining entitlement shown beside each request. Meldungen appear there too, so a missing certificate is visible. An eingereichter Antrag blocks the Monatsabschluss of its month. There is deliberately no "approve all": a travel claim is arithmetic to check, a holiday request is a decision about a week someone will be away.
- Verwaltung approving its own absence is permitted — the company has no second instance — and is recorded and shown as such rather than quietly allowed.
- Absences now appear where payroll looks for them: `/berichte` and the print sheet. `dayTypeCounts()` had existed since the day types shipped and had never been called.

Added 2026-08-06 — **Teamkalender, Protokoll, Installationshinweis**:

- **Teamkalender** (`/kalender`, für alle Rollen) — wer wann abwesend ist, eine Bahn je Person auf der geteilten Datumsachse, Monat und Jahr. **Abgestufte Sichtbarkeit als Datenmodell, nicht als Anzeigeregel**: die *Art* einer fremden Abwesenheit wird für Nicht-Verwaltung gar nicht erst an den Browser geschickt — Urlaub gegen Krank ist eine Gesundheitsangabe nach Art. 9 DSGVO. Kollegen sehen, *dass* jemand weg ist (das ist die Auskunft, wegen der man hinschaut), die Verwaltung und die betroffene Person sehen auch das Warum. Entwürfe und abgelehnte Anträge erscheinen nicht.
- **Protokoll** (`/protokoll`) — jede Mutation der Anwendung mit Zeitpunkt, handelnder Person, betroffenem Datensatz und den Werten davor und danach; **auch die abgewiesenen Versuche** („wer hat versucht, den gesperrten Monat zu ändern"), Anmeldungen und fehlgeschlagene Anmeldungen inbegriffen. Drei Eigenschaften machen daraus einen Nachweis: zwei SQLite-Trigger weisen UPDATE und DELETE ab (GoBD-Unveränderbarkeit, im Schema statt in der Anwendung); jede Zeile trägt einen SHA-256 über ihren Inhalt samt dem Hash ihrer Vorgängerin, sodass ein Eingriff an der Datenbank vorbei die Kette an auffindbarer Stelle zerreißt; Name und Rolle sind je Zeile eingefroren, damit eine Umbenennung die Vergangenheit nicht umschreibt. Verwaltung prüft die Kette auf Knopfdruck.
- **Zwei Leserschaften, eine Seite.** Verwaltung sieht alles und filtert nach Bereich, Person, Tag und Freitext; ein Mitarbeiter sieht, was den eigenen Datensatz berührt hat oder was er selbst getan hat — Auskunft nach Art. 15 DSGVO und die Grundlage dafür, einer Korrektur überhaupt widersprechen zu können. Der Zuschnitt liegt in der Abfrage, nicht in der Anzeige.
- **Die Vorauswahl zeigt Eingriffe.** Das laufende Stempeln steht mit im Protokoll (sonst fehlte der Beleg für die Erfassung selbst), wäre aber bei fünfzig Personen die Mehrheit aller Zeilen — ein Schalter blendet es dazu, nichts wird verschwiegen. Ausgabe als semikolongetrennte CSV mit denselben Filtern und dem Siegel je Zeile.
- **Kein Kennwort und keine Diagnose im Protokoll.** Ein Passwort-Zurücksetzen wird als Tatsache festgehalten, nie mit dem erzeugten Kennwort; eine Krankmeldung mit Datum und Dateiname, nie mit Inhalt.
- **Installationshinweis** — die Anwendung ist eine PWA (Manifest, Icons, `display: standalone`). Läuft sie nicht installiert, bietet ein ruhiger, einmal wegklickbarer Hinweis das Installieren an: mit echtem Knopf, wo der Browser `beforeinstallprompt` liefert, mit der Anleitung über „Teilen", wo es Safari auf iOS ist — und **in jedem anderen Browser gar nicht**, weil eine Anleitung, die das Gerät nicht ausführen kann, schlechter ist als Schweigen. Erst ab dem dritten Besuch; einmal weggeklickt heißt weg.

Added 2026-08-07 — **Persönliche Einrichtung**:

- Vor der ersten Nutzung bestätigt jede Person die von der Verwaltung hinterlegten Stammdaten (Name, E-Mail, Rolle, Wochen-Sollzeit, Urlaubsanspruch und Feiertagskalender). Ohne diese Bestätigung bleiben die Anwendung, Exporte und Server-Aktionen gesperrt.
- Die Freigabe ist versioniert: ändert die Verwaltung später abrechnungsrelevante Stammdaten, erscheint die Prüfung beim nächsten Start erneut. Die Bestätigung selbst steht im unveränderbaren Protokoll.
- Anmeldung und Einrichtung sind ein Ablauf auf `/login`: nach gültigen Zugangsdaten prüft der Server die persönliche Freigabe. Ist sie offen oder fehlerhaft, wächst dasselbe Zugangsblatt unmittelbar in die Prüfung hinein; die ladende Anmelde-Schaltfläche ist die einzige Quittung, eine flüchtige Erfolgsmeldung gibt es nicht. Ein bereits fertiges Konto gelangt ohne Zwischenhalt in seine Startansicht. `/einrichtung` bleibt nur als Weiterleitung für alte Verweise bestehen.
- Ein von der Verwaltung ausgestelltes Start- oder Rücksetzkennwort ist vorläufig. Nach der ersten erfolgreichen Anmeldung muss die Person es durch ein eigenes Passwort mit mindestens zwölf Zeichen, einem Buchstaben und einer Zahl ersetzen; erst danach können Stammdaten bestätigt und die Anwendung betreten werden. Bestehende Konten werden nicht rückwirkend gesperrt.
- Drei persönliche, kontogebundene Vorgaben sind eingerichtet und später unter „Mein Profil" änderbar: eine lokale Tier-Profilfigur, die Startansicht nach der Anmeldung und der bleibende Hinweis zu offenen Tagen. Die Figuren kommen aus einem lokalen Bildbogen; ein externer Abruf findet nie statt.
- Unter „Mein Profil" kann jede Person zusätzlich **ein eigenes Profilbild hochladen** (JPG, PNG oder WEBP, höchstens 5 MB) — geändert 2026-08-17 auf ausdrückliche Produktentscheidung; vorher war der Bildbogen die einzige Möglichkeit. Der Bildbogen bleibt der Rückfall: wer kein Bild hochlädt oder es wieder entfernt, trägt weiter seine Tierfigur, und ein Konto steht damit nie ohne Zeichen da. Das Bild wählt jede Person nur für sich selbst — auch die Verwaltung setzt es für niemanden. Es liegt außerhalb von `public/` unter `data/avatare/` und ist ausschließlich über `app/api/avatar/[userId]` erreichbar, das jedem **angemeldeten** Konto antwortet: ein Profilbild ist dazu da, im Team erkannt zu werden. Ohne Anmeldung gibt es keinen Zugang, und an Dritte geht es nie. Protokolliert wird der Vorgang („gesetzt"/„entfernt"), nie die Datei.
- Bei einem neu angelegten oder noch nicht fertig eingerichteten Konto ist die Verknüpfung der Firmenidentität mit Google ein eigener, erforderlicher Einrichtungsschritt. Sie ist ausdrücklich als OAuth-Vorschau markiert: lokal ersetzt die hinterlegte Firmen-E-Mail vorläufig die Google-Freigabe; im Produktivbetrieb bleibt sie gesperrt, bis echtes OAuth aktiviert wird. Nur Konten, die ihre Einrichtung bereits vor dieser Funktion abgeschlossen hatten, werden nicht rückwirkend aufgehalten.
- Google ist **keine zweite Anmeldeart**. Registrierung und Anmeldung bleiben vollständig beim MedArbeiter-Konto mit E-Mail und Passwort; die Google-Identität wird diesem Konto erst nach erfolgreicher Anmeldung zugeordnet.

Added 2026-08-06 — **Der Umbau auf die zweite Achse** (Darstellungs-Audit über alle elf Oberflächen):

- **Ein Monat wird als Monat gezeichnet, nicht als Bahnenbündel.** Teamkalender, Abwesenheit, Reisen & Spesen und das Protokoll zeichneten ihre Tage auf einer durchlaufenden Datumsachse — vier eigene Komponenten, dieselbe Zeichnung. Gemessen: neun Bahnen, um eine Abwesenheit zu zeigen (rund ein Prozent Tinte), kein Wochentag auf der Achse, und ein Jahr bei 1,2 px je Tag, in dem die Ruhetags-Hinterlegung sogar abgeschaltet werden musste. Ein Gantt-Band belohnt dichte, überlappende Dauern; Abwesenheiten sind dünn gesät und vor allem *im Kalender verortet*. Jetzt trägt ein `Monatsgitter` alle vier — dieselbe Rechnung, an der Wochengrenze gefaltet, mit austauschbarer Zellfüllung. Die Leere kehrt sich damit um: ein ruhiger Monat ist ein stilles Raster, ein voller sichtbar dicht.
- **Das Jahr ist eine andere Frage** und bekommt eine andere Auflösung: 52 Wochen statt 365 Tage, eine Zeile je Person. Nicht „an welchem Tag", sondern „in welchen Wochen und wie viel".
- **Die Auswahlgeste sitzt endlich auf dem, was sie auswählt.** Tage für eine Abwesenheit wurden über eine eigene Datumsrinne neben den Bahnen gezogen, weil auf der Bahn schon das Ziehen für einen Zeiteintrag wohnte. Im Gitter gibt es diese Kollision nicht; die Rinne ist ersatzlos weg.
- **Wie viele gleichzeitig abwesend sind**, stand als Nachsatz in einer Standzeile und ist jetzt eine Kurve unter dem Gitter, mit einer Belastungsgrenze aus den Einstellungen (leer = keine Grenze; eine erfundene Grenze wäre eine Warnung, für die niemand einsteht).
- **Der Rahmen hört nicht mehr an der Verwaltungsgrenze auf.** Team, Monatsabschluss, Berichte, Mitarbeiter und beide Prüf-Warteschlangen standen außerhalb des `ZeitRahmen` und bauten Kopf und Umschalter von Hand — die Grenze verlief exakt zwischen Mitarbeiter- und Verwaltungsseiten. Jede dieser Seiten hatte ihre Kennzahl bereits, nur klein in der grauen Zeile.
- **Person mal Zahl ist eine Tabelle.** Vier handgebaute Raster mit 74 fest verdrahteten Spaltenbreiten (Ist/Soll/Saldo 90 px hier, 100 px dort) sind eine sortierbare `PersonenTafel` geworden. Die Lohnbuchhaltung kann jetzt fragen, wer am weitesten abweicht.
- Nebenbei zusammengelegt: ein Navigator statt vier (`TagLeiste`, `MonatLeiste`, `StatusLeiste` auf demselben Gerüst), ein Zeilenkörper für beide Prüf-Warteschlangen. Bewusst *nicht* zusammengelegt: „Alle genehmigen" bleibt eine Eigenschaft der Spesenseite.

Added 2026-08-10 — **Zugangscodes** (geteilte Einmalcodes der gemeinsamen Firmenkonten):

- **Der Ersatz für das Büro-Handy.** Die Bestätigungscodes (TOTP, RFC 6238 — derselbe offene Standard wie Google Authenticator) der *gemeinsamen* Firmenkonten lagen bisher auf einem Telefon, das durchs Büro gereicht wurde. Jetzt liegen sie unter `/zugangscodes`: jeder Angemeldete liest die laufenden Codes seines Leserkreises, die Verwaltung hinterlegt und entfernt Zugänge. Jeder Zugang trägt einen **Leserkreis** — alle Angemeldeten, ausgewählte Rollen (Mehrfachauswahl), bestimmte Personen oder „Nur für mich" (der Personenkreis mit genau dem Anlegenden). Der Zuschnitt liegt in der Abfrage, nicht in der Anzeige; wer Zugangscodes verwaltet, sieht jede Zeile samt sichtbarem Kreis-Schild, damit nichts heimlich privat ist und ein falsch zugeschnittener Zugang auffindbar bleibt. **Jeder legt eigene Schlüssel an** (Recht `zugangscodes.erfassen`, in jeder Rolle): nur für sich oder mit Personen geteilt, und pflegt, was er angelegt hat — Freigaben für alle oder für Rollen sowie fremde Einträge bleiben der Verwaltung (`zugangscodes.verwalten`). Bearbeiten zeigt das Geheimnis nie wieder: leer gelassen bleibt es, neu eingegeben ersetzt es. Die Seite gruppiert vom Persönlichen zum Gemeinsamen (Nur für dich · Geteilt · Für alle), erkannte Dienste tragen ihr Markenzeichen (Simple Icons, selbst gehostet) — auf dem Telefon per Kamera-Scan des Einrichtungs-QR-Codes (dieselbe Geste wie in jeder Authenticator-App; nativer `BarcodeDetector`, sonst jsQR, sonst ein gewähltes Bild), am Schreibtisch per otpauth-Link, Bildschirmfoto oder dem Schlüssel, den jeder Dienst neben dem QR-Code zeigt. Der Scan ist nie der einzige Weg.
- **Das Geheimnis verlässt den Server nie.** Der Browser bekommt den fertigen sechsstelligen Code samt Ablaufzeit, nie das Base32-Geheimnis; ein einmal hinterlegter Schlüssel ist auch für die Verwaltung nicht wieder ablesbar. Wer ausscheidet, verliert mit dem Konto den Zugriff und nimmt nichts Dauerhaftes mit. Hinterlegen und Entfernen stehen im Protokoll — wie beim Passwort nur die Tatsache, nie das Geheimnis.
- **Nur gemeinsame Konten.** Für persönliche Konten ist die Tabelle der falsche Ort (jeder sieht die Codes), und der Anlegen-Dialog sagt das an der Stelle, an der es zählt.

**Der Posteingang (2026-08-10).** Wer entscheidet, muss nicht in der Anwendung nachsehen, ob etwas wartet — und wer wartet, muss nicht nachsehen, ob entschieden wurde. Acht Nachrichten gehen über Resend hinaus, gestaltet mit React Email in der Sprache des Hauses:

- **Wer entscheidet, bekommt die Post.** Der Empfängerkreis kommt aus dem Recht (`abwesenheit.pruefen`, `spesen.pruefen`), nie aus der Rolle — ein Mitarbeiterkonto mit dem Zusatzrecht ist dabei, ein Verwaltungskonto ohne es nicht. Niemand bekommt Post über sich selbst: reicht die Verwaltung ihren eigenen Urlaub ein, wartet nichts auf sie.
- **Krank verlässt das Haus nur als „Abwesend".** Dieselbe Regel wie im Google Kalender und aus demselben Grund: eine Gesundheitsangabe nach Art. 9 DSGVO hat auf den Servern eines Mailversenders nichts verloren. Die Nachricht sagt, dass jemand fehlt, und nennt die Anwendung als Ort, an dem steht, warum.
- **Abbestellen ja, Zugangspost nein.** Sechs der acht Arten lassen sich im Profil abwählen. Startpasswort und zurückgesetztes Kennwort nicht — sie sind die einzige Nachricht, die jemanden *vor* der ersten Anmeldung erreicht, und ein Schalter dagegen spielte den Zugang gegen sich selbst aus. Gespeichert wird die Abwahl, nicht die Wahl: eine später hinzukommende Nachrichtenart erreicht dadurch alle bisherigen Empfänger statt still niemanden.
- **Das Startpasswort ist die Wahl der Verwaltung, nicht der Anwendung.** Beim Anlegen eines Kontos steht ein Schalter „Zugangsdaten per E-Mail senden" (Vorgabe an; das Passwort muss bei der ersten Anmeldung ohnehin ersetzt werden). Wer ein Kennwort nicht in einem Postfach haben will, nimmt den Haken heraus — angezeigt wird es in beiden Fällen. Beim *Zurücksetzen* geht die Nachricht immer hinaus: die Adresse ist längst bestätigt, und wer sich gerade nicht anmelden kann, ist auf diesen Weg angewiesen.
- **Nichts hängt davon ab.** Der Versand läuft nach der Buchung, kann keine Buchung aufhalten und lässt sich in den Einstellungen abschalten, ohne dass sich sonst etwas ändert. Ohne hinterlegten Schlüssel steht jede Nachricht in der Konsole statt im Postfach. Das Versandbuch (Empfänger, Art, Betreff, Ausgang) steht in den Einstellungen und bewusst **nicht** im Protokoll: eine verschickte Nachricht ändert den Datensatz nicht, und ein Startpasswort gehört in ein Postausgangsbuch so wenig wie in einen Nachweis.

Geändert 2026-08-18 — **Keine Eingangspost, sondern eine Erinnerung** (ausdrückliche Produktentscheidung; vorher ging jede Einreichung sofort an den Prüfkreis):

- **Der Eingang ist keine Nachricht wert.** Dass ein Urlaubsantrag oder eine Reisekostenabrechnung eingereicht wurde, steht in der Prüfliste, mit Zähler an der Seitenleiste — die Verwaltung sieht es in der Anwendung. Eine Mail, die nur wiederholt, was ohnehin auf dem Bildschirm steht, macht aus dem Posteingang einen Verteiler, den man wegklickt, und nimmt beim Wegklicken die Nachrichten mit, die es wert gewesen wären. `abwesenheit.eingereicht` und `reise.eingereicht` sind deshalb ersatzlos gestrichen.
- **Was liegen bleibt, meldet sich.** An ihrer Stelle steht die Erinnerung: **nach drei Tagen** ohne Entscheidung geht eine Mahnung an denselben Prüfkreis, und danach alle drei Tage erneut, solange der Vorgang offen ist. Genau die verstrichene Zeit sagt die Anwendung von sich aus nicht — ein Antrag von vorgestern sieht in der Liste aus wie einer von heute morgen —, und deshalb ist sie das, was eine Nachricht rechtfertigt. Die Mahnung nennt dieselben Angaben wie die Prüfliste plus die Zahl, die dort fehlt: seit wann.
- **Eine Meldung bleibt sofort.** Krank und Fortbildung gehen unverändert im Augenblick der Erfassung hinaus. Sie sind keine Warteschlange, sondern eine Tatsache über heute — und heute ist jemand nicht da.
- **Zurückgezogen heißt: die Frist beginnt von vorn.** Wer seinen Antrag zurückzieht und später neu einreicht, erbt keine Mahnung aus dem alten Lauf. Entschiedene, zurückgezogene und gelöschte Vorgänge verlieren ihr Gedächtnis.
- **Kein Zeitgeber, kein Rundbrief.** Der Lauf hängt am ersten Seitenaufruf (höchstens einmal je Stunde) und läuft nach der Auslieferung: niemand wartet auf einen Mailserver. Sieht tagelang niemand in die Anwendung, gibt es auch niemanden, den eine Mahnung erreichen würde. Eine tägliche Rundmail über alles Offene entsteht dabei ausdrücklich nicht — gemahnt wird der einzelne Vorgang, der wirklich liegt.

Added 2026-08-14 — **Verbundene Apps** (MedArbeiter als Anmeldestelle):

- **Eine Anmeldung fürs Haus.** Andere Hausanwendungen führen keine eigenen Konten und Passwörter mehr: sie schicken den Browser zu MedArbeiter (`/api/oauth/authorize`), die Person meldet sich mit ihrem bestehenden Zugang an (die laufende 30-Tage-Sitzung genügt, es erscheint kein zweiter Dialog), und die App holt sich — von Server zu Server — die Identität ab: `sub`, Name, E-Mail, Rolle und die wirksamen Rechte, mehr nicht. OAuth 2.0 Authorization-Code für hauseigene, serverseitige Apps; opake Tokens, deren Prüfung ein Datenbank-Nachschlag ist wie bei der Sitzung — kein OIDC, keine Signaturen, keine neue Abhängigkeit.
- **Die Verwaltung bindet an.** Unter `/apps` (Recht `apps.verwalten`) werden Apps registriert: Name, Weiterleitungs-URIs (exakt getroffen, https außer localhost), Sperre. Client-ID und Geheimnis entstehen beim Anlegen; das Geheimnis wird genau einmal angezeigt und ist danach nur noch als Hash gespeichert — es gibt kein Ablesen, nur ein Erneuern, wie beim Startpasswort.
- **Ein gesperrter Zugang ist überall gesperrt.** Ein deaktiviertes Konto hört sofort auf, sich anzumelden, auch mit lebendem Token; eine gesperrte App ist für die Endpunkte unbekannt und verliert alles Ausgestellte. Ein zweimal eingelöster Code widerruft die Tokens, die aus ihm hervorgingen (RFC 6749). Jede Anbindungspflege steht als Eingriff im Protokoll, jeder Anmelde-Rundlauf als Routine — das Geheimnis nie.

Decided since (2026-08-04 refactor):

- **ArbZG rules warn, never block** (§4 breaks, §3 10-hour cap, §5 11-hour rest). The app documents what happened; a violation is flagged and can carry a reason, never refused.
- **Absence types are in scope**: Urlaub, Krank, Feiertag, Freizeitausgleich, Fortbildung, plus computed public holidays per Bundesland (company setting, per-employee override). How each meets the Soll is defined in `lib/daytypes.ts`. (Superseded 2026-08-06 in how they are *entered* — see Abwesenheit above; the Soll treatment is unchanged.)
- **Forgotten clock-outs** may be closed provisionally at a configurable cutoff (off by default), always flagged "bitte bestätigen" — never silently accepted.

Open decisions (record here when decided; do not invent):

- Password policy (Länge und Zeichen sind geprüft; ein Ablaufdatum gibt es bewusst nicht). Das Zurücksetzen nimmt weiterhin die Verwaltung vor — seit 2026-08-10 geht das neue Startpasswort dabei zusätzlich per E-Mail an die betroffene Person. Ob jemand es selbst über einen Link zurücksetzen darf, ist nicht entschieden.
- Whether Verwaltung should see ArbZG flags for the whole team in one place (today they surface per employee).
- Wie lange das Protokoll aufbewahrt wird. § 147 AO legt sechs bzw. zehn Jahre für die Aufzeichnungen selbst nahe, aber es gibt bewusst keine Löschfunktion — eine Tabelle, die sich löschen lässt, ist keine unveränderbare. Wenn eine Frist gilt, wird sie als Archivierung entschieden, nicht als DELETE.
- Municipal holidays (Fronleichnam in parts of SN/TH, Mariä Himmelfahrt in Bavarian communities, Augsburger Friedensfest) — entered by hand as Feiertag rather than guessed per Bundesland.
- Hosting/deployment target. Die Adresse steht seit 2026-08-10 fest — **hub.med-arbeiter.de**, eine Angabe, zwei Aufgaben (Google-Rücksprung und die Knöpfe in den Nachrichten); wo die Anwendung läuft, ist offen. Der Absender ist `zeit@hub.med-arbeiter.de`, bewusst auf der Subdomain: so hängt die Zustellbarkeit der Hauspost nicht daran, wie sich diese Anwendung verhält. Die Subdomain ist bei Resend verifiziert (nachgemessen am 2026-08-10), der Versand läuft; die Hauptdomain ist es bewusst nicht.
- Ob es *weitere* Erinnerungen geben soll — offene Tage, eine fällige AU. Für wartende Anträge und Abrechnungen ist es seit 2026-08-18 entschieden (siehe „Keine Eingangspost, sondern eine Erinnerung"): dort ersetzt die Mahnung nach drei Tagen die Eingangspost, ohne einen Zeitgeber zu brauchen. Ob dasselbe Muster auch für den eigenen Datensatz taugt, ist offen — dort weiß die Anwendung schon mit der Aufmerksamkeitsmeldung Bescheid, und eine tägliche Rundmail bleibt der schnellste Weg, alle Nachrichten ignorieren zu lassen.

## Brand Commitments

- Product/brand name: **MedArbeiter** (medical-flavored — heart + EKG motif; fits a healthcare-sector employer).
- Logo: `assets/logo.png` — black and gold heart mark with EKG line and upward arrow, plus "MedArbeiter" wordmark in a black geometric sans.
- Brand color: **#e1b025** (gold) on a **white background** — user-stated binding constraint.

## Evidence on Hand

- `assets/logo.png` (1366×249, transparent, wordmark + heart mark) — the only real asset. Derived: `public/logo.png` (full logo, login) and `public/logo-mark.png` (cropped heart, app shell).
- The marketing site (screenshot provided by the user, 2026-08-04) is brand evidence: warm gold gradient wash on white, rounded gold CTAs, black geometric sans headlines — the app deliberately reads as kin to it.
- No real employee data exists. `bun scripts/seed.ts --demo` generates SYNTHETIC demo employees and times (stable PRNG, `*.example` addresses); never present these as real people or real hours.

## Accessibility & Inclusion

Established during the finish review and binding for future work: text contrast ≥4.5:1 and non-text UI (timeline fills, ticks, focus rings) ≥3:1, computed not eyeballed; DOM order matches visual order at every breakpoint; visible focus treatment on interactive rows; animations respect `prefers-reduced-motion`; assistive tech must reach the inline segment-correction buttons (no presentational roles on containers with controls).

## Product Principles

1. **Daily use must be near-zero effort.** Clocking in/out is a many-times-a-day ritual; it should take one glance and one click, never a form.
2. **The record is the product.** Completeness and correctness of hours outrank every convenience feature; corrections and approvals must leave the record trustworthy for payroll.
3. **Speak the workplace's language.** German terms employees and payroll actually use (Arbeitszeit, Pause, Überstunden, Monatsabschluss) — no invented jargon, no English UI strings.
4. **Two audiences, one truth.** Employees see their own time simply; managers see the whole team with the controls to keep it accurate — both views read from the same authoritative record.
