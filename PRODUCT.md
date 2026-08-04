# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js (App Router) with React and TypeScript, run and installed via Bun (`bun install`, `bun run dev`). UI built on the Astryx design system: `@astryxdesign/core` components with `@astryxdesign/theme-neutral`, conventions documented by `@astryxdesign/cli init`. User-committed decision (2026-08-04), superseding the earlier `Bun.serve()` HTML-imports plan.

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

- Two roles: `mitarbeiter` (sees own time) and `verwaltung` (sees and corrects everyone, locks months, exports).
- Auth: email/password with hashed passwords (argon2 via `Bun.password`) and 30-day session cookies.
- Sollzeit: per-employee weekly minutes (`users.weekly_minutes`), spread over Mo–Fr.
- **Zeitkonto counts days that are accounted for**: days with entries, plus days with a day type. Urlaub/Krank/Feiertag set the effective Soll to 0, Fortbildung counts as having worked it, Freizeitausgleich spends it. A past day with an unfinished entry is uncountable (never counted as zero) and a working day with neither entry nor day type is excluded — both are named on the Zeitkonto page instead of hidden behind a footnote.
- Forgotten clock-outs stay open as **anomalies**; they block Monatsabschluss and surface as warnings until manually corrected. One exception: a segment still open from exactly yesterday within 12 h elapsed counts as a running night shift and is split at midnight on the next stamp action — anything older is never auto-closed.
- Segments never cross midnight; times are server-local (Europe/Berlin deployment).
- Language: German only. Astryx built-ins are localized via `locales/de.json`; the English-hardcoded Required/Optional field indicators are deliberately unused.

Decided since (2026-08-04 refactor):

- **ArbZG rules warn, never block** (§4 breaks, §3 10-hour cap, §5 11-hour rest). The app documents what happened; a violation is flagged and can carry a reason, never refused.
- **Absence types are in scope**: Urlaub, Krank, Feiertag, Freizeitausgleich, Fortbildung, plus computed public holidays per Bundesland (company setting, per-employee override). How each meets the Soll is defined in `lib/daytypes.ts`.
- **Forgotten clock-outs** may be closed provisionally at a configurable cutoff (off by default), always flagged "bitte bestätigen" — never silently accepted.

Open decisions (record here when decided; do not invent):

- Password reset / password policy (currently: Verwaltung resets by hand).
- Whether Verwaltung should see ArbZG flags for the whole team in one place (today they surface per employee).
- Municipal holidays (Fronleichnam in parts of SN/TH, Mariä Himmelfahrt in Bavarian communities, Augsburger Friedensfest) — entered by hand as Feiertag rather than guessed per Bundesland.
- Hosting/deployment target.

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
