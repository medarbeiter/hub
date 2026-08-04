---
version: 1
slug: "route"
primary_target: "route:/"
related_targets: ["route:/zeiten","route:/team","route:/abschluss","route:/berichte"]
---

# Surface: App-Skelett (Heute / Zeiten / Team / Abschluss / Berichte)

Mode: Operate (all screens).

Audience & job: 15–50 office employees of one German company clock in/out several times daily; Verwaltung reviews, corrects, locks months for payroll.

Direction: "Der Tag als Zeitleiste" (seed 63a37dc5, structure 3 of 7). The workday renders as a live vertical timeline — gold Arbeit segments, quiet Pause gaps, growing open segment, now-line. Stamp actions and corrections operate on the timeline itself. Team view compresses each employee's day into a horizontal mini-timeline row. Memorable moment: the open gold segment visibly growing under the now-line.

Visual authority: Astryx components with the built `medarbeiter` theme (theme/medarbeiterTheme.ts): white/warm-paper ground, brand gold #e1b025 accent (on-accent is dark ink), bronze text-gold #7c5f05, warm stone neutrals, Poppins headings/Figtree body, warnings shifted to orange. Logo assets: public/logo.png, public/logo-mark.png.

Model decisions: segments (arbeit|pause, date + minutes, never crossing midnight); forgotten clock-outs stay open as anomalies until corrected; Zeitkonto counts only recorded days; approval = corrections anytime + Monatsabschluss lock (read-only after).

Unresolved (do not invent): password reset, ArbZG rule enforcement (currently displayed, not enforced), PDF beyond the print sheet, absence types (Urlaub/Krank).

No comps were generated: the user declined image generation ("build the UI by yourself") — composition delegated to the build.

Finish review (2026-08-04): shipped. Two-round inspection + external reviewer cycle; six material fixes and two regressions all resolved, disposition "ship". Binding craft rules that came out of it: pause fills/ticks ≥3:1 (#8b8474), focus rings via --color-icon-accent, live-tip motion gated isOpen && isToday with reduced-motion fallback, DOM order = visual order (separate .nur-mobil stamp-card instance), fonts self-hosted via next/font, FieldLabel isRequired/isOptional unused (English hardcode), one primary button per view.
