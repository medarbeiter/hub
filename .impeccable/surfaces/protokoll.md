---
version: 1
slug: "protokoll"
primary_target: "route:/protokoll"
related_targets: ["route:/kalender", "route:/api/export"]
---

# Surface: Protokoll und Teamkalender

Mode: Operate (both screens).

Audience & job: Verwaltung must be able to answer "who changed this, when, and what did it say before" — for a Betriebsprüfung, for payroll, and for an employee who disagrees with a correction. The same employee must be able to ask that question about their own record. And every colleague needs "who is away next week" without learning why.

## Was gefehlt hat

`edited_by` sagte, wer eine Zeile **zuletzt** angefasst hat — mehr nicht. Wer sie davor angefasst hat, was dabei aus welchem Wert wurde, wer sich an einem abgeschlossenen Monat versucht hat und abgewiesen wurde: alles nicht erfasst. Für eine Anwendung, deren erklärter Zweck „the record is the product" ist, war das die größte Lücke im Datensatz.

Beim Teamkalender war die Lücke eine andere: die Auskunft existierte, aber nur als Nebenprodukt der Prüfliste. „Wer ist nächste Woche da" beantwortete man, indem man die Warteschlange der Verwaltung öffnete — eine Frage, die jeden angeht, nur über einen Weg, den nur die Verwaltung hat.

## Direction

Beide Flächen erben den bestehenden Rahmen unverändert (`ZeitRahmen` + `MonatJahrLeiste`) und die geteilte Datumsachse. Kein neues Weltbild: was hinzukommt, sind zwei Bänder in derselben Grammatik, in der Reisen und Abwesenheiten schon liegen.

**Die Bühne des Protokolls ist ein Aktivitätsband** — Vorgänge je Tag, zweifarbig nach Eingriff und Routine — und zugleich der Tagesfilter. Das ist die eine Ansicht, in der ein Ausschlag sichtbar wird: vierzig Korrekturen am 31. eines Monats sind eine Geschichte, die keine Zeile für sich erzählt. Anklicken filtert die Liste darunter, das Band bleibt auf dem ganzen Monat stehen, damit der Zusammenhang nicht verlorengeht.

**Kein Gold auf beiden Flächen.** Gold heißt gearbeitete Zeit und die Hauptschaltfläche; eine Protokollzeile und eine Abwesenheit sind weder das eine noch das andere. Also zwei Steine (dunkel = Eingriff, hell = Routine) und Steinkanten für Abwesenheitszellen — dieselbe Antwort, die die Abwesenheitsspange im Reiseband schon gibt.

## Entscheidungen vorab (Nutzerin, 2026-08-06)

Teamkalender für alle, abgestuft: Kollegen sehen *dass*, nicht *warum*. Protokoll erfasst **alles** einschließlich Stempeln und Anmeldungen, zeigt aber die Eingriffe zuerst. Mitarbeitende sehen den eigenen Datensatz.

## Craft notes aus dem Bau

