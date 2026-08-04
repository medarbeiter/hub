---
name: MedArbeiter Zeiterfassung
description: Warm-paper time tracking where brand gold paints the worked day itself.
colors:
  brand-gold: "#e1b025"
  on-gold-ink: "#231a02"
  bronze-text-gold: "#7c5f05"
  gold-icon: "#8f6e06"
  selected-gold: "#b9900e"
  gold-wash: "#f7edd2"
  warm-ink: "#1c1917"
  stone-secondary: "#67625a"
  stone-disabled: "#a8a29e"
  paper-body: "#faf8f3"
  surface-white: "#ffffff"
  muted-parchment: "#f5f2ea"
  pause-stone: "#8b8474"
  border-hairline: "#1c191714"
  border-emphasized: "#d8d2c6"
  warning-orange: "#e97a00"
  warning-text: "#6e3500"
  error-red: "#e33f4a"
  error-text: "#a50c25"
  error-wash: "#facecb"
  success-green: "#198100"
  info-blue: "#0074e2"
typography:
  heading:
    fontFamily: "Poppins, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
  body:
    fontFamily: "Figtree, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    fontSize: "14px"
  code:
    fontFamily: "ui-monospace, 'SF Mono', Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace"
rounded:
  none: "0.25rem"
  inner: "0.375rem"
  element: "0.625rem"
  container: "0.75rem"
  page: "1.75rem"
  full: "9999px"
components:
  button-primary:
    backgroundColor: "{colors.brand-gold}"
    textColor: "{colors.on-gold-ink}"
  button-destructive:
    backgroundColor: "{colors.error-wash}"
    textColor: "{colors.error-text}"
  badge-warning:
    backgroundColor: "{colors.warning-orange}"
    textColor: "#171717"
  statusdot-accent:
    backgroundColor: "{colors.brand-gold}"
  timeline-segment-arbeit:
    backgroundColor: "{colors.brand-gold}"
    textColor: "{colors.on-gold-ink}"
    rounded: "{rounded.element}"
  timeline-segment-pause:
    backgroundColor: "{colors.muted-parchment}"
    textColor: "{colors.stone-secondary}"
    rounded: "{rounded.element}"
---

# Design System: MedArbeiter Zeiterfassung

## Overview

**Creative North Star: "Der gestempelte Tag" (The Stamped Day)**

The workday itself is the interface. Instead of a form beside a stats grid, the employee's day is rendered as a live stamped band: gold blocks are worked time, quiet stone blocks are breaks, and a bronze now-marker moves as the clock runs. On Heute that band is a compact horizontal day-strip under the day's big total (the three-second read); in the day detail it expands into the vertical editing timeline; every other surface restates the same grammar at another scale — a mini-band per team member, quiet week bars against a Soll tick. Stamping itself lives in one persistent clock strip on every page.

The world is warm and papery, not clinical: white cards float on a barely-warm paper body with warm stone neutrals, so the single brand color — MedArbeiter gold #e1b025 — can mean exactly one thing. Gold is worked time and the primary action; it is never decoration and never a status color. The tone is calm, trustworthy, and payroll-serious: tabular numerals everywhere times appear, one authored motion moment, German-only voice.

Built on Astryx components with the MedArbeiter theme; light mode is forced at the provider (`mode="light"`), so the shipped world is exclusively the light palette below.

