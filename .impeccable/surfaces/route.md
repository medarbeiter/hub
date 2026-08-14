---
version: 1
slug: "route"
primary_target: "route:/"
related_targets: ["route:/zeiten","route:/team","route:/abschluss","route:/berichte"]
---

# Surface: App-Skelett (Heute / Zeiten / Team / Abschluss / Berichte)

Mode: Operate (all screens).

Audience & job: 15–50 office employees of one German company clock in/out several times daily; Verwaltung reviews, corrects, locks months for payroll.

Direction: "Der gestempelte Tag" (horizontal-strip evolution of seed 63a37dc5; hierarchy refactor 2026-08-04). Stamping lives in one persistent sticky clock strip on every route. Heute is built for the three-second visit: display-3 worked total + Feierabend prognosis over a compact horizontal day-strip (dynamic window from the day's entries) and dense entry rows; Woche/Monat zoom into a day-list + vertical editing timeline (trimmed window, drag-to-correct). Team view compresses each employee's day into a horizontal mini-timeline row. Memorable moment: the open gold block visibly growing toward the bronze now-marker.

Visual authority: Astryx components with the built `medarbeiter` theme (theme/medarbeiterTheme.ts): white/warm-paper ground, brand gold #e1b025 accent (on-accent is dark ink), bronze text-gold #7c5f05, warm stone neutrals, Poppins headings/Figtree body, warnings shifted to orange. Logo assets: public/logo.png, public/logo-mark.png.

Model decisions: segments (arbeit|pause, date + minutes, never crossing midnight — night shifts split at midnight on the next stamp, only from exactly yesterday within 12h); stamp fumbling merges away (2-min window, settings-configurable) and Ausstempeln is undoable 30s; older forgotten clock-outs stay open as anomalies until corrected; Zeitkonto counts days that are accounted for (entries or a day type), leaves unfinished days uncountable, and names what it excluded; approval = corrections anytime + Monatsabschluss lock (read-only after).

Unresolved (do not invent): password reset, PDF beyond the print sheet, team-wide ArbZG overview for Verwaltung, municipal holidays.

No comps were generated: the user declined image generation ("build the UI by yourself") — composition delegated to the build.

Finish review (2026-08-04): shipped. Two-round inspection + external reviewer cycle; six material fixes and two regressions all resolved, disposition "ship". Binding craft rules that came out of it: pause fills/ticks ≥3:1 (#8b8474), focus rings via --color-icon-accent, live-tip motion gated isOpen && isToday with reduced-motion fallback, DOM order = visual order, fonts self-hosted via next/font, FieldLabel isRequired/isOptional unused (English hardcode), one primary button per view.

Hierarchy refactor (2026-08-04, second pass): Heute+Zeiten merged into "Meine Zeit" (Tabs Heute|Woche|Monat, URL-driven); persistent ClockBar replaces StampCard (the .nur-mobil duplicate is gone — the bar is first in DOM on every breakpoint); greeting demoted, worked total + Feierabend prognosis promoted to the hero; tall Heute timeline replaced by the horizontal day-strip; running days framed forward, never as a deficit. Verified in-browser on desktop; the dedicated mobile pass is scheduled with Phase 3.4.

Phases 3–5 (2026-08-04, same session): ArbZG rule core (§4 breaks, §3 cap, §5 rest) as pure tested functions feeding a live Feierabend prognosis that includes the break still owed; an attention engine that names the past days needing correction (persistent dismissible banner, inline day banners, "next open day" chaining); day types + computed public holidays per Bundesland; a Zeitkonto that shows its own derivation including what was left out; mobile-first clocking (bar moves to the bottom edge below 920px, 44px targets); and a computed contrast audit that found three real failures — brand gold cannot reach 3:1 on a light ground, so meaning-carrying gold now wears a bronze hairline (.arbeit-flaeche), warning orange darkened to #dd7200, selected inset to #7c5f05.

Meine-Zeit restructure (2026-08-04, third pass). The four views of one question — Heute, Woche, Monat, Zeitkonto — looked like four products: the column topology flipped per tab, there were three page-header grammars and two navigators, one day was drawn both as a horizontal strip and as a 230px vertical gold slab, and the Zeitkonto lived outside the tab set entirely. Replaced with **one frame, four ranges** (`ZeitRahmen`: Kopf / Bühne / Belege / persistent right rail; ranges Tag · Woche · Monat · Konto). User decisions taken up front: full restructure, horizontal grammar only, direct manipulation plus an upgraded dialog, and one deliberate gold-wash exception for the header band.

What changed: `Tagesbahn` (band / zeile / buehne) replaces day-strip, mini-timeline **and** the vertical day-timeline, with drag-to-resize ported to the x axis and drag-across-free-track to record a new entry; Woche and Monat became stacks of lanes on one shared `spanOf()` axis with expand-in-place; Zeitkonto became the fourth range with a real Astryx `Table` and its prose moved into the rail; the tabs and three pagers merged into one `BereichsLeiste` (which finally lets the day zoom reach yesterday); `lib/period.ts` absorbed the countability arithmetic that was duplicated inside the old view component; unrecorded future working days are drawn as dashed plans rather than empty tracks; the standing attention banner stands down on `/`, where the Kopf, the day rows and the day banners already say it.

Caught in review and fixed, not worked around: the plan ghost's bronze edge measured 2.59:1 at 70 % opacity (it is no longer faded); the lane entrance animated opacity and left every row at 35 % when it did not tick (transform only now); the context rail was pushed below a month of lanes by flex min-content (the content row is an explicit `minmax(0,1fr) 320px` grid); the week header read 0:00 beside a lane showing 6:00 (headline figure now includes today, the saldo still does not).

Verified in the browser at 1904px and at 685px (nav collapses, clock strip moves to the bottom edge, rail follows the record, no horizontal overflow), including a live drag-to-create round trip that was deleted again afterwards. A true 390px viewport could not be reached in this environment; the narrow composition was checked by constraining the sheet instead.

Stempelleiste, Deckung (2026-08-05). The strip was saying things nothing needed said: "Nicht eingestempelt" stood a handbreadth from a button reading *Einstempeln*, and on "Meine Zeit / Tag" every remaining figure — elapsed, start, Feierabend — was already in the Kopf in display size and on the lane below it. Reworked from "what can the strip show?" to **what is not already on this screen**: the status word is gone (the next action names the state), the running dot merged into the "seit HH:MM" fact it belongs to, and a stopped day now says what it was missing — the Soll still to go, or the amount over it.

Deckung is the mechanism, and it is deliberately two-part. *Which range* comes from the URL via `zeitAusUrl()` in `lib/bereiche.ts`, shared with the page so the two cannot drift; being server-known, the strip leaves the server already correct and nothing flashes on hydration (the first attempt reported coverage from the client only, and the facts were visible until React took over). *Is the Kopf still on screen* comes from an IntersectionObserver with a Schmitt trigger (leaves below 0.5, returns above 0.92) so parking on the threshold cannot make the strip flutter; the melder reports before first paint (`useLayoutEffect`) so a route change never shows a frame of the wrong state. The ArbZG advisory and errors sit outside the collapsing group — the law is stated nowhere else, and an error belongs beside the action that raised it.

The handover is not a new motion: `grid-template-columns` 1fr→0fr on the desktop, `grid-template-rows` on the phone — the same track transition the sidebar's expanding item rides, turned to whichever axis the bar is laid out on. Two things had to be measured rather than assumed: a set `inline-size` (even `max-content`) makes the track intrinsic and `0fr` then does not collapse at all, so the desktop row is held in one line by `flex-wrap: nowrap` plus non-shrinking children instead; and a wrapped flex line of height 0 still costs its `row-gap`, which no negative margin cancels — the phone branch drops `flex-basis` to 0 at the end of the fold instead.

Since the dot now carries the running state alone, it is a meaning-carrying non-text surface: brand gold measures ~2:1 on the strip and never will do better, so it wears the house bronze hairline. Both pairings added to `tests/kontrast.test.ts`.

Verified in the browser: the strip is empty of facts on Tag/today and carries them on Woche, Konto and Spesen, server-rendered correctly with no hydration flash; the scroll handover was traced in both directions with the transition mid-flight. Note for future sessions — an IntersectionObserver does not deliver in a backgrounded tab, so this check only means anything with the Chrome window actually in front.