- **Abgestufte Sichtbarkeit gehört in die Nutzlast, nicht in die Anzeige.** Die Art einer fremden Abwesenheit wird für Nicht-Verwaltung am Server auf `null` gesetzt, statt im Browser ausgeblendet zu werden: was ankommt, ist einsehbar, und der Unterschied Urlaub/Krank ist Art. 9 DSGVO. Denselben Grundsatz trägt `protokollSeite({sichtbarFuer})`: der Zuschnitt steht im SQL.
- **Die Unveränderbarkeit gehört ins Schema.** Zwei Trigger weisen UPDATE und DELETE ab. Eine Regel, die nur in der Anwendung steht, gilt nur, solange alle durch die Anwendung gehen — und die Hashkette fängt genau den, der es nicht tut.
- **Die Spanne als ein Balken las sich als leeres Eingabefeld.** Weiß gefüllt mit dünner Kante über hundert Pixel: der erste Bau sah aus wie ein Formularfeld in der Zeile. Als Tageszellen hat sie einen Takt, und die beiden Kanäle (Füllung = kostet etwas, Kante = steht fest) kreuzen sich nie.
- **Die Spaltenbreiten waren gegen die falsche Breite gerechnet.** 704 px verlangt, 640 px vorhanden — die Folge war keine enge Spalte, sondern eine mit Breite **null**: der Gegenstand stand nirgends und die Zeile lief 72 px über ihren Rahmen. Gemessen im Browser, nicht geschätzt. Behoben wurde es nicht durch Schrumpfen, sondern indem zwei Personenspalten zu einer wurden: in den allermeisten Zeilen stand zweimal derselbe Name, weil die meisten Menschen ihren eigenen Datensatz bearbeiten. Jetzt steht der Name einmal, und die zweite Zeile („betrifft …") erscheint nur im seltenen, interessanten Fall.
- **Ein unverändertes Feld stand zweimal nebeneinander** („Arbeit  Arbeit") und ließ die eine geänderte Zeile untergehen. Jetzt einmal, in Sekundärtinte.
- **Die lange Einheit erschlug die Zahl auf dem Telefon.** „Eingriffe im Zeitraum" bzw. „von 9 heute abwesend" stehen in `large` neben einer Anzeigenzahl, die auf 390 px schrumpft — dieselbe Lehre wie beim Urlaubsanspruch. Jetzt „Eingriffe" bzw. „von 9", der Rest in der Standzeile.
- **Die Spaltenüberschriften fallen auf dem Telefon weg, die erste bleibt**: sie ist keine Beschriftung, sondern der Schalter für die Reihenfolge. Eine Fähigkeit, die auf dem Telefon verschwindet, ist eine verlorene Fähigkeit.
- Der Installationshinweis reitet auf derselben 0fr↔1fr-Faltung wie der Navigationseintrag und die Stempelleisten-Übergabe — die dritte Verwendung derselben Bewegung, ausdrücklich keine vierte Idee.

## In der Prüfung gefunden und behoben (2026-08-06)

- **Das schwerste Loch war die eigene Sicht auf das Protokoll.** Sie lautete „betrifft mich ODER ich habe es getan" — und weil das Protokoll den Gegenstand beschreibt, *bevor* die Domäne die Berechtigung prüft (es muss: hinterher gibt es den Datensatz womöglich nicht mehr), landete jeder abgewiesene Griff nach fremden Daten mitsamt Beschreibung im Protokoll des Angreifers. Wer „Krankmeldung 4711 löschen" versuchte, bekam „Keine Berechtigung." und las anschließend „Krank 10. – 14. August, Bert Klein" im eigenen Protokoll; bei fortlaufenden Kennungen war so die ganze Belegschaft abfragbar. Die Sicht geht jetzt allein über `betroffen_id`. Nichts geht dabei verloren: was jemand am eigenen Datensatz tut, trägt ohnehin die eigene Kennung — und was er an einem fremden versucht hat, soll die Verwaltung sehen, nicht er.
- **Das Band zählte nach dem falschen Tag.** `GROUP BY datum` band den Bezeichner an die gleichnamige *Spalte* (den Geschäftstag), nicht an das `AS` über `substr(ts,1,10)`. Ein heute vorgenommener Juli-Abschluss saß damit im Juli, und alle Zeilen ohne Geschäftstag fielen in einen Topf. Jetzt wird über den Ausdruck gruppiert.
- **`?suche=a&suche=b` warf eine 500.** Next reicht wiederholte Parameter als Feld durch; `einParameter()` in `lib/format.ts` nimmt jetzt den ersten, und `istMonat()` fängt zusätzlich „2026-13" ab, das die reine Formatprüfung passierte und in `Invalid Date` lief.
- **Der CSV-Auszug endete stillschweigend bei 500 Zeilen** — bei fünfzig Mitarbeitern ist ein Monat vierstellig, und die Datei enthielt die *ältesten* 500 und sah vollständig aus. Jetzt wird vollständig geblättert.
- **Formeleinschleusung ohne Zugangsdaten.** Das Protokoll hält die bei einer gescheiterten Anmeldung eingegebene Adresse fest — jeder, der das Anmeldefeld erreicht, konnte damit `=cmd|…` in eine Zelle der Datei schreiben, die die Verwaltung in Excel öffnet. `feld()` stellt führenden Formelzeichen ein Apostroph voran.
- **„Zurück am" rechnete auf der beschnittenen Spanne.** Ein Urlaub bis zum 15. September meldete im August-Blatt „zurück am 1.9." — mitten aus dem Urlaub heraus. Gerechnet wird jetzt auf der ungeschnittenen Spanne und mit dem Feiertagskalender der *abwesenden* Person statt dem der lesenden.
- **Der weggeklickte Installationshinweis blieb tastaturerreichbar.** `grid-template-rows: 0fr` versteckt fürs Auge, nicht für den Fokus; die zwei Schaltflächen tauchten beim Durchtabben als unsichtbare Stationen auf. Er hängt sich jetzt nach der Faltung ab, wie `ausklapp.tsx` es für die Stapel tut.
- **Die Jahresachse war Brei.** `schritt: 5` ergab auf 365 Tagen dreiundsiebzig Zahlen in einer ununterbrochenen Ziffernkette. Ab 62 Tagen beschriftet die Achse Monate — in beiden Bändern, aus demselben Modul, damit sie nicht auseinanderlaufen können.
- Kleineres: „Filter zurücksetzen" warf auch den Zeitraum weg; `betroffen: null` (Einstellungen) wurde still zur handelnden Person; unveränderte Felder standen doppelt nebeneinander.

Nicht behoben, weil außerhalb dieses Umbaus: `?monat=2026-13` lässt aus demselben Grund auch `/abwesenheit` und `/spesen` auflaufen (dort steht dieselbe kopierte Zeile), und der `auFehlt`-Zähler in der Seitenleiste kennt keine zeitliche Grenze.

## Verified in the browser (2026-08-06)

Voller Rundlauf auf der Entwicklungsdatenbank bei 1440 px und bei echten 390 px: Einstempeln, Ausstempeln und eine Korrektur (16:00 → 17:30) erzeugten drei Protokollzeilen; die aufgeklappte Zeile zeigt die Gegenüberstellung mit dem Siegel; „Kette prüfen" meldet „3 Zeilen geprüft, Kette ungebrochen"; der Schalter „Auch das Stempeln" blendet die Routine dazu; die CSV liefert deutsche Kopfzeile und das Siegel je Zeile. Im Teamkalender wurden die zwölf Kalendertage einer Urlaubsspanne als acht gefüllte und vier leere Zellen gemessen — genau die acht Tage, die die Liste nennt.

Die abgestufte Sichtbarkeit wurde **an der Nutzlast** nachgewiesen, nicht am Bild: als Mitarbeiterin angemeldet enthält das ausgelieferte Markup der Kalenderseite **null** Vorkommen von „urlaub", „krank", „freizeitausgleich" oder „fortbildung", und die Bahnbeschriftung für einen Kollegen lautet „Dev Prüfung: abwesend 6. – 17. August". Dieselbe Sitzung zeigt im Protokoll die eigene Rail ohne Kettenprüfung und ohne Ausgabe, keine Personenfilter und keine fremde Zeile.

## Unresolved (do not invent)

Aufbewahrungsfrist und Archivierung des Protokolls (bewusst keine Löschfunktion). Benachrichtigung, wenn jemand fremde Zeiten korrigiert. Eine Jahresansicht des Protokollbands, die bei 365 Tagen noch etwas erkennen lässt — sie funktioniert, ist aber dichter als nützlich. Halbe Urlaubstage bleiben auch im Teamkalender außen vor.
