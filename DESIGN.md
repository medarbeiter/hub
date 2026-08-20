---
name: MedArbeiter Hub
description: Warm-paper time tracking where brand gold paints the worked day itself.
colors:
  brand-gold: "#e1b025"
  on-gold-ink: "#231a02"
  bronze-text-gold: "#7c5f05"
  gold-icon: "#8f6e06"
  selected-gold: "#7c5f05"
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
  warning-orange: "#dd7200"
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

# Design System: MedArbeiter Hub

## Overview

**Creative North Star: "Der gestempelte Tag" (The Stamped Day)**

The workday itself is the interface. Instead of a form beside a stats grid, the employee's day is rendered as a live stamped band: gold blocks are worked time, quiet stone blocks are breaks, and a bronze now-marker moves as the clock runs. That band is the same component everywhere — `Tagesbahn` — at three sizes: a sparkline in a team row, a lane in a stack of days, and the full editing surface you can draw and drag on. A week is seven of those lanes on one shared hour axis, so Monday and Thursday can be compared by shape alone; opening a day expands its lane in place rather than sending the eye to a detail pane. Stamping itself lives in one persistent clock strip on every page.

The world is warm and papery, not clinical: white cards float on a barely-warm paper body with warm stone neutrals, so the single brand color — MedArbeiter gold #e1b025 — can mean exactly one thing. Gold is worked time and the primary action; it is never decoration and never a status color. The tone is calm, trustworthy, and payroll-serious: tabular numerals everywhere times appear, motion only where it explains time or a rare state change, German-only voice.

Built on Astryx components with the MedArbeiter theme; light mode is forced at the provider (`mode="light"`), so the shipped world is exclusively the light palette below.

