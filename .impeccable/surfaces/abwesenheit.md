---
version: 1
slug: "abwesenheit"
primary_target: "route:/abwesenheit"
related_targets: ["route:/abwesenheit/pruefen", "route:/", "route:/berichte"]
---

# Surface: Abwesenheit (Urlaub, Krank, Freizeitausgleich, Fortbildung)

Mode: Operate (both screens).

Audience & job: the same 15–50 office employees. They need to say "I am away from the 6th to the 17th" once, know what it costs them before they ask, and get an answer. Verwaltung needs to see who is away, decide the requests, and find the absences on the payroll sheet where they were previously missing entirely.

## What was wrong

Day types were set one day at a time, from a 200 px `Selector` of six near-identical German nouns living permanently in the toolbar of every day — on roughly 230 ordinary working days a year where the answer is "Arbeitstag". Booking a fortnight meant navigating to fourteen dates and choosing fourteen times, and nothing in the record knew the fourteen belonged together. `day_types` had primary key `(user_id, date)`: one row, one day, no concept of an absence.

Three further things the dropdown hid. It flattened acts of different kinds — Krank and Fortbildung *report* a fact, Urlaub and Freizeitausgleich *request* something and spend a balance, Feiertag is *derived* — into one flat list, asserting they were the same decision. It let an employee write `feiertag` by hand, a one-click path to a fabricated paid day off that reads as calendar-derived. And it had no governance at all: someone could mark twenty days Urlaub, the Zeitkonto would go quiet, and no manager was ever told. Meanwhile `dayTypeCounts()` — the one payroll-facing summary — had shipped with the day types and was called by nothing.

## Direction

The Reise had already solved this shape next door: a span record with an owner, a reviewer, four states, files behind a guard, and a queue. An absence is architecturally its sibling, so it wears the same grammar rather than inventing a second one.

`abwesenheiten` (von/bis, art, status) is the record. `day_types` survives as its **projection** and is rebuilt wholesale for a touched range rather than patched — `lib/time.ts`, `lib/attention.ts` and the Zeitkonto did not change one line. Hand-written rows (calendar corrections) are never overwritten.

One thing is deliberately *not* copied: the temporal guard inverts. A trip may only be submitted once it is over; an absence is requested before it begins. Same four states, mirrored condition, and `einreichen` therefore checks no window at all.

## Decisions taken up front (user, 2026-08-06)

Full approval workflow; entitlement modelled per employee; entry via drag on the month stack **and** an own surface; AU certificates stored through the receipt pipeline. Whole days only (half days rejected as the most expensive answer for the least gain — someone wanting a half day works the morning and takes Freizeitausgleich, which the Zeitkonto already handles honestly). § 9 BUrlG refunds automatically. Deduction on approval with a flat yearly entitlement and a manually entered carry-over — no accrual engine, no forfeiture date. A locked month stays absolutely read-only; a late certificate means Verwaltung unlocks, records, relocks.

## Craft notes that came out of the build

- **The gesture had to move.** Selecting days by dragging across the lanes would have collided with `Tagesbahn`'s existing drag-to-create, leaving a slightly diagonal drag to decide between "recorded four hours" and "requested a week off". The selection lives on the date gutter instead, which meant lifting that column out of the row's expand button. `touch-action: none` is what makes the gesture exist on a phone at all. A plain click on one day does the same job, so nothing lives only in the drag.
- **Astryx dialogs clip rather than scroll.** `Dialog` caps at 75vh and its inner column is `overflow: hidden`; measured in the browser, the absence editor was 770 px of content in a 540 px window with the save button below the cut. Both computing editors grow with their input, so `.tafel-rumpf` was added and applied to the Reise editor too, where the same bug was latent for any trip over about a week.
- **`getSessionUser()` was selecting an explicit column list that omitted `bundesland`** — so the per-employee Bundesland override had never applied on the logged-in user's own pages. Found because the entitlement field would have landed in the same hole. Fixed there and in `allUsers()`/`getUser()`.
- **The headline figure was said twice.** The Kopf's display-1 "30 von 30 Urlaubstagen frei" and a rail card repeating it in display-3. The rail now carries only the derivation, the same split the Zeitkonto already uses.
- Contrast: the new band cells, day fields and the selected day row are all stone and gold-wash, added to `tests/kontrast.test.ts` like every other meaning-carrying surface.

## Verified in the browser (2026-08-06)

Full round trip on the dev database: span created from a dragged selection, derivation correct (8 of 12 calendar days, weekends dashed, 30 → 22), saved as Entwurf, submitted (shown as beantragt and *not* deducted), approved from the queue with the self-approval notice, projected onto twelve day rows, and the month stack's week header dropping from 40 to 24 hours because two of its days became leave. The gutter drag was driven through synthetic pointer events across three rows and landed on `/abwesenheit?von=…&bis=…` with the editor open.

## UI-Durchgang (2026-08-06, nach dem Bau)

Systematisch durchgesehen bei 1280 px und bei echten 390 px. Gefunden und behoben:

- **Das Band verschwand auf dem Telefon.** Bei 390 px blieben ihm gemessene **0 px**, und die sechs Achsenzahlen lagen alle an derselben Stelle übereinander. Vier feste Spalten fraßen die Zeile. Unter 860 px bekommen Band und Achse jetzt je eine eigene Zeile (`.spannen-zeile`/`.spannen-achse`, ohne `order` — der Umbruch bricht, nicht die Reihenfolge): 0 → 334 px, fünf Überlappungen → keine. Dieselbe Krankheit hatte der Reisenstapel; er ist mitbehandelt.
- **Die festen Spalten waren zu breit.** Nachgemessen statt geschätzt (breiteste Statusmarke 104 px) und getrimmt; das Band gewinnt auf dem Schirm 201 → 241 px.
- **Zwei Datumsfelder passten nicht nebeneinander.** Astryx' `DateInput` trägt 180 px Mindestbreite, die `width="100%"` nicht unterschreitet — 346 px Inhalt in 319 px Tafel, mit Querbalken. Unter 520 px stehen sie untereinander.
- **Zeichen in umbrechenden Auswahlzeilen rutschten zwischen die Zeilen.** Astryx zentriert `startContent` über die volle Höhe; bei zweizeiliger Beschreibung stand das Zeichen neben nichts (Versatz 17 px statt 2 px). Gilt jetzt für alle vier Arten gleich — auch in der Rail-Legende, wo dasselbe Muster steckte.
- **Die Goldwäsche des offenen Tages begann 88 px zu spät**, seit die Datumsspalte ein eigenes Ziel ist: das Datum blieb weiß, ein Riss quer durch die Zeile. Die Hinterlegung sitzt jetzt an der ganzen Reihe.
- **„0 Tage krank"** stand da, wo nichts war — gegen die eigene Regel, dass eine Null keine Nachricht ist.
- **Dieselbe Handlung hieß zweimal anders** („Abwesend an diesem Tag" gegen „Abwesenheit erfassen"), und die Tagesart stand auf dem Tagesblatt doppelt (Marke im Kopf plus Fließtext daneben).
- **Der Knopf verschwieg, was er tut**: eine Meldung gilt sofort, hieß aber „Speichern" — jetzt „Krank melden" bzw. „Fortbildung melden".
- **Ein nach unten zeigender Winkel neben „Zuklappen"** sagte das Gegenteil dessen, was er tat.
- **„Rest danach" stimmte nicht** für bereits entschiedene Anträge, und der Selbstgenehmigungs-Hinweis stand in der Erlaubnisform, obwohl die Entscheidung längst gefallen war.
- **Die Zahl stand dreimal** auf einem Blatt (Kopf, Kartentitel, Summenzeile).
- **Ein künftiger Tag im Monatsstapel schrieb eine lügende Adresse**: `?tag=` in der Zukunft, die Tagesansicht fällt auf heute zurück, beim Neuladen landete man wortlos woanders. Seit Abwesenheiten in der Zukunft liegen dürfen, war das kein Randfall mehr. Der Stapel schreibt für künftige Tage keine Adresse mehr.

Nachgereicht, nachdem die Auswahlliste als „kaputt" gemeldet wurde:

- **Das Artzeichen war im falschen Register.** `groesse="zeile"` ist im Vokabular ausdrücklich „für dichte Zeilen neben 13-px-Text"; hier stand es neben einer 14-px-Beschriftung und einem 23-px-Auswahlkreis. Mit gemessenen 13,3 px in `sekundaer`-Grau (#737373) war es das kleinste **und** blasseste von drei Zeichen in einer Reihe — es las sich als Darstellungsfehler, nicht als Zeichen. Jetzt `normal`/`primaer`: Beschriftungsgröße, Beschriftungstinte. Verzerrt war nie etwas (13,3 × 13,3, quadratisch) — die Ursache war Gewicht, nicht Geometrie. Neue Paarung in `tests/kontrast.test.ts`.
- **`?von=&bis=` öffnete den Editor nur beim ersten Einhängen.** Der Anfangswert eines `useState` wird bei einem Wechsel innerhalb derselben Route nicht neu gelesen — wer schon auf der Seite stand und die Abkürzung in der Navigation nahm, bekam nichts. Verglichen wird jetzt die Spanne selbst, damit ein Schließen die Tafel nicht sofort wieder aufreißt.
- **„1 von 1 Kalendertag sind Arbeitstage".** Substantiv im Singular, Verb im Plural. Substantiv richtet sich jetzt nach der Gesamtzahl, Verb nach den Arbeitstagen.

Stehen geblieben (bewusst, außerhalb dieses Umbaus):

- Auf einem genehmigten Urlaubstag verhält sich die Tagesansicht wie an einem gewöhnlichen Arbeitstag — Anzeigezahl „0:00", Standzeile „Noch nicht eingestempelt", Einladung zum Einstempeln. Falsch ist nichts davon (man *darf* im Urlaub arbeiten, und es zählt als Überstunde), aber der Kopf sagt nicht, dass der Tag längst verbucht ist.
- Jede Route hinterlässt nach der Hydration eine zweite, nulldimensionale Kopie ihres Inhalts in einem `div#S:0` unterhalb von `<body>` (Next-Streaming im Entwicklungsmodus; der Server liefert nur eine). Betrifft alle Routen, auch unberührte.

## Unresolved (do not invent)

Half days; accrual and forfeiture automation; notification of any kind when a request is decided.

Erledigt am 2026-08-06: der teamweite Abwesenheitskalender. Er liegt unter `/kalender` und ist **nicht** auf die Verwaltung beschränkt geblieben — „wer ist nächste Woche da" ist die Frage eines Kollegen. Abgestuft: die Art einer fremden Abwesenheit wird für Nicht-Verwaltung gar nicht erst an den Browser geschickt. Siehe `.impeccable/surfaces/protokoll.md`.
