# v2 Phase 4 (Systems): the core entity, built whole

**Status**: accepted

Scope: the design decisions for Phase 4 of the design_handoff_personal_os v2 rebuild — the
System entity (DATA_MODEL.md §5, SCREENS.md's Systems tab and System card) — decided ahead of
the build, per the handoff README's Implementation order. The handoff calls this "the app's
most developed concept" and "the largest single piece"; nothing like it exists in the current
schema, so every decision below is new ground rather than an extension of a v1 mechanic.

Unlike Phase 3's raw-values/correlations split (ADR-0007) or Phase 1/2's UI-creation-form
deferrals, this phase is scoped to build the **whole** feature in one pass — full step-type
set, full widget set (including the photo-based ones), templates/runs, nesting, decisions log —
rather than carving off a follow-on slice. The size of the resulting build is expected to span
many tickets at `/to-tickets` time; that's a sequencing concern, not a scope cut.

## `System` and `SystemStep` are single polymorphic tables

Five step types (Checklist, Checkpoint, Dated milestone, Measure, Repeating) share one
`SystemStep` model with a `type` enum and nullable type-specific columns, rather than five
separate tables. This matches how `Task` and `Habit` are already modeled in this schema — one
table, nullable columns for the fields that don't apply to every row — rather than introducing
a new "one table per subtype" pattern this codebase doesn't otherwise use. A flat step list, a
sequential chain, and a Gantt/kanban view are all just different renderings of the same rows.

## `scope` becomes real foreign keys, not a string

The prototype's `scope` field ("area name, or `'Finances'`") becomes `pillarId` (required FK)
+ `areaId` (nullable FK, null meaning a pillar-level System — e.g. Finance's own "Payday
routine", which has no Area layer per CONTEXT.md). This mirrors `Habit`/`Task`'s existing shape
exactly, and continues the stable-FK-over-name-lookup convention established across Phases 1–3
(e.g. `ANKYLOSING_SPONDYLITIS_AREA_ID`, `STRETCH_HABIT_ID`).

## Nesting is capped at one level

`parentId` is a self-relation on `System`, but a System that has `parentId` set cannot itself
have children — enforced at the write path, not just by convention. The handoff's only worked
example (Goal Physique holding a current block, a walking base, and a paused cut phase) is one
level deep, and the System card spec only describes one "Inside this" row, not a recursive
tree. Arbitrary depth would add cycle-detection and recursive-rendering complexity for a case
nothing in the spec asks for.

## Repeating steps: on-the-fly expected dates, logged actual occurrences

A Repeating step's cadence and end condition live on its `SystemStep` row; **expected**
occurrence dates are computed on the fly from that cadence, the same idiom as the Phase 1
schedule engine (`schedOf`/`isDue`) — not materialized as rows the moment the step is created.
**Actual** completions are logged in a new `SystemStepOccurrence` table (`stepId`, `occurredOn`,
`loggedAt`), mirroring the existing `Habit`/`CheckIn` split of "definition row" vs "occurrence
log rows".

This gives the cadence-adherence widget ("3+ logged occurrences", on time / late / skipped)
something concrete to diff the logged date against the computed expected date, and avoids a
backfill/regeneration problem if a Repeating step's cadence changes after creation — the same
reason the schedule engine itself never materializes a habit's expected days.

## Photos: Vercel Blob, not inline storage

The handoff explicitly lists photo storage as an unresolved gap ("decide real storage before
building System photo checkpoints"), and this phase includes the photo strip / then-and-now
widgets rather than deferring them (the user considers photo evidence important for
Experiments specifically). Decided: `photoUrl String?` on `SystemStep`, holding a CDN URL from
Vercel Blob (`@vercel/blob`'s `put()`), not binary data in Postgres.

This is a small addition to the existing deploy story (`DEPLOY.md`'s pattern of one env var per
piece of infra — `DATABASE_URL`, `APP_PASSWORD_HASH_B64` — gets one more, `BLOB_READ_WRITE_TOKEN`)
rather than a new vendor: the app is already hosted on Vercel. Uploads are capped at 10MB,
standard image MIME types, enforced client-side before the upload call; no server-side
resize/compression pipeline this phase. Deleting a Checkpoint step (or a System containing one)
deletes its Blob object in the same action — `del()` alongside the Prisma delete — rather than
leaving orphaned objects, even though orphaning would be cheap enough at this app's scale not
to matter functionally.

## Widgets: hand-rolled, no charting dependency

The System card's widget set (trend line, rating histogram, photo strip, then-and-now, numeric
trend, target gauge, small multiples, 90-day streak grid, cadence adherence, rating-vs-adherence
scatter, Gantt timeline, kanban, step chain) is built the same way `correlation-view.tsx`
already builds its comparison view: plain CSS/inline SVG, no charting library dependency. The
shapes involved (lines, bars, dots, horizontal bars on a timeline) are simple enough that a
dependency for one component group costs more than it saves, and this is a personal app with no
design-review pressure to match a library's stock look.

The rating-vs-adherence scatter widget reuses `lib/insights/split-mean.ts` directly — checkpoint
ratings are timestamped the same way pain logs are (`{date, value}[]`), so the existing n≥5-gated
correlation machinery from `CorrelationView` applies without a new function.

## Templates and runs: relative or absolute review dates, always stamped concrete on the run

A run is "a System with a `templateId`" (DATA_MODEL.md), not a separate entity, inheriting the
template's steps as a copy at creation time. An Experiment template's review date can be
relative ("N weeks after this run's start") or absolute. Decided: add `reviewOffsetDays Int?`
to `System` alongside the existing absolute `review DateTime?`, mutually exclusive at the
template level — the template author picks one flavor when creating the template.

At run-creation time, the run always gets a concrete, stamped `review DateTime`: computed as
`start + reviewOffsetDays` for a relative template, or copied straight through for an absolute
one. This means the verdict-trigger logic (a render-time `today >= review` comparison, no cron,
matching how Nudges are already computed) never needs to know which flavor of template produced
a given run — it only ever reads one concrete date.