**Key Characteristics:**
- One accent, one meaning: gold = Arbeit + primary action, nothing else.
- Warm stone neutrals on a paper ground (#faf8f3 body, white surfaces), never cold gray.
- One timeline grammar, one component, three scales — time always runs left to right.
- Poppins headings (wordmark kinship), Figtree body, tabular numerals for all times.
- Quiet daily motion: the breathing live-tip and lane cascade; the rare login-to-setup handoff may spend the longer arc to preserve continuity.

## Colors

A single warm gold voice over a warm-paper neutral spine, with status colors deliberately pushed away from the brand hue.

### Primary
- **Brand Gold** (#e1b025): worked-time segments, the primary stamp button, progress fill, and the "eingestempelt" StatusDot. The dark-mode token slot is #e5bc44, present in the theme but unshipped (light mode forced).
- **On-Gold Ink** (#231a02): the only text/icon color allowed on gold surfaces — white on gold fails AA.
- **Bronze Text-Gold** (#7c5f05): gold demoted to text grade; clears 6:1 on white. Used for accent text, links, the positive Zeitkonto figure, and the now-line + now-pill on the timeline.
- **Gold Icon** (#8f6e06): accent-colored icons.
- **Selected Gold** (#7c5f05): focus rings and selected insets. The former #b9900e reached only 2.98:1 on white and 2.55:1 on the gold wash it sits on, so the audit replaced it with the bronze that clears both.
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
- **Warning Orange** (#dd7200 filled, #6e3500 text, #fad0b5 wash): warnings live in the orange family so status never impersonates brand gold. Warning badges/dots use dark ink #171717 on the orange fill. The fill was darkened from #e97a00 in the contrast audit — as a graphical object it has to clear 3:1 on white (now 3.24:1) while keeping dark ink above 4.5:1 (5.5:1).
- **Error Red** (#e33f4a filled, #a50c25 text, #facecb wash): errors, negative Zeitkonto, destructive actions.
- **Success Green** (#198100 filled with white text): success badges, dots, progress.
- **Info Blue** (#0074e2 filled with white text): info banners/badges only — the StatusDot "accent" variant is redirected to brand gold instead, so a clocked-in dot speaks the same color as the segments it summarizes.

### Named Rules
**The Gold-Is-Work Rule.** Brand gold #e1b025 appears only as worked time and the primary action. No status color, chart color, or decoration may use gold or yellow; warnings are orange. If something is gold, it is work.

**The Kopf-Band Exception.** Exactly one surface bends Gold-Is-Work: the header band — and since the crown rebuild that band is one continuous surface across the top of the *content column*. The clock strip (`.stempel-leiste`) carries the wash's full stop `--color-accent-muted` #f7edd2 and the Kopf (`.kopf-band`) fades it into the paper body, so strip and Kopf are one warm plane instead of a white band abutting a gold one. The sidebar deliberately stays *outside* the crown on its own paper (user decision 2026-08-07): the shell reads as two sections, sidebar and content, with the crown belonging to the content. It echoes the marketing site's gold wash that PRODUCT.md records as brand evidence. It is allowed because the wash itself carries no meaning; anything meaning-carrying that *stands on* it (the gold primary button, the stamp dots) ships its own bronze or warning-text hairline, and every pairing on the wash is computed in `tests/kontrast.test.ts`. It remains the only such exception; a second one would make gold ambiguous again. On the phone the clock strip detaches to the bottom edge and returns to white — down there it is a floating tool surface, not part of the crown.

**The Two-Stones Rule.** Where a surface has to separate two kinds of the same thing and neither of them is worked time, it separates them by the *lightness of two stones*, never by inventing a second hue. The Protokoll band and the Wochenraster's four-step ramp both do exactly this: `--color-text-secondary` #67625a is a human intervention, `--farbe-pause` #8b8474 is routine stamping, and both clear the 3:1 non-text floor on their own (5.6:1 and 3.2:1 on white). A refused attempt sits on top in error red. Gold is not available for this and never will be — a log line is neither worked time nor the primary action.

**The Spesen-Are-Not-Gold Rule.** Reisen & Spesen carries money, and money is not worked time. The headline figure uses primary ink (`figurTon="arbeit"`), never bronze; the **Abwesenheitsspange** — the measuring bracket drawn under a lane from departure to return — is stone `--color-text-secondary`, and the dashed extension that shows how far the absence fell short of the eight-hour threshold runs at full opacity, because a dimmed meaning-carrying line has already broken the contrast floor once in this project. The only gold on these surfaces is the single primary button.

**The Dark-Ink-On-Gold Rule.** Text or icons on a gold surface are always #231a02. White on gold fails AA and is forbidden.

**The Three-Golds Rule.** Gold degrades by duty, not by taste: fill #e1b025, text/now-line bronze #7c5f05 (icons #8f6e06), focus/selected #7c5f05. Never use fill-gold at text size or bronze as a fill.

**The Gold-Needs-An-Edge Rule.** Brand gold reaches only ~2:1 on white and ~1.8:1 on the parchment tracks, and it never will — the colour is fixed. So a gold fill may not identify anything on its own: every meaning-carrying gold surface (timeline blocks, day-strip blocks, mini-timeline spans, week bars) ships a 1px inset hairline in icon-accent #8f6e06, which clears 3:1 on every ground the app uses. The boundary carries the contrast, not the fill. `tests/kontrast.test.ts` computes all of this and fails the build if a token drifts.

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

Sidebar app shell: a SideNav on the left (logo mark 40px + "MedArbeiter / Hub" heading — the mark anchors the corner and never reads smaller than its own wordmark; Sinnbild icons, role-gated "Verwaltung" section, user + Abmelden in the footer), content pages to the right. The sidebar stays on its own paper, deliberately outside the content column's gold crown (user decision 2026-08-07): the shell is two readable sections — the sidebar, and the content whose top the crown belongs to.

Every authenticated route opens with the **sticky clock strip** (`.stempel-leiste`). It is the single place stamping happens and stays reachable while scrolling. It is not a white band above the header — it is the header band's uppermost stripe: full `--color-accent-muted`, no bottom hairline at rest, the Kopf gradient continuing straight out of it. Only when it floats over scrolled content (`data-schwebt`, an IntersectionObserver sentinel) does it take back a hairline and `--shadow-low`; on the phone, fixed to the bottom edge, it stays white — a floating tool surface, not the crown.

**The strip says only what nothing else is saying.** It used to spell the state out — "Nicht eingestempelt" a handbreadth from a button reading *Einstempeln*, "Eingestempelt" next to *Ausstempeln*. The state was never the missing fact: it is legible from the action that is next. What was missing is everything else, and that is what the strip carries now:

| Running | Stopped |
|---|---|
| a pulsing dot + "seit HH:MM" (or "Pause seit HH:MM") | — |
| "H:MM Std. heute" | "H:MM Std. heute", or "Soll heute H:MM Std." if nothing is recorded |
| "Feierabend ca. HH:MM" | "noch H:MM Std. bis zum Soll" / "+H:MM Std. über Soll" |

The dot now carries the running state on its own, so it wears the house hairline (`--color-icon-accent`): brand gold reaches ~2:1 on white and can never meet the 3:1 floor for meaning-carrying surfaces — the boundary carries it, as everywhere else.

**Deckung — one fact, one place.** On "Meine Zeit / Tag" showing today, the Kopf already states the figure in display size, the lane shows when the day began, and the Feierabend marker stands on the axis. There the strip withdraws its facts and is nothing but the place to stamp. The question is answered in two halves: *which range* comes from the URL (`zeitAusUrl`), so the strip is already right when it leaves the server and never flashes on hydration; *is the Kopf still on screen* comes from an IntersectionObserver with hysteresis (`components/kopf-deckung.tsx`), so scrolling the Kopf away hands the facts back. Two things never withdraw: the ArbZG advisory (it is stated nowhere else) and an error (it belongs beside the action that caused it).

The handover rides the frame's own motion, not a new one: `grid-template-columns` 1fr→0fr on the desktop, where the facts sit beside the actions and slide out sideways; `grid-template-rows` on the phone, where they sit above them and fold up. It is the same transition the expanding sidebar item uses, turned to whichever axis the bar is laid out on.

### One frame, four ranges

"Meine Zeit" (`/`) is one page at four URL-driven ranges — **Tag · Woche · Monat · Konto** (`?ansicht=…&tag=…`). All four pour into the same frame (`ZeitRahmen`), and nothing moves between them:

| Band | The question it answers | Contents |
|---|---|---|
| **Kopf** (`.kopf-band`) | *Wo stehe ich?* | the greeting or the period's name as h1, one display-1 figure, one supporting line, and the navigator |
| **Bühne** | *Wie sah die Zeit aus?* | the lane(s) — the only place time is ever drawn |
| **Belege** | *Was steht im Datensatz?* | dense edge-to-edge rows you can act on |
| **Kontext rail** | *Und sonst?* | the next range up, plus the Zeitkonto — always on the right, never on the left |

Tag draws one lane; Woche seven on one shared axis; Monat the same lanes grouped by calendar week with a KW subtotal; Konto the running balance per month. Clicking a lane in Woche/Monat expands it **in place** into the full day surface (`TagesTafel`) — the same component the Tag range uses — indented onto the lane column so the day grows out of its own lane.

The content is a bounded sheet: `.zeit-blatt` caps at **1180px** and centres, while the header wash and the row dividers stay full-bleed. Stretched across a 1900px monitor a dense time table stops being readable and the page reads as unfinished.

Spacing rides the Astryx `--spacing-N` scale; the theme tightens Card and Section padding to `--spacing-3`, while the rail cards opt up to padding 4.

**Responsive:** one breakpoint at 920px, where the two-column grid (`.zeit-inhalt`, `minmax(0,1fr) 320px`) collapses to one and the rail follows the record. The clock strip is first in DOM and viewport on every breakpoint, so the primary action needs no mobile duplicate and focus order always matches visual order.

**The One-Frame Rule.** A *route* may change what is inside the three bands; it may never change where they are. The topology used to flip per tab (right rail on Heute, left list on Woche/Monat, no frame at all on Zeitkonto), which is why four views of one question looked like four products — and it went on flipping per *page* long after that was fixed inside "Meine Zeit": five routes wore the Kopf band while six Verwaltung pages set a heading, a grey line and pushed a switcher to the right. The border ran exactly between employee and manager, and every one of those pages already held its headline figure as a fragment of the grey line. `ZeitRahmen` now carries all eleven; `nav`, `buehne`, `werkzeuge` and `sinn` are optional so a queue or a roster fits without pretending to have a period or a timeline.

**The Strip-Comes-First Rule.** The clock strip is the one home of stamp actions; no view renders a second stamp control. A running day is framed forward ("noch H:MM", "Feierabend ca. HH:MM") — a signed minus appears only once the day is over or Soll is met.

## Elevation & Depth

Light-mode depth is quiet and structural: white surfaces float on the tinted paper body, lifted by soft two-layer drops, with warm hairline borders doing most of the separation. On the timeline, elevation is semantic — gold Arbeit blocks carry `--shadow-low` (they are the substance of the day), while Pause blocks are flat with a dashed outline (they are absence).

### Shadow Vocabulary
- **Low** (`0 2px 4px oklch(0 0 0 / 5%), 0 4px 8px oklch(0 0 0 / 10%)` + transparent inset): cards, work segments.
- **Med** (`0 2px 4px / 5%, 0 4px 12px / 10%`): popovers.
- **High** (`0 4px 6px / 10%, 0 12px 24px / 15%`): modals/dialogs.
- **Inset rings** (2px inset): hover `#e1b0254D`, selected `#7c5f05`, success `#1981004D`, warning `#dd72004D`, error `#e33f4a4D`. Interactive rows (`.zeile-interaktiv`) hover with `--color-overlay-hover` and focus with a 2px `--color-icon-accent` outline (offset −2px).

(The theme also defines a dark-mode "bezel" inset vocabulary via `light-dark()`; it is dormant while light mode is forced.)

**The Work-Casts-A-Shadow Rule.** On any lane, only Arbeit lifts (shadow-low). Pause does the opposite: solid pause-stone with a 1px inset dark shadow, so a break reads as a bite taken out of the day rather than a foreign block laid on top of it. Depth encodes the same meaning as colour.

## Shapes

Nothing is truly square: even `--radius-none` is 0.25rem. The ladder runs inner 0.5rem → element 0.75rem → container 1rem → page 1.75rem → full pill — the same ladder MedArbeiter One carries, because two apps of one house may not round their corners differently. A timeline segment takes the radius of the lane it sits on, not one fixed value: element radius on the `buehne`, the full-height day on „Meine Zeit"; inner radius on the `zeile` rows of a day stack (Bahnen-Stapel, Reise-Tafel); the 10px `band` sparkline is a pill throughout. Tracks, bars, and the now-pill are full-radius pills. Pause is the one outlined shape in the system — a dashed `--border-emphasized` border on muted parchment.

## Components

### Buttons
- **Primary:** brand gold fill with dark ink #231a02; in the clock strip it is *state-coupled* — its label is exactly the one legal action (Einstempeln / Ausstempeln / Pause beenden), with the alternative demoted to a secondary button beside it. One primary per view.
- **Secondary:** bordered neutral (Astryx default) — "Pause starten", banner actions, and the one shared `AddEntryButton` ("Eintrag hinzufügen", Plus icon, sm) on every surface.
- **Ghost:** low-key utility actions — "Bearbeiten" row buttons, "Abmelden".
- **Destructive:** locked pastel treatment — error wash #facecb background with dark error text #a50c25, not a filled red.

### StatusDot
Fills match the filled semantic badges so dot and badge speak one status language: success #198100, warning orange #dd7200, error #e33f4a — and **accent is brand gold #e1b025**, pulsing while eingestempelt. Neutral keeps the component's visible mid-gray.

### Status vocabulary on entries
Five states, five distinct readings — gold no longer has to mean everything: **Arbeit** (yellow badge, the kind of entry), **Pause** (neutral badge), **läuft** (info blue — today's clock still running), **ohne Ende** (error red — a past day never closed, uncountable), **bitte bestätigen** (warning orange — provisionally closed by the cutoff sweep). Absence days carry a neutral badge with their day type (Urlaub, Krank, Feiertag, Freizeitausgleich, Fortbildung).

### Badges
Semantic badges are filled saturated chips (info blue/success green/error red with white text; warning orange with dark ink). Categorical badges are pastel surface + dark colored text via the per-hue tokens.

### Cards / Containers
White, container radius, shadow-low, theme-default padding spacing-3 (Heute cards use 4). Cards are the only wrapper — no nested panel-in-panel.

### Banner
Hue-tinted pastel surface with matching dark colored text (warning: #fad0b5 wash, #584400/#6e3500-family text). Used inside a page — the open day's own "Offener Eintrag" note, the install offer — where the message belongs to the thing it sits above.

### Toast — the one inverted surface
The standing "your record has holes" notice is **not** a band across the top of every page; it is a single toast in the bottom-right corner (Astryx `useToast` via a `LayerProvider`), and it does not fade away on its own — it has to be clicked shut. It carried its old cost badly: pinned between the clock strip and the page's own heading, it pushed both down on every route until someone dismissed it, for a message that is important but is never the first thing you read on arrival.

The surface is ink (`#1c1917`, the house ink rather than Astryx's cool default), and it is the only place in the app where light type sits on dark. That inverts every colour on it: stone becomes `#a9a49a`, bronze becomes `#eece6d`, warning orange becomes `#ffc9a2` — declared in the theme's `onDark` block, not left to `color-scheme` to work out, because it does not. Ranked inside: the count and the days it names, each day a link; below them the one action, "Jetzt korrigieren", wearing a stone hairline for the same reason every tinted button in this house does. On a phone the toast lifts clear of the clock bar rather than covering it — the stamp action is the one thing a notice may never sit on.

### Der Posteingang — das Haus außerhalb des Hauses
Eine E-Mail hat kein `:root`. Outlook rendert über Word, viele Clients streichen `<style>` heraus, und `var(--color-accent)` käme als leere Deklaration an, also als *keine* Farbe. `emails/farben.ts` hält deshalb Hex-Kopien der Token, wörtlich aus `theme/medarbeiterTheme.ts`; `tests/kontrast.test.ts` prüft beide Seiten gegen dieselben Zahlen, damit die Kopie nicht auseinanderläuft, und jede Paarung gegen dieselben Böden wie im Fenster (4,5:1 Text, 3:1 bedeutungstragend).

Es gibt **eine** Vorlage (`emails/nachricht.tsx`), und eine neue Nachricht ist eine neue Nutzlast — dieselbe Beziehung, die `Monatsgitter` zu seinen Zellinhalten hat. Der Aufbau folgt `ZeitRahmen`: Kopf mit dem Namen des Hauses auf der Goldwäsche, darunter die Aussage, darunter die Tatsachen als Tabelle, dann der Weg zurück. Vier Dinge tragen die Hausregeln unverändert hinüber:

- **Der Tonstreifen** über dem Kopf ist die einzige Farbe, die etwas sagt, bevor ein Wort gelesen ist: Erfolgsgrün, Warnorange, Fehlerrot — dieselbe Zuordnung wie beim `MeldeTon` im Fenster. Gold ist der Ruhezustand und sagt für sich nichts, genau wie die Goldwäsche der Stempelleiste.
- **Gold braucht eine Kante.** Der Knopf ist Markengold mit 1px Bronze und dunkler Tinte darauf; die Füllung allein bleibt auch im Postfach unter 3:1.
- **Zahlen laufen tabellarisch**, und genau eine Zeile trägt das Ergebnis (`betont` — die Summe einer Abrechnung).
- **Geld ist kein Gold.** Beträge stehen in Primärtinte wie überall sonst.

Der Beschriftungsspalte steht eine feste Pixelbreite, kein Prozentwert: React Email macht aus jeder `Row` eine eigene Tabelle, Zeilen teilen sich also keine Spaltenbreite, und 40 % ergäben je Zeile eine andere Kante. Die Nur-Text-Fassung (`emails/text.ts`) entsteht aus derselben Nutzlast statt aus dem HTML — eine HTML→Text-Umwandlung weiß nicht, dass links die Beschriftung und rechts der Wert steht, und machte aus zwei Zellen „MitarbeiterAnna Berger". Schriften sind die Rückfallkette des Themes: Poppins und Figtree liegen selbst gehostet beim Browser, und eine Google-Fonts-Adresse in der Nachricht schöbe dem Postfach des Empfängers einen Fremdaufruf unter.

### Inputs / Fields
Astryx defaults on white; status borders/icons ride the global success/error/warning tokens (all six combinations verified ≥3:1). **Astryx `FieldLabel` hardcodes English "Required"/"Optional", so its `isRequired`/`isOptional` props are intentionally unused** — requiredness is conveyed in German copy instead.

### Navigation
Astryx SideNav; icons from the Sinnbild vocabulary (see below), outline when idle and **filled when selected** via `icon`/`selectedIcon`; selection tracked from the pathname; one "Meine Zeit" item (its section header always hidden), the Verwaltung section only for that role. The selected item speaks the house language instead of Astryx's cool gray: gold wash `--color-accent-muted`, bronze ink, and a 1px `--color-icon-accent` inset hairline — the same marking the Monatsgitter gives the open day, and the hairline for the same reason as everywhere (the wash alone reaches ~1.1:1 on paper, and inside the crown it would sit on itself).

**An item opens a quick menu — where it has something to say** — on hover *and* on keyboard focus: a state line ("Eingestempelt seit 08:32", "1 Reise wartet"), the one or two actions that state suggests, then jump targets under a rule. The menu is drawn as the sidebar continuing sideways — same paper (`--color-background-body`), a hairline on three sides only so the edge facing the item stays open, and the item behind stays highlighted while the card is up. It slides out on `transform` alone and its rows cascade in the same 25 ms steps as the day lanes, because it is the same house motion at a smaller scale.

Three rules keep it honest. **Nothing lives only in a quick menu** — stamping still belongs to the ClockBar, "Reise erfassen" to the Spesen page, the CSV to the Berichte header; a menu that only appears on hover is not a place to put a capability, so a touch device loses nothing by never seeing it. **A count of zero shows no badge**: "0 offen" is noise, not news. And **no menu that only restates its badge**: Team, Spesen prüfen, Monatsabschluss, Protokoll, Mitarbeiter and Einstellungen carry no chevron at all, because opening one would cost a click to learn what the number beside it already said.

The footer is an account row with the same grammar as an item — the locally chosen animal portrait, name and role link to the personal profile, with a logout button beside them. The logout button carries the server action directly on its form, so signing out survives with JavaScript switched off. Inside "Meine Zeit", the Tag | Woche | Monat | Konto zoom is a `TabList` of anchor tabs — URL-driven navigation, not client state — and each tab carries the same outline/filled pair.

### Persönliche Einrichtung

Anmeldung und Einrichtung sind **ein Zugangsblatt vor** der Anwendungsschale: ohne Navigation und ohne Stempelleiste, weil vor der Bestätigung noch keine Arbeitszeit erfasst werden darf. Nach gültigen Zugangsdaten bleibt das Blatt schmal, solange der Server Konto und Freigabe prüft; der Ladezustand der Anmelde-Schaltfläche ist die vollständige Rückmeldung. Sobald die Antwort vorliegt, öffnet sich das leere Zielblatt ohne flüchtige „Konto geprüft“-Zeile im langen 700-ms-Bogen. Nur die Formgröße trägt das gebremste Überschwingen. Inhalte bleiben währenddessen unsichtbar und blenden erst nach dem vollständig beendeten Größenwechsel ruhig ein: 320 ms für die Gruppe, 280 ms für ihre Elemente mit 40-ms-Staffelung, ohne Versatz, Skalierung oder Feder. Zwischen allen Schritten gilt dieselbe Reihenfolge: 180 ms Ausblenden, 520 ms gemessener federnder Höhenwechsel, danach der elegante Inhaltseinzug. Der Ablauf trennt Entscheidungstypen: ein nötiger Wechsel des vorläufigen Passworts, die erforderliche Google-OAuth-Vorschau, abrechnungsrelevante Stammdaten, Profilfigur und zuletzt Startansicht samt Hinweisen. Schritte, die ein bestehendes Konto bereits erfüllt hat, entfallen. Kein Rundgang und keine Produkterklärung; der Abschluss führt direkt in die gewählte Ansicht.

Das Blatt hat **zwei Breiten, aber nur eine Grammatik**: die Anmeldung bleibt eine 400-px-Spalte; jeder Einrichtungsschritt nutzt die volle Inhaltsbreite des 720-px-Blatts. Besonders Passwortfelder, OAuth-Hinweis, Identitätszeile und ihre Trennlinien enden nicht vorzeitig in einer künstlichen Lesespalte. Text bleibt linksbündig, die primäre Handlung steht am rechten Rand der durchgehenden Aktionszone. Über dem Blatt bleibt ein großzügiger, fester Abstand zum Fenster; auf dem Telefon wird er kleiner, aber nicht entfernt. Seine Oberkante ist fest verankert — beim Kontowechsel und zwischen Schritten wächst die Karte nur seitlich oder nach unten, nie nach oben. Der Kopf ist eine einzige kompakte Zeile: 40-px-Bildmarke links, der jeweilige Schritttitel unmittelbar daneben und ein tabellarischer `N / Gesamt`-Zähler rechts. Die große Wortmarke, eine statische Einrichtungsüberschrift, deren Unterzeile und der Fortschrittsbalken entfallen. Nur der Titel blendet mit dem bereits vorhandenen Schrittwechsel aus und ein; Marke, Kopf und Zähler bleiben räumlich ruhig. Darunter beginnt ohne wiederholte Schrittüberschrift sofort die Aufgabe und endet in derselben durch eine Haarlinie verankerten Aktionszone. Stammdaten sind eine kompakte, eingefasste Begriff-Wert-Liste; persönliche Wahlen sind echte Auswahlflächen. Erfolg, auf den unmittelbar der nächste Schritt folgt, erzeugt keine neue Meldungsfläche: die auslösende Schaltfläche trägt Laden und Abschluss. Nur Fehler oder Entscheidungen, die Aufmerksamkeit verlangen, stehen als Banner im Inhalt.

Die Stammdatenfreigabe ist nicht überspringbar. Ein Hinweis erklärt den Rückweg zur Verwaltung, statt Felder editierbar aussehen zu lassen, die der Mitarbeiter nicht verantwortet. Persönliche Vorgaben bleiben dagegen unter „Mein Profil" änderbar; der Name im Fuß der Seitenleiste ist der Weg dorthin. Sechs eigens erstellte Tierporträts liegen als ein lokaler 3×2-Bildbogen vor: verspielt, ohne biometrische Daten und ohne fremden Abruf. Seit 2026-08-17 kann darüber hinaus jede Person **ein eigenes Profilbild** hinterlegen (Produktentscheidung; vorher war der Bogen die einzige Möglichkeit). Der Bogen bleibt der Rückfall und ist damit weiterhin der Grund, warum jedes Konto ein Zeichen trägt — auch direkt nachdem ein Bild entfernt wurde. Das Feld steht auf „Mein Profil" als **eigenes Blatt über** der Figurenauswahl, mit eigenem Ausgang: ein Bild hochzuladen ist eine Handlung für sich und nichts, was beim Speichern der Startansicht nebenbei mitgeht. Google erscheint ausschließlich nach der MedArbeiter-Anmeldung als klar bezeichnete OAuth-Verknüpfung des bestehenden Kontos — niemals als zweite Login-Schaltfläche. Solange echtes OAuth nicht verbunden ist, sperrt der Server diesen Schritt im Produktivbetrieb.

### Icons — the Sinnbild vocabulary
**Phosphor (`@phosphor-icons/react`), and one module names every meaning: `components/sinnbilder.tsx`.** Components never name a glyph, only a meaning (`sinn="einstempeln"`), so "bearbeiten" cannot become three different pencils across the entry row, the team sheet and the employee admin. A new icon is added by adding a *meaning* — and the author sees on the way in whether that meaning already has one. 87 meanings, one table; One's `Sign` vocabulary runs on the same family, so the two apps of the house draw with one hand.

The import is the **SSR entry** (`@phosphor-icons/react/ssr`), not the default one: the default glyphs read `IconContext` through `useContext` and would be unusable from a Server Component, and this module is imported from both worlds. Nothing in the app sets an `IconContext`.

Phosphor carries **one component per meaning with a weight axis** (`thin`…`bold`, `fill`, `duotone`) rather than two separately exported components of which only some exist. The **two-value form axis** is therefore a choice of weight, and there is no longer a single table of exceptions:

- **voll** — weight `fill`. A solid glyph: "running now / decided / selected". The default.
- **umriss** — weight `bold`, deliberately **not** `regular`. The same glyph as a contour, *only* for the not-selected / not-running state. `regular` measures 16 of 256 units and lands under 0.9 px at `GROESSE.zeile` (14 px); `bold` measures 24 and lands near 1.3 px — a stroke width, not an ink-area equivalent to the filled Typicon shapes it replaces, which carried far more mass than either weight. `bold` was chosen as the closer of the two available strokes, not as a match. Against `fill` it still reads unmistakably as a contour. Unverified by eye (no login during this migration) — check `bereichs-leiste.tsx`'s idle tabs and `protokoll-liste.tsx`'s 14px marks before relying on this.

Astryx separates `icon` from `selectedIcon` in SideNav and Tab, and that pair is what the form axis feeds. **It now holds for all 87 meanings** — including `mitarbeiter`, `abschluss`, `protokoll`, `teamkalender` and `siegel`, which under Typicons had no contour and silently fell back to the solid form.

**The recorded gaps are closed.** Übernachtung wears a bed (it wore Feierabend's roof in outline); An- and Abreise wear takeoff and landing against Reise's tilted plane (they wore thick up and down arrows); and `siegel`, the hash-chain seal, wears an actual seal-with-check instead of the bookmark Typicons had to stand in for it. `dauer` is the one place the new set is thinner: Phosphor has no stopwatch, so the short-period timer carries it.

Named rules:
- **Icons never speak alone.** Every glyph sits beside its label and is therefore always `aria-hidden`. Nothing in the UI is stated by an icon only.
- **Colour is inherited by default** (`ton="erben"` → `currentColor`). Inside a gold primary button the glyph takes the button's dark ink automatically, so the Dark-Ink-On-Gold rule holds without being restated at each call site. Explicit tones — secondary, accent bronze, warning, error, success — are all computed against white/paper/parchment/gold-wash in `tests/kontrast.test.ts`.
- **The nav icon and the page title icon are the same.** Arriving somewhere shows the sign you followed.
- **Same action, same sign.** `hinzufuegen` is Plus everywhere; `bearbeiten` is one pencil; the four stamp actions are hinein / hinaus / Kaffee / zurück-an-die-Arbeit — and "Pause beenden" deliberately carries the *Arbeit* glyph, because that is what it means.
- **The domain supplies its own keys.** `DayTypeKind` values (`urlaub`, `krank`, `feiertag`, `freizeitausgleich`, `fortbildung`) and the range names (`tag`, `woche`, `monat`, `jahr`, `konto`) *are* vocabulary keys, so those call sites pass the domain value straight through with no lookup table. Only `TagArt` and `ReiseStatus` are translated, in one exported map each.
- **A trip's status wears the sign of the act that produced it**: Entwurf = pencil, eingereicht = upload, genehmigt = ticked box, abgelehnt = prohibition sign. The same four carry an absence, plus Info for `gemeldet` — a sick note is noted, not reviewed.
- **Half and full per-diem rates are a half-filled and a filled circle** — the glyphs say what the amounts say.

Astryx's own built-in glyphs (checkbox ticks, Selector chevrons, Banner status marks) are re-registered to Phosphor in `theme/icons.tsx`. Most take weight `bold`, the same choice and reason as `umriss`, so a chevron in a Selector and a chevron in the Bereichsleiste are the same shape. The four status marks (`success`, `error`, `warning`, `info`) and the selected chevron (`chevronDown`) are the exception: they were filled Typicons, not contours, and there is no selected state here to force a contour the way there is in the vocabulary — so they keep weight `fill`, matching Astryx's own guidance that status icons use solid fills for color visibility. The three gaps Typicons left there are closed too: `moreHorizontal` is three dots (was a menu grid), `eyeSlash` a struck-through eye (was a lighter eye), `copy` a double sheet (was a clipboard). `checkDouble` is now Phosphor's actual double check instead of the ticked box that also means `genehmigen` — two things that were one picture are two again.

### Tagesbahn (signature)
**One component draws a day, at three scales.** A horizontal `figure`: time runs left to right on a full-radius muted track, gold blocks are Arbeit, recessed pause-stone blocks are Pause, a 2px bronze line is now.

- `band` (10px) — a sparkline for dense lists (team rows). No axis, no interaction.
- `zeile` (26px) — a row in a stack of days; the whole row is the parent's target.
- `buehne` (52px + axis + pill) — the editing surface: hour labels, now-pill, Feierabend tick, planned ghost, drag to correct an entry's edges and drag across free track to record a new one (5-min snap).

The window comes from `spanOf()` — the content's own extent ±30 min, hour-rounded, minimum six hours — so an empty afternoon is never rendered. A **stack passes one shared span to every lane**; without that a week cannot be compared at all. The stack labels the axis once and the lanes carry the hour rules, so the grid runs through the whole period.

Inside a gold block, whole hours are marked by 1px white-at-26 % rules: six hours of gold reads as six hours without anyone reading the label. Decorative only — the block's meaning is still carried by its bronze `.arbeit-flaeche` hairline.

A day with no entries but a Soll still to come is drawn as a **dashed plan** (bronze edge at full strength on the accent wash), never as an empty grey track. Empty must read as a plan waiting to be filled, not as a failure.

### Monatsgitter (signature, second axis)
**One component draws a month, and every month-shaped surface pours into it.** A real `<table>` of Mo–So weeks over `lib/kalendergitter.ts`: the weekday is a column, the calendar week a row, and a screen reader gets both as headers instead of one long `aria-label`.

It replaced four near-identical bands — Teamkalender, Abwesenheitsstapel, Reisenstapel, Protokollband — that all drew days on an *unfolded* date axis. That axis was the wrong one: a Gantt lane rewards dense, overlapping, comparable durations, and absences are sparse, non-overlapping and above all **located in a calendar**. Measured before the rebuild: nine lanes to show one absence (≈1 % ink to 99 % track), no weekday anywhere (the axis read 5·10·15·20·25·30), and a year at 1.2 px per day where the weekend shading had to be switched off above 62 days because ~104 cells merged into a solid check. The emptiness also scaled the wrong way — the more employees, the emptier the page.

What survived the move, unchanged: a span is drawn as its **individual day cells**, never one long bar (a white-filled bar with a thin edge read as an empty input field), and the **two channels never cross** — *fill* answers "does this day cost anything" (a weekend inside a holiday stays empty), *edge* answers "is it decided" (solid) or "merely requested" (dashed). Both now live in `GitterMarke`. What precedes the label is a **Sinnbild, never a colour code**: where the art may be shown it wears its sign, where it may not (a colleague's absence) it wears a neutral stone — so the difference is visible rather than concealed.

Cell payload per surface, grid unchanged: person marks with a `+N weitere` overflow (Teamkalender), the day in its art (Abwesenheit — where the grid *is* the day picker), the travel day with its half/full rate glyph and its € (Reisen & Spesen), the two-stone density column that is also the day filter (Protokoll). Today wears a bronze ring, the open day the gold wash. Below 640 px the KW column and the mark labels drop out while the signs stay — the Belege list beneath carries every name in text anyway.

### Belegungskurve and Wochenraster (derived)
**Belegungskurve** — how many are away at once, day by day, under the month grid with a dashed orange threshold from Einstellungen. This is the one quantity on these surfaces for which a *continuous* axis is genuinely the right instrument, so the band survives in the job it is good at. Its scale has a floor of three: without it a single absent person of nine filled the frame, and a picture that draws "one is away" like "everyone is away" lies about the only number it exists for. Each column carries its count, because a height compares and only a number names.

**Wochenraster** — the year as 52 (or 53) columns, one row per person or per art. The question changes with the resolution: in a year nobody asks "on which day" but "in which weeks, and how much". Its ramp is *one* stone in four lightnesses — the same Two-Stones discipline the Protokoll band uses — with the upper steps carrying the 3:1 floor and the figure beside the row naming the total.

### Reisenband → Reisengitter (Reisen & Spesen)
The trips of a month now sit in the Monatsgitter, each travel day showing its rate glyph and amount. Opening a row in the Belege list beneath expands in place into `ReiseTafel`, which goes back to the real `Tagesbahn` (`groesse="zeile"`, shared span) for each travel day, with the Abwesenheitsspange beneath and the rule that produced the amount beside it. The same tafel serves the reviewer, where the claim sits directly over the employee's stamped day — the evidence and the claim in one picture.

### Spannenstreifen (derived)
A span in a Beleg row is a **micro-graphic in a fixed ~132 px column**, not a stage-wide band: the same house pattern as `SaldoTrend` on Berichte. The grid above answers *where in the month*; this column answers *how long, and how much of it counts*. Above sixteen days it summarises rather than compressing — a strip of 2 px splinters would be exactly the mistake the month band made.

### Week overview / Zeitkonto trend (derived)
Week overview: per-day 10px pill tracks, gold fill against a 2px pause-stone Soll tick, today in accent semibold with a gradient fill, future working days as the same dashed plan. Konto trend: monthly closing balances diverging from a zero hairline — bronze `--color-icon-accent` above, error red below, the running month at 50 % — the same idiom as the micro trend on Berichte, at reading scale.

### Personentafel
One `Table` for every "row per person, numbers in columns" surface — Team, Monatsabschluss, Berichte, Mitarbeiter — on the real Astryx component with `useTableSortable`, `pixel()` and `proportional()`. Before it there were four hand-built rasters and 74 hardcoded `inlineSize:` widths; Ist/Soll/Saldo was 90 px on one sheet and 100 px on the next, nothing sorted, and no header stayed put while scrolling. Team's live state became a **sort rank** rather than three group headings: the same first reading, without a table that falls apart into groups and can no longer be sorted by hours.

### Bereichsleiste
The one navigator: `Tag │ Woche │ Monat │ Konto` as anchor tabs, with a `‹ label ›` stepper that moves whichever range is open and a "Heute" reset that appears only when it would do something. It sits at the foot of the Kopf band on every range. It replaced a TabList plus three near-identical pagers — which is why the day zoom previously had no way to reach yesterday.

## Do's and Don'ts

### Do:
- **Do** paint worked time, the primary action, and the clocked-in StatusDot in brand gold #e1b025 — and nothing else.
- **Do** put dark ink #231a02 on every gold surface, and use bronze #7c5f05 whenever gold must act as text or a thin line.
- **Do** set every time and duration in tabular numerals.
- **Do** keep all copy German and register new Astryx built-in strings in `locales/de.json`.
- **Do** reuse `Tagesbahn` for any new day-shaped visualization instead of drawing a second timeline; pick a `groesse`, and pass a shared `span` whenever days are meant to be compared.
- **Do** draw expected-but-unrecorded time as a dashed plan, never as an empty track.
- **Do** use `.zeile-interaktiv` (overlay hover + 2px `--color-icon-accent` focus outline) for any new clickable row, and `.arbeit-flaeche` for any new gold surface that carries meaning.

### Don't:
- **Don't** use gold or yellow for warnings or any status — warnings are orange (#dd7200 filled / #6e3500 text).
- **Don't** use white text on gold; it fails AA.
- **Don't** ship dark-mode surfaces — the app forces `mode="light"`; dark token slots are dormant theme inheritance, not a supported mode.
- **Don't** use Astryx `FieldLabel`'s `isRequired`/`isOptional` props (hardcoded English).
- **Don't** add an unearned authored motion moment. Daily work owns the breathing live-tip (`zeitleiste-atmen`) and lane cascade (`bahn-auf`); the rare login-to-setup handoff owns one 700-ms expansion because it explains that the verified account has opened into required setup. Everything else is a state transition at fast/medium/slow (125/300/700ms), and all of it is reduced-motion gated.
- **Don't** animate `opacity` on content entrances. An animation that never ticks — a background tab does exactly this — would strand a time record at partial opacity; `bahn-auf` moves `transform` only, so its worst case is a row 10px low.
- **Don't** add a second stamp control anywhere — the sticky clock strip is the one home of Einstempeln/Pause/Ausstempeln.
- **Don't** show a running day as a deficit; frame it forward ("noch H:MM Std.", "Feierabend ca. HH:MM").
- **Don't** give a route its own page header, navigator, or column topology. One frame, every route — Verwaltung pages included.
- **Don't** draw a month as lanes on an unfolded date axis. `Monatsgitter` is the only month; add a cell payload, not a second grid. The one exception is a genuine per-day *density* over a year (the Protokoll's year band), where the height itself is the information.
- **Don't** build a person-by-numbers table out of `HStack` and fixed pixel widths. `PersonenTafel` exists and its headings sort.
- **Don't** wrap a single row in a Card. Belege are rows on the page surface with hairline dividers; Cards are for the rail widgets and dashboard-shaped content.
