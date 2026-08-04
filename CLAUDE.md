# MedArbeiter Zeiterfassung — working rules

Internal German employee time tracker for one company. Product truth lives in
`PRODUCT.md`, the visual system in `DESIGN.md`, per-surface strategy in
`.impeccable/surfaces/`. Read those before changing product behavior or design.

## Runtime: Bun only (no Node installed on this machine)

- `bun <file>`, `bun install`, `bun run <script>`, `bunx <pkg> <cmd>` — never `node`/`npm`/`npx`.
- Next.js runs entirely under Bun: `bun run dev` (dev server, port 3000), `bun run build`, `bun run start`.
- `bun:sqlite` for the database (never `better-sqlite3`). Bun auto-loads `.env` — no dotenv.
- `bun test` for tests (`bun:test`).

## Project map

- `app/` — Next.js App Router. `(app)/` = authenticated shell (Heute `/`, `/zeiten`, manager-only `/team`, `/abschluss`, `/berichte`), `login/`, `druck/[monat]/` (print sheet, no shell), `api/export/` (CSV).
- `app/actions.ts` — all mutations (server actions). `app/providers.tsx` — Theme + i18n provider.
- `lib/db.ts` — schema + `getDb()` (SQLite at `data/medarbeiter.db`, WAL, auto-migrated).
- `lib/time.ts` — domain logic (DB-bound). `lib/format.ts` — pure date/format helpers, safe for client imports. Never import `lib/time.ts` or `lib/db.ts` from a client component.
- `lib/auth.ts` — session cookie auth; `requireUser()` / `requireVerwaltung()` guards in server components.
- `components/` — UI. The timeline grammar lives in `day-timeline.tsx` (vertical, signature surface) and `mini-timeline.tsx` (horizontal team rows).
- `theme/medarbeiterTheme.ts` — the design tokens SOURCE. After editing run `bunx astryx theme build theme/medarbeiterTheme.ts -o theme/medarbeiter.css` (regenerates css/js/d.ts). Never hand-edit the generated files.
- `scripts/seed.ts` — `bun scripts/seed.ts` creates the admin; `--demo` adds synthetic demo employees/times (never present demo data as real).
- `locales/de.json` — German catalog for Astryx built-in strings; extend it when a new component surfaces an English built-in.

## Domain invariants (do not break)

- Segments are `arbeit | pause`, one calendar date + minutes-from-midnight, never crossing midnight. `end_min IS NULL` = running (today) or forgotten clock-out (past day = anomaly). Anomalies are never auto-closed — they surface as warnings and are fixed by manual correction.
- Zeitkonto counts ONLY recorded days (worked − Soll per day with entries), so absences don't drag the balance. Say "aus erfassten Tagen" wherever the balance is shown.
- Per-employee weekly Sollzeit (`users.weekly_minutes`) spread over Mo–Fr.
- Locked months (`month_locks`) are read-only for everyone; Verwaltung must unlock to edit. Locking requires no open segments and a completed month.
- Corrections record `edited_by` — the audit trail payroll relies on.
- Two roles only: `mitarbeiter`, `verwaltung`. Employees see themselves; Verwaltung sees everyone.

## Quality bar (learned in review — keep these true)

- **German only.** Every user-visible string. Astryx `FieldLabel` hardcodes English "Required"/"Optional", so `isRequired`/`isOptional` props stay UNUSED; validate server-side with German messages.
- **Gold discipline.** Brand gold `#e1b025` means work/primary action; text/icon gold is bronze (`--color-text-accent` #7c5f05, `--color-icon-accent` #8f6e06) because raw gold fails contrast on white; on-accent ink is dark, never white. Warnings are ORANGE (never yellow — it would impersonate the brand). One primary button per view.
- **Contrast floors.** Text ≥4.5:1; non-text UI (timeline fills, focus rings, ticks) ≥3:1 — mini-timeline pause fill is `#8b8474` for this reason. Compute, don't eyeball.
- **A11y.** DOM order = visual order at every breakpoint (mobile stamp card is a separate `.nur-mobil` instance, not a CSS reorder). No `role="img"` on containers with interactive children. Focus rings via `--color-icon-accent`. Respect `prefers-reduced-motion` for any animation.
- **Motion.** One authored moment per surface (currently the breathing live tip, gated `isOpen && isToday`); transitions use `--duration-*`/`--ease-standard` tokens.
- **Fonts are self-hosted** via `next/font` (variables `--font-poppins`/`--font-figtree`); never add Google Fonts `<link>` tags.
- **Astryx rules** (block below): components own layout — no raw `<div>` layout; tokens only, no raw hex/px in UI code except where a token cannot express it (document why, as done in globals.css); custom visual grammar (timelines) uses semantic elements + `var(--…)` tokens.
- The direction contract is the HTML comment in `app/layout.tsx` — keep it in the emitted markup.

<!-- ASTRYX:START -->
Astryx v0.2.0 · 154 components
CLI: run every command as `bunx astryx <cmd>` (shown below as `astryx ...`).

SETUP (once, in your app entry e.g. main.tsx) — without these, components render unstyled:
  import "@astryxdesign/core/reset.css";
  import "@astryxdesign/core/astryx.css";

WORKFLOW — discover, don't guess. Before writing UI:
1. `astryx build "<idea>"` — START HERE: returns a kit (closest [page] + [block]s + [component]s). No args = full playbook.
2. `astryx template <name> [--skeleton]` — scaffold the [page]/[block]s it named, or study their layout. Templates are reference code.
3. `astryx component <Name>` — props + examples for every component you use.

RULES:
- No <div> — components do all layout/spacing. Full page → AppShell; sidebar nav → SideNav.
- Frame first: pick the shell (AppShell / Layout+LayoutPanel) and budget regions in px BEFORE writing content (`astryx docs layout`).
- Dense data = rows (Table, List/Item) edge-to-edge — never Card-wrapped list items. Card = dashboard widgets, galleries, settings groups only.
- Status → StatusDot/Token; Badge only for counts and enumerated states, never decoration.
- Custom styling: component props first; else style/className with tokens — var(--color-*|--spacing-*|--radius-*). No raw hex/px. (No StyleX/Tailwind compiler here — don't use xstyle/utility classes.)
- Tokens for every value (`astryx docs tokens`). Brand/accent via `astryx theme` — never override --color-* in :root.
- SELF-CHECK before you finish: re-read the file and replace any raw <div>/<span> layout, imported .css/@apply, or hardcoded value (#hex, 16px) with the component or a token (var(--color-*|--spacing-*|…)). If unsure a component/prop exists, run `astryx component <Name>` / `astryx search "<thing>"`; don't hand-roll CSS.

MORE CLI:
  search "<query>"   find any component / hook / doc / template / block
  component --list   154 components by category
  template --list    page + block recipes
  docs <topic>       color, elevation, icons, illustrations, internationalization, layout, migration, motion, principles, shape, spacing, styling, theme, tokens, typography
  swizzle <Name>     eject component source for deep customization
  upgrade --apply    run after any @astryxdesign/core bump
<!-- ASTRYX:END -->
