# Generic Data & Visualization: charts and tables on any Pillar/Area page

The second, deliberately deferred half of the Pillars/Areas work (spec #155, ADR-0016) — a
generic system for adding charts and freeform tables to any Pillar/Area page, without writing
bespoke code per visual. Grilled as its own session once #155 shipped. The larger "modular,
Notion-like, sellable platform" ambition that originally motivated this stays out of scope and
logged in `CONTEXT.md`'s "Future direction" section — this ADR covers only the concrete visuals/
data system the user asked to build now, kept "quite simple" per their own framing.

## Two new section-list zones, not two new singular sections

ADR-0016's section list (North Star, Goals, Habits, Systems, Tasks, Thoughts) assumes exactly one
instance of each type per page. Charts and tables don't fit that — a page can want several of
each. Rather than inventing new section-list machinery, `Chart` and `Table` become two more
`SectionType` values whose section renders a whole **zone** (the list of `Visual` instances on
that page, plus an "+ Add" trigger) instead of a single card. `resolveSectionOrder` and
`SectionManager` (#160) need no changes — toggling "Charts" off hides the whole zone, exactly like
toggling off "Goals" hides that whole card; only what a "section" can contain changes, not the
section-list mechanism itself. Individual chart/table instances within a zone get their own
lighter-weight, separate reorder/remove UI (drag/remove per instance), one level below the
page's own section-list.

## Data model

**`Visual`**: one row per chart/table instance — `pillarId`, `areaId` (nullable), `type`
(`LINE`/`BAR`/`PROGRESS_BAR`/`SCATTER`/`STREAK_HEATMAP`/`TABLE`), `title`, `config` (Json),
`sortOrder`.

**`VisualRecord`**: ad-hoc chart data points — `visualId`, `date` (nullable), `xValue`/`yValue`
(nullable numbers), `xLabel` (nullable string), `note`. Only exist for a chart with no source
binding; a bound chart never has any. Different chart types read different fields rather than
being forced through one universal shape: Line/Bar/Streak heatmap use `date`+`yValue`; Scatter
uses `xValue`+`yValue`; Progress bar reads only the latest record's `yValue` as "current" against
a target stored in `config`.

**`TableColumn`** (`visualId`, `name`, `type`: `TEXT`/`NUMBER`/`DATE`/`CHECKBOX`, `sortOrder`) —
user-added custom columns only. A bound table's built-in columns (e.g. Goals → Name, Status,
Progress%) are never stored here — each adapter declares its own fixed column set, resolved at
render time, same as chart data.

**`TableRow`** (`visualId`, `boundEntityId` nullable, `data` Json keyed by column id, `sortOrder`)
— for a freeform table, every row is a real `TableRow`. For a bound table, a row is synthesized
from the adapter's live entity list for display; a `TableRow` only exists once the user has
entered a value into a custom column for that entity (`boundEntityId` links it back). This avoids
an EAV-style per-cell table and avoids ever storing a stale copy of the bound entity's own fields.

## Binding: live adapters, not a sync/copy step

A chart or table's `config` stores a binding reference (`{ adapter, refId }` for a single-entity
chart binding — one Habit, one System, one Goal, one Account; `{ adapter }` alone for a table,
since a table lists every entity of that type in scope, not one). At render time, a small adapter
module per bindable source fetches the real rows and resolves them into chart points or table
rows — always current, never a stale duplicate, no sync job to maintain. Same "fetch raw rows,
transform via a pure function" split this codebase already uses (`lib/finance/cash-flow-trend.ts`).

Scatter is the one chart type with two independent bindings — `xBinding`/`yBinding` in `config`,
each separately ad-hoc or bound to a different source — enabling correlation-style charts (e.g.
pain vs. sleep quality), in the same spirit as the existing hardcoded Correlation view on the
Ankylosing Spondylitis Area, generalized rather than duplicated.

**Bindable sources, v1**: charts — habit check-ins, System evaluation scores, Goal progress
(saved vs. target over time), Finance balances/transactions (the adapter exists now; Finance's own
page doesn't gain a Chart zone until it separately opts into the section-list architecture, per
ADR-0016's "appendable, not built now" note). Tables — Goals, Habits, Tasks, Systems, each scoped
to the current Pillar/Area.

## Charting library

This codebase has no charting dependency today — the two existing hand-rolled charts
(`trend-chart.tsx`, `ring.tsx`) are inline SVG with manually computed path/arc math. Five chart
types plus ongoing maintenance is enough to justify a first real charting dependency (Recharts,
targeting a React-19-compatible version) rather than continuing to hand-roll axis/scaling/hover
math per type. No documented bundle-size constraint in this codebase weighs against it.

## Existing widgets: shared rendering code, unchanged placement

None of the three widgets flagged for "migration" (the habit consistency grid on Insights, goal
progress rings and the cashflow trend chart on Finance) actually live on a Pillar/Area page — one's
on the cross-cutting Insights page, two are on Finance's explicitly untouched page. "Migrate" means
refactoring those three to render through the new shared chart components internally — one visual
system, less duplicate SVG code — without moving or restructuring either page. A real ticket in
this spec, not deferred, since it's small and proves the new primitives against real, already-
shipped visuals.

## Data entry

**Ad-hoc, one at a time**: a form defaulting its date to today, so logging a new day's value is
two fields (value, optional note) — matches this app's low-maintenance principle (CLAUDE.md #1),
same shape as `lib/daily-log/actions.ts`'s existing upsert-by-date pattern for the Daily Log Sheet.

**Ad-hoc, in bulk**: two paths into the same pure parser (`lib/visuals/parse-records.ts`) — paste
rows of text (`date, value` per line, comma/tab-separated) into a textarea, or upload a `.csv`
file. Both parse into the same `{date, value, note?}[]` + per-row-error shape before insert.

**Today quick-add**: a "Log today" widget on Home (`/today`), alongside the existing Daily Focus
habits and Thought quick-add, listing every ad-hoc, date-based chart (Line/Bar/Streak heatmap,
unbound) with a compact inline value input — logging a metric doesn't require navigating to its
Pillar/Area page first. Bound charts and Progress bar/Scatter never appear here (nothing to
manually log).

## Add-chart/table flow

A small modal, not an inline expansion (unlike `NewAreaTile`'s single-field pattern) — a multi-step
setup needs room a section-list trigger doesn't have. Step 1: a visual gallery — five boxes, each
a static reference icon (not a live-rendered mini-chart) plus the type name, for chart creation;
skipped for a table. Step 2: title + data source (ad-hoc vs. bound, and which specific entity if
bound). Step 3 (Scatter only): X and Y sources chosen independently.

## Out of scope (deliberately)

- The larger "modular, Notion-like, sellable" platform vision — logged in `CONTEXT.md`, not
  designed here.
- A `Select` column type for tables — Text/Number/Date/Checkbox only in v1.
- Binding a Table's rows to Finance data, or any bespoke score primitive beyond what's listed above.
- Any change to Finance's own page/route — still fully untouched, per ADR-0016.
- Multi-tenancy, auth changes — unchanged, single-user.
