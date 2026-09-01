# User-creatable Pillars and Areas, and a generic Pillar/Area page

Prompted by grilling the Pillars/Areas feature: Pillar creation already existed (`createPillar`,
#58/#49) but was deliberately minimal — a row and a name, no page, no nav entry, and Area creation
didn't exist at all. The user wants both to be first-class: creating a new Pillar or Area should
feel the same as Health does today, not a second-class "just a row somewhere."

This ADR also folds in a larger ambition the user raised mid-grilling — a "modular, Notion-like"
platform where new functionality doesn't require bespoke development per Area. That's explicitly
**not** designed here (logged in `CONTEXT.md`'s "Future direction" section for its own future
session) — but one piece of groundwork from it, a generic **section list** per page, is small enough
and useful enough on its own to build now, and is what this ADR actually specifies.

## Pillar creation: name + color

`createPillar` (`lib/pillars/actions.ts`) gains a `color: ColorKey | null` parameter, asked for at
creation time via the existing `components/color-swatch-picker.tsx` (prior art: same picker already
used for `updatePillarColor` and for `TaskList`'s color field). Every other Pillar field (description,
North Star, intended time-share) stays fill-in-later, unchanged from today's pattern — asking for a
color up front is the one exception, because a Pillar's color now renders immediately in its nav-bar
entry and would otherwise sit grey until edited.

## Area creation: name only

New `lib/areas/actions.ts`, `createArea(pillarId, name)` — mirrors `createPillar`'s existing
minimalism exactly (just a row + a name), consistent with `Area`'s existing minimal field set. No
`lib/areas/` module exists today; Area reads currently live in `lib/health/data.ts`, hardcoded to
Health — this ADR generalizes them (see below), and `lib/areas/actions.ts` is the natural home for
the new write.

## Every Pillar gets a dedicated page and nav entry

`NAV_ITEMS` (`components/nav-config.tsx`) stops being a fixed array of named entries for Home,
Insights, Health, Finances, Nudges, Settings. Health and Finances become **data-driven** nav entries
alongside every user-created Pillar (fetched the same way `getPillarsWithStats()` already feeds the
`/pillars` index page) — Home, Insights, Nudges, and Settings stay as fixed, non-Pillar entries.

Routing generalizes from Health's hardcoded `/health` and `/health/[areaId]` to dynamic
`/[pillarId]` and `/[pillarId]/[areaId]` routes. Health is **retrofitted** onto these same dynamic
routes rather than kept as a special-cased literal route — the old `/health/page.tsx` and
`/health/[areaId]/page.tsx` are deleted, not kept running alongside the new generic ones. Finances
keeps its existing literal `/finances` route and bespoke page untouched — it opts out of the generic
Pillar page entirely (see below).

## The generic Pillar/Area page: a section list

A Pillar or Area page renders a **reorderable, toggleable list of sections** rather than a fixed
layout. The six section types, each scoped to that Pillar or Area: **North Star**, **Goals**,
**Habits**, **Systems**, **Tasks**, **Thoughts**. Per-Pillar and per-Area config (which sections are
visible, and in what order) is a new small field — an ordered array of `{ type, visible }` — stored
on `Pillar`/`Area` (or a sibling one-to-one table if that reads cleaner against the schema; an
implementation detail, not a decision this ADR needs to pin down). Pure logic (given a config and the
fixed set of section types, produce the ordered, visible list) lives in a new `lib/pillar-page/`
module, tested without touching Prisma or React — same shape as `lib/finance/transaction-query.ts`'s
pure query-builder seam.

Two of the six section types don't have a scoped query today — `Goals` and `Thoughts` are shown
per-Pillar/Area for the first time as part of this work (`getGoalsForArea` already exists in
`lib/goals/data.ts`; a `getGoalsForPillar`, and Pillar/Area-scoped Thoughts equivalents, are new).
The other four generalize existing Health-only functions off `lib/health/data.ts`
(`getHealthPillarWithAreas`/`getArea`) into Pillar-agnostic ones.

A page isn't *only* its section list — it can carry **fixed, non-section content** above the list,
for anything that doesn't fit the generic six types. Health's Ankylosing Spondylitis Area keeps its
bespoke Pain & Mobility Tracking, Correlation, and daily-log-history cards this way, unchanged in
behavior. The Pillar-level "tap a node to go into it" areas overview (today's `HealthMindmap`,
Health-only) generalizes into a Pillar-page fixture shown above the section list on every Pillar with
Areas, not just Health.

**Finances is untouched, but not walled off.** Its existing bespoke shape (Items, Baseline, Goals,
Expenses, North Star, no Areas layer) stays exactly as it is — no section list, no retrofit. But the
section-list mechanism is deliberately built as something *appendable* to a page rather than
something that must own the whole page, so Finances (or any bespoke page) can gain an appended
section list later without a rewrite — relevant once a future spec adds new section types (Chart,
Table) that Finances would plausibly want. Not built now; just not designed to make that harder later.

## Out of scope (deliberately)

- **No generic score-tracking primitive.** Pain & Mobility stays Health/Ankylosing-Spondylitis-specific,
  not generalized into a section type any Area can add.
- **No Chart or Table section types**, and no generic data/visualization system underneath them —
  a separate, later spec ("Generic Data & Visualization"), sequenced after this one.
- **No multi-tenancy.** `CONTEXT.md` already states single-user, no auth/tenant work; unchanged here.
- **No gating on which Pillar names are allowed** — any name is a valid new Pillar, matching the
  existing `createPillar` behavior.
