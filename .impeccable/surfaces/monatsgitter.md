---
version: 1
slug: "monatsgitter"
primary_target: "component:Monatsgitter"
related_targets:
  ["route:/kalender", "route:/abwesenheit", "route:/spesen", "route:/protokoll",
   "route:/team", "route:/abschluss", "route:/berichte", "route:/mitarbeiter",
   "route:/spesen/pruefen", "route:/abwesenheit/pruefen"]
---

# Surface: die zweite Achse — Monatsgitter, ein Rahmen, eine Tafel

Mode: Redesign (elf Oberflächen, ein Darstellungs-Audit).

Audience & job: dieselben 15–50 Büromenschen und ihre Verwaltung. Was sich
ändert, ist keine Fähigkeit, sondern die Form, in der vier Fragen gestellt
werden: *wer ist wann weg*, *welche Tage deckt das ab*, *wie steht wer*, *was
muss ich entscheiden*.

## Was falsch war

Die Bildsprache dieser Anwendung ist auf der **Stundenachse** durchgesetzt —
eine `Tagesbahn`, drei Größen, ein Modul — und auf der **Datumsachse** nie
angekommen. Dort zeichneten vier eigene Komponenten (`team-kalender.tsx`,
`abwesenheit-stapel.tsx`, `reisen-stapel.tsx`, `protokoll-band.tsx`, zusammen
1 094 Zeilen) dasselbe auf einem gemeinsamen Achsenmodul.

Gemessen an der laufenden Anwendung bei 1440 px:

- Teamkalender, August, neun Bahnen für **eine** Abwesenheit: rund 1 % Tinte
  auf 99 % Spur. Die Leere skalierte in die falsche Richtung — je mehr
  Mitarbeiter, desto leerer das Blatt.
- **Kein Wochentag.** Beschriftet wurde 5·10·15·20·25·30. „Kann ich Freitag den
  21. weg?" ließ sich nur durch Abzählen von Zellen beantworten — und das ist
  die Frage, wegen der man morgens hinsieht.
- Jahresansicht: **1,2 px je Kalendertag**, ein zwölftägiger Urlaub acht Pixel
  breit. Weil ~104 Wochenendzellen bei dieser Auflösung zu einem durchgehenden
  Karo verschmelzen, schaltete der Code die Ruhetags-Hinterlegung oberhalb von
  62 Tagen ab — die Jahresansicht hatte damit gar keine Struktur mehr. Der Code
  hatte das Problem erkannt und konnte es in dieser Form nicht lösen.
- Protokollband, August: 2 von 31 Spalten mit Inhalt.

Die Diagnose liegt eine Ebene über der Zeichnung. Eine Gantt-Bahn belohnt
**dichte, überlappende, vergleichbare Dauern**. Abwesenheiten sind das
Gegenteil: dünn gesät, meist ohne Überschneidung, und vor allem *im Kalender
verortet*. Das Band optimierte die Achse, auf der die Daten kaum variieren, und
warf die weg, auf der sie es tun. Falsch war nie die Zelle — falsch war der
Behälter.

Zwei weitere Brüche quer durch die Anwendung:

- **Der Rahmen hörte an der Verwaltungsgrenze auf.** Fünf Routen standen im
  `ZeitRahmen`, sechs bauten Überschrift, graue Zeile und Umschalter von Hand.
  Die Grenze verlief exakt zwischen Mitarbeiter- und Verwaltungsseiten, und
  jede dieser sechs Seiten trug ihre Kennzahl bereits — als Bruchstück in der
  grauen Zeile.
- **Vier handgebaute Raster** mit 74 fest verdrahteten `inlineSize:`-Breiten,
  genau eine echte Astryx-`Table` (`konto-tafel.tsx`). Ist/Soll/Saldo war auf
  dem Monatsabschluss 90 px und auf den Berichten 100 px breit — dieselben drei
  Zahlen, zwei Raster. Nichts war sortierbar, also konnte die Lohnbuchhaltung
  nicht fragen, wer am weitesten abweicht.

## Richtung

`lib/kalendergitter.ts` faltet dieselbe Datumsachse an der Wochengrenze.
`components/monatsgitter.tsx` zeichnet sie als echtes `<table>` — der Wochentag
ist die Spalte, die Kalenderwoche die Zeile, und eine Vorlesehilfe bekommt
beides als Überschrift geschenkt statt einer langen `aria-label`-Kette.

Das Gitter steht zu seinen vier Zellfüllungen in genau der Beziehung, in der
`Tagesbahn` zu ihren drei Größen steht: **eine** Zeichnung, austauschbarer
Inhalt. Aus dem Band übernommen und unverändert: die Spanne als einzelne
Tageszellen, und die zwei Kanäle, die sich nie kreuzen — Füllung = „kostet
etwas", Kante = „steht fest".

Ausdrücklich **kein Farbcode für die Arten**. Wo die Art gezeigt werden darf,
steht ihr Sinnbild; wo nicht, ein neutraler Stein. Zeichen sind in diesem Haus
das Vokabular, Farbe ist es nicht — und der Unterschied „Urlaub gegen Krank"
bleibt damit sichtbar abgeschnitten statt heimlich eingefärbt.

## Entscheidungen

- **Das Jahr ist nicht der Monat, herausgezoomt.** Es bekommt eine eigene
  Auflösung: 52 (oder 53) Wochen, eine Zeile je Person bzw. je Art. Die Frage
  wechselt mit — nicht „an welchem Tag", sondern „in welchen Wochen und wie
  viel". Die Rampe ist *ein* Stein in vier Helligkeiten, nicht fünf Farben.