**Key Characteristics:**
- One accent, one meaning: gold = Arbeit + primary action, nothing else.
- Warm stone neutrals on a paper ground (#faf8f3 body, white surfaces), never cold gray.
- Timeline grammar repeated at three scales (day, mini-band, week bars).
- Poppins headings (wordmark kinship), Figtree body, tabular numerals for all times.
- Quiet motion: one breathing live-tip; everything else is fast, functional transitions.

## Colors

A single warm gold voice over a warm-paper neutral spine, with status colors deliberately pushed away from the brand hue.

### Primary
- **Brand Gold** (#e1b025): worked-time segments, the primary stamp button, progress fill, and the "eingestempelt" StatusDot. The dark-mode token slot is #e5bc44, present in the theme but unshipped (light mode forced).
- **On-Gold Ink** (#231a02): the only text/icon color allowed on gold surfaces — white on gold fails AA.
- **Bronze Text-Gold** (#7c5f05): gold demoted to text grade; clears 6:1 on white. Used for accent text, links, the positive Zeitkonto figure, and the now-line + now-pill on the timeline.
- **Gold Icon** (#8f6e06): accent-colored icons.
- **Selected Gold** (#b9900e): focus rings and selected insets — darker than brand gold so a 2px ring clears 3:1 on white.
- **Gold Wash** (#f7edd2): the accent's pastel surface tint (`--color-accent-muted`).

### Neutral
- **Warm Ink** (#1c1917): primary text.
- **Stone Secondary** (#67625a): secondary text; **Stone Disabled** (#a8a29e) for disabled text.
- **Paper Body** (#faf8f3): the app canvas — white with the marketing site's warm cast, not a gray ladder.
- **Surface White** (#ffffff): cards, popovers, interactive surfaces.
- **Muted Parchment** (#f5f2ea): muted fills — Pause blocks on the day timeline, timeline track backgrounds.
- **Pause Stone** (#8b8474): solid pause fill in mini timelines and the Soll tick in week bars; chosen to clear ≥3:1 on the muted track so pauses are findable at a glance.
- **Border Hairline** (#1c191714): default borders — warm ink at 8% alpha. **Border Emphasized** (#d8d2c6): dashed pause outlines, switch/progress tracks.

### Status (never gold)
- **Warning Orange** (#e97a00 filled, #6e3500 text, #fad0b5 wash): warnings live in the orange family so status never impersonates brand gold. Warning badges/dots use dark ink #171717 on the orange fill.
- **Error Red** (#e33f4a filled, #a50c25 text, #facecb wash): errors, negative Zeitkonto, destructive actions.
- **Success Green** (#198100 filled with white text): success badges, dots, progress.
- **Info Blue** (#0074e2 filled with white text): info banners/badges only — the StatusDot "accent" variant is redirected to brand gold instead, so a clocked-in dot speaks the same color as the segments it summarizes.

### Named Rules
**The Gold-Is-Work Rule.** Brand gold #e1b025 appears only as worked time and the primary action. No status color, chart color, or decoration may use gold or yellow; warnings are orange. If something is gold, it is work.

**The Dark-Ink-On-Gold Rule.** Text or icons on a gold surface are always #231a02. White on gold fails AA and is forbidden.

**The Three-Golds Rule.** Gold degrades by duty, not by taste: fill #e1b025, text/now-line bronze #7c5f05 (icons #8f6e06), focus/selected #b9900e. Never use fill-gold at text size or bronze as a fill.

## Typography

**Heading Font:** Poppins (with -apple-system / Segoe UI / Roboto sans fallbacks) — wordmark kinship with the MedArbeiter logo.
**Body Font:** Figtree (same fallback stack) — long-form legibility at data density.
**Code Font:** ui-monospace stack.

**Character:** Geometric-friendly warmth. Poppins gives headings the rounded confidence of the wordmark; Figtree keeps dense time tables quiet and readable. Both are self-hosted via `next/font` (no runtime Google requests) and reach the theme through the `--font-poppins` / `--font-figtree` CSS variables.

### Hierarchy
- **Scale:** base 14px, ratio 1.2, generated by the Astryx typography scale.
- **Headings** (Poppins, loaded weights 500/600/700): on Heute the h1 *is* the display-3 worked-hours figure — the most informative number owns the page; the greeting is a supporting line above it. Other pages use a quiet h1 ("Meine Zeit", "Team"). h2 for card titles, h3/h4 explicitly bold (theme override).
- **Display-3** is the number voice: the big worked-hours figure and the Zeitkonto balance, always with tabular numerals.
- **Body / Supporting / Label** (Figtree, 14px base): supporting-secondary carries dates, "seit HH:MM", and axis labels; label-sm-semibold carries in-segment time ranges.

### Named Rules
**The Tabular Time Rule.** Every time or duration — axis labels, segment ranges, week totals, the now-pill, Zeitkonto — renders with tabular numerals (`hasTabularNumbers`). Times never wiggle as they tick.

**The German Voice Rule.** The UI is German-only (`lang="de"`, locale `de`). Astryx built-in strings are covered by a partial catalog in `locales/de.json`; any new built-in string an Astryx component surfaces must be added there, never left English.

## Layout

Sidebar app shell: a SideNav on the left (logo mark 28px + "MedArbeiter / Zeiterfassung" heading, lucide icons, role-gated "Verwaltung" section, user + Abmelden in the footer), content pages to the right.

Every authenticated route opens with the **sticky clock strip** (`.stempel-leiste`): StatusDot, "Eingestempelt seit HH:MM", today's elapsed time, and the state-coupled stamp actions. It is the single place stamping happens and stays reachable while scrolling.

"Meine Zeit" (`/`) is one page with three URL-driven zooms (Tabs Heute | Woche | Monat). The Heute zoom is the canonical composition, built for the three-second visit: a supporting greeting line, then the display-3 worked-hours figure with "von Soll" and the Feierabend prognosis, the day as a compact horizontal **day-strip**, the entries as dense rows, and a fixed 340px right rail (`.heute-rail`) stacking WeekStrip and ZeitkontoCard — today, the week, and the balance in one glance, no scrolling. Woche/Monat share a day-list + day-detail shell (the vertical timeline lives there).

Spacing rides the Astryx `--spacing-N` scale; the theme tightens Card and Section padding to `--spacing-3`, while the primary cards on Heute opt up to padding 4.

**Responsive:** one breakpoint at 920px, where the right rail goes full-width. The clock strip is first in DOM and viewport on every breakpoint, so the primary action needs no mobile duplicate and focus order always matches visual order.

**The Strip-Comes-First Rule.** The clock strip is the one home of stamp actions; no view renders a second stamp control. A running day is framed forward ("noch H:MM", "Feierabend ca. HH:MM") — a signed minus appears only once the day is over or Soll is met.

## Elevation & Depth

Light-mode depth is quiet and structural: white surfaces float on the tinted paper body, lifted by soft two-layer drops, with warm hairline borders doing most of the separation. On the timeline, elevation is semantic — gold Arbeit blocks carry `--shadow-low` (they are the substance of the day), while Pause blocks are flat with a dashed outline (they are absence).

### Shadow Vocabulary
- **Low** (`0 2px 4px oklch(0 0 0 / 5%), 0 4px 8px oklch(0 0 0 / 10%)` + transparent inset): cards, work segments.
- **Med** (`0 2px 4px / 5%, 0 4px 12px / 10%`): popovers.
- **High** (`0 4px 6px / 10%, 0 12px 24px / 15%`): modals/dialogs.
- **Inset rings** (2px inset): hover `#e1b0254D`, selected `#b9900e99`, success `#1981004D`, warning `#e97a004D`, error `#e33f4a4D`. Interactive rows (`.zeile-interaktiv`) hover with `--color-overlay-hover` and focus with a 2px #b9900e outline (offset −2px).

(The theme also defines a dark-mode "bezel" inset vocabulary via `light-dark()`; it is dormant while light mode is forced.)

**The Work-Casts-A-Shadow Rule.** On any timeline, only Arbeit lifts (shadow-low); Pause stays flat and dashed. Depth encodes the same meaning as color.

## Shapes

Nothing is truly square: even `--radius-none` is 0.25rem. The ladder runs inner 0.375rem → element 0.625rem → container 0.75rem → page 1.75rem → full pill. Timeline segments use element radius (0.625rem); tracks, bars, mini-timelines, and the now-pill are full-radius pills. Pause is the one outlined shape in the system — a dashed `--border-emphasized` border on muted parchment.

## Components

### Buttons
- **Primary:** brand gold fill with dark ink #231a02; in the clock strip it is *state-coupled* — its label is exactly the one legal action (Einstempeln / Ausstempeln / Pause beenden), with the alternative demoted to a secondary button beside it. One primary per view.
- **Secondary:** bordered neutral (Astryx default) — "Pause starten", banner actions, and the one shared `AddEntryButton` ("Eintrag hinzufügen", Plus icon, sm) on every surface.
- **Ghost:** low-key utility actions — "Bearbeiten" row buttons, "Abmelden".
- **Destructive:** locked pastel treatment — error wash #facecb background with dark error text #a50c25, not a filled red.

### StatusDot
Fills match the filled semantic badges so dot and badge speak one status language: success #198100, warning orange #e97a00, error #e33f4a — and **accent is brand gold #e1b025**, pulsing while eingestempelt. Neutral keeps the component's visible mid-gray.

### Badges
Semantic badges are filled saturated chips (info blue/success green/error red with white text; warning orange with dark ink). Categorical badges are pastel surface + dark colored text via the per-hue tokens.

### Cards / Containers
White, container radius, shadow-low, theme-default padding spacing-3 (Heute cards use 4). Cards are the only wrapper — no nested panel-in-panel.

### Banner
Hue-tinted pastel surface with matching dark colored text (warning: #fad0b5 wash, #584400/#6e3500-family text). Used for the "Offener Eintrag / Ausstempeln vergessen" anomaly with an inline secondary "Jetzt korrigieren" action.

### Inputs / Fields
Astryx defaults on white; status borders/icons ride the global success/error/warning tokens (all six combinations verified ≥3:1). **Astryx `FieldLabel` hardcodes English "Required"/"Optional", so its `isRequired`/`isOptional` props are intentionally unused** — requiredness is conveyed in German copy instead.

### Navigation
Astryx SideNav; lucide-react icons (CalendarDays, Users, LockKeyhole, ChartNoAxesColumn, UserRoundCog); selection tracked from the pathname; one "Meine Zeit" item (its section header always hidden), the Verwaltung section only for that role. Inside "Meine Zeit", the Heute | Woche | Monat zoom is a `TabList` of anchor tabs — URL-driven navigation, not client state.

### Day-Strip (signature)
The Heute surface's day at a glance: a horizontal `figure` (~72px) with an hour axis on top, a full-radius muted track, and the entries as clickable blocks — gold Arbeit (running block fades toward white, inline HH:MM–HH:MM label when wide enough), pause-stone Pause, 2px gaps between flush neighbours. The visible window derives from the day's entries ± 30min (hour-rounded, minimum six hours); an empty afternoon is never rendered. The 2px bronze now-line carries its time pill in a lane *below* the track, never over an entry; the Feierabend projection is a quiet dashed tick (its concrete time lives in the hero line). Empty today shows a dashed gold ghost at the usual start.

### Day-Timeline (signature, detail scale)
Vertical `figure` in the Woche/Monat day detail: left 56px time axis, hairline hour rules, absolutely positioned segments (min-height 6px; labels ≥34px, top-aligned ≥56px; 2px seams between flush neighbours; hover ring + pencil affordance). Window trimmed the same way as the day-strip. Open segments get the gold gradient and the breathing live-tip. The now-pill sits in the axis gutter — it never overlaps an entry or its label. Closed segments drag at their edges (5-min snap).

### Mini-Timeline / Week-Strip (signature, derived)
Mini-timeline: a full-radius muted track (`role="img"` with a German segment summary), gold spans for Arbeit (running span fades toward white), solid pause-stone #8b8474 for Pause, 2px bronze now-tick. Week-strip: per-day 10px pill tracks, gold fill vs a 2px pause-stone Soll tick, today's row in accent semibold with a gradient fill.

## Do's and Don'ts

### Do:
- **Do** paint worked time, the primary action, and the clocked-in StatusDot in brand gold #e1b025 — and nothing else.
- **Do** put dark ink #231a02 on every gold surface, and use bronze #7c5f05 whenever gold must act as text or a thin line.
- **Do** set every time and duration in tabular numerals.
- **Do** keep all copy German and register new Astryx built-in strings in `locales/de.json`.
- **Do** reuse the timeline grammar (gold = Arbeit, dashed/stone = Pause, bronze now-marker) for any new time visualization, at whatever scale.
- **Do** use `.zeile-interaktiv` (overlay hover + 2px #b9900e focus outline) for any new clickable row.

### Don't:
- **Don't** use gold or yellow for warnings or any status — warnings are orange (#e97a00 filled / #6e3500 text).
- **Don't** use white text on gold; it fails AA.
- **Don't** ship dark-mode surfaces — the app forces `mode="light"`; dark token slots are dormant theme inheritance, not a supported mode.
- **Don't** use Astryx `FieldLabel`'s `isRequired`/`isOptional` props (hardcoded English).
- **Don't** add a second ambient animation. The breathing live-tip (`zeitleiste-atmen`, 2.6s, reduced-motion-safe) is the one authored motion moment; everything else is state transitions at fast/medium/slow (125/300/700ms).
- **Don't** add a second stamp control anywhere — the sticky clock strip is the one home of Einstempeln/Pause/Ausstempeln.
- **Don't** show a running day as a deficit; frame it forward ("noch H:MM Std.", "Feierabend ca. HH:MM").
