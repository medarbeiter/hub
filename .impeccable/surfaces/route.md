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