- **Die Belegungskurve behält das Band** — in dem Beruf, für den es taugt: eine
  dichte, durchlaufende Größe über die Zeit. Ihr Maßstab hat einen Boden von
  drei, weil sonst eine einzige abwesende Person von neun die volle Höhe füllte
  und das Bild über genau die Größe log, wegen der man es ansieht. Die Grenze
  kommt aus den Einstellungen; ohne Eintrag wird keine Linie gezogen.
- **Die Auswahlgeste zieht ins Gitter.** `tage-waehler.tsx` gibt es nicht mehr.
  Es existierte nur, weil auf der Bahn schon das Ziehen für einen Zeiteintrag
  wohnte und zwei Ziehgesten auf einer Fläche bei schrägem Zug ein Münzwurf
  gewesen wären. Über Kalendertage zu ziehen kann nichts anderes heißen, also
  ist die Kollision weg — und Anzeige und Eingabefläche sind dasselbe Objekt.
  Die Datumsspalte im Zeitstapel bleibt als schlichter Verweis für den einzelnen
  Tag (und verliert damit ihr `touch-action: none`, das dort das Scrollen
  gekostet hat).
- **Spannen wandern von der Bühne in die Spalte.** Reisen und Abwesenheiten
  sind in ihrem Belegteil Listen mit einer Dauer; die Spanne ist dort eine
  Mikrografik in ~132 px — dasselbe Muster wie `SaldoTrend` in den Berichten.
  Der frei gewordene Platz trägt jetzt, wofür man vorher aufklappen musste:
  Art bzw. Anlass.
- **Ein Navigator statt vier.** `DaySwitcher` und `MonthSwitcher` sind gelöscht,
  `PruefFilter` ist aufgegangen; `TagLeiste`, `MonatLeiste` und `StatusLeiste`
  sitzen auf demselben `Navigator`-Gerüst wie die Bereichsleiste — mit
  demselben gefüllten Zeichen für den offenen Reiter und demselben Puls am
  angeklickten Verweis.
- **Ein Zeilenkörper für beide Prüf-Warteschlangen** (`pruef-stapel.tsx`).
  Bewusst nicht geteilt: „Alle genehmigen". Eine Reise ist geschehen und wird
  nachgerechnet, ein Urlaubsantrag ist eine Entscheidung über eine Woche, in
  der jemand fehlen wird — das bleibt eine Eigenschaft der Seite.
- **Team gruppiert nicht mehr, es sortiert.** Die drei Zustandsgruppen waren
  eine gute Antwort auf „wer ist da", machten die Tabelle aber unsortierbar.
  Der Zustand ist jetzt ein Sortierrang: dieselbe erste Lesart, und jede Spalte
  bleibt ein Schlüssel. Wie viele in welchem Zustand sind, sagt die Standzeile.

## Craft notes

- **Das Gitter ist eine Tabelle, keine Rasterattrappe.** `border-collapse:
  separate` mit `border-spacing` statt `gap` — eine Tabelle hat kein `gap`, und
  Zellen mit eigener Kante dürfen sich nicht berühren, sonst liest sich das
  Raster als ein einziges Kästchen.
- **Auf dem Telefon fällt nicht das Gitter weg, sondern der Text.** Bei 390 px
  standen mit der 560-px-Mindestbreite vier von sieben Spalten im Bild. Unter
  640 px entfällt die KW-Spalte, und die Marken verlieren ihr Wort, aber nicht
  ihr Zeichen; die Belegliste darunter trägt jeden Namen ohnehin in Textform.
- **Die Zahl über der Säule.** Eine Höhe vergleicht, nur eine Zahl benennt —
  dieselbe Lehre, die der Kontoverlauf schon einmal gezogen hat.
- Der Zustand „welche Reise ist offen" wohnt in `SpesenAnsicht` und nicht im
  Stapel, weil ihn zwei Dinge lesen: die Liste, die sich öffnet, und das Gitter,
  das die Tage dieser Reise hervorhebt.
- Kontrast: alle neuen Paarungen (Gittermarke auf Weiß/Papier/Goldwäsche,
  Heute-Ring, Belegungssäule, Wochenraster-Rampe, Spannenzelle) stehen in
  `tests/kontrast.test.ts`. `lib/kalendergitter.ts` hat eigene Tests für die
  Faltung, die ISO-Wochen und den Jahreswechsel.

## Verified in the browser (2026-08-06)

Alle 23 Routen (inkl. Jahres- und Filtervarianten) antworten mit 200 und ohne
Fehlerseite. Der Ziehzug über drei Kalendertage im Abwesenheitsgitter wurde mit
synthetischen Pointer-Ereignissen gefahren: drei Zellen ausgewählt, Wahlanzeige
„19. – 21. August", Adresse `?von=2026-08-19&bis=2026-08-21`, Editor offen.
Sortierung auf „Saldo" in den Berichten geprüft (absteigend +1:31 → −0:47).
Bei 390 px kein Querscrollen des Dokuments auf keiner der neuen Flächen.
392 Tests grün.

## Unresolved (do not invent)

- Das **Reisengitter** ist mit echten Reisedaten nicht im Browser gesehen
  worden: die drei Demo-Reisen gehören anderen Konten, und die angemeldete
  Sitzung wollte ich dafür nicht aufgeben. Struktur und Zellfüllung sind
  geprüft, die Darstellung mit Daten steht aus.
- Ob der Teamkalender bei fünfzig Personen und dichten Sommermonaten mehr als
  drei Marken je Zelle zeigen sollte (heute: drei plus „+N weitere").
- Eine Jahresansicht für Reisen & Spesen bleibt der Monatsstreifen; ob dort ein
  Wochenraster besser wäre, ist nicht entschieden.
