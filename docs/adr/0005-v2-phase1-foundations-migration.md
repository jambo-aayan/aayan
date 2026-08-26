# v2 Phase 1 (Foundations): what survives, what's additive, what reshapes

**Status**: accepted

Scope: the migration decision for Phase 1 of the design_handoff_personal_os v2 rebuild —
design tokens, the persistence layer, the schedule engine, and the correlation function.
Decided against the live production schema, ahead of any Phase 1 code, per the handoff
README's "Design decisions that look like bugs" section and its Implementation order.
Systems (Phase 4), the daily log sheet (Phase 3), and Finances' full build (Phase 5) are
out of scope for the *build* here, but Finance's schema shape is decided now anyway since
reshaping `Item` after real snapshot data exists would be the expensive mistake, not the
timing of table creation.

## Survives as-is, no shape change

`Task`, `TaskList`, `TaskTag`/`TaskTagOnTask`, `Thought`, `AppSettings`, `Session`,
`LoginLockout`. Also, two things the handoff's own "known gaps" section describes as
unsolved in the prototype but which v1 already solved:

- **`Nudge`** already has a stable `dedupKey`/`id` per row (see ADR-0002) — ahead of the
  prototype's title-keyed dismissal gap. Nothing to fix; new `NudgeType` values (revival
  prompts, stale statement uploads, etc.) land additively when Systems/Finance are built.
- **`WeeklyReviewSession`**'s five steps already match the handoff's "Close out · Habits ·
  Re-rank · Numbers · Write it" 1:1.
- **Monday-anchored weeks** (`lib/habits/streak.ts`'s `mondayOf`) already computes real
  calendar-date week boundaries correctly (handles epoch-day-0-was-Thursday). The
  prototype itself has *no* week-anchoring function at all — `windowDays()` is a plain
  trailing-N-day window — so there was no "existing bug to revisit" here; v1 is already
  ahead of the prototype on this specific point.

## Additive

**Habit schedule — count-based habits.** `HabitScheduleType` gets a new enum value
`PER_WEEK` (Postgres `ALTER TYPE ... ADD VALUE`, non-breaking) plus a new field
`scheduleTargetCount Int?`. Deliberately a new field, not a reuse of `scheduleIntervalN`:
that field means "every N days/weeks" (an interval), `scheduleTargetCount` means "N times
per week" (a count) — conflating them would make `EVERY_N_WEEKS` and `PER_WEEK` silently
share a column that means two different things. `isDue` returns `true` every day for
`PER_WEEK` (the target is a count, not a set of fixed days); `expectedCount` computes
`round(days.length / 7 * n)`; `doneCount` counts all logged days in the window
unconditionally (no `isDue` gate, since every day is eligible) — matching the prototype's
`schedOf`/`isDue`/`expectedCount`/`doneCount` exactly (verified against
`Aayan v2.dc.html` lines 4235–4346).

**Pillars.** Insert `Miscellaneous` as a new Pillar row, additive. The four deferred
Pillars (Religion, Productivity, Relationship, Career) are untouched — the handoff's
3-pillar world (Health/Finances/Miscellaneous) isn't a cancellation of those, it's simply
what's been built so far. `PILLARS_WITH_AREAS` (the map deciding area-nesting vs
tag-fallback) is a lib-level constant read by Thoughts filters, the capture composer, and
Systems scoping — not a schema change.

**Correlation gate.** Not a schema change, but recorded here since it's Phase 1's other
deliverable: `lib/insights/correlations.ts`'s `CORRELATION_MIN_N` moves from `14` to `5`,
matching the prototype's `correlate()` gate exactly (confirmed against source: `if (n < 5)
return null`, gated on total n, not per-side). `lib/pain-mobility/correlation.ts`'s
split-mean gate (`MIN_DAYS_PER_SIDE = 3`) is already correct and generalizes out of
`pain-mobility/` into a shared module, since the handoff pairs it against sleep, stress,
mood and training too, not just pain. These stay **two distinct functions** — the
prototype implements `correlate()` (Pearson's r) and `splitMean()` (mean-split average)
separately and uses them together on the same screens; DATA_MODEL.md's "one implementation
... split-mean ... returning `{r, pct, strength, n}`" describes how they're presented
together, not a single merged function.

## Reshapes (decided now, built in Phase 5)

**Health Areas — a genuine restructure, not a rename.** v1's 7 live Areas (Ankylosing
Spondylitis, Sleep, Diet, Body Composition, Blood Pressure, Looks, Healthcare Navigation —
`Area.id` is the FK target for `Habit`/`Task`/`LifeGoal`/`PainMobilityLog`/`Thought`) become
6:

| v1 Area | → | v2 Area |
|---|---|---|
| Sleep | unchanged | Sleep |
| Diet | unchanged | Diet |
| Ankylosing Spondylitis | shortened | Spondylitis |
| Body Composition | renamed | Training & body |
| Looks | renamed | Grooming |
| Blood Pressure + Healthcare Navigation | merged | Care |

Sleep/Diet/Spondylitis are effectively rename-in-place (same `id`, new `name`, or a new
slug with FK rows re-pointed — implementation detail for the build, not this ADR).
Body Composition→Training & body and Looks→Grooming are 1:1 renames with new content
scope. Blood Pressure and Healthcare Navigation are a genuine merge: both source Areas'
FK rows (any `Habit`/`Task`/`LifeGoal`/`PainMobilityLog`/`Thought` pointing at either) get
re-pointed to the single new Care Area in a one-time data migration — never left orphaned,
since an orphaned `PainMobilityLog` row would silently undercount the very n≥5 correlation
gate this phase is building.

**Finance: `Item` → `Account`, plus new tables.** v1's `Item` is a single current-value
snapshot with no history. The handoff needs per-account time series. Decided shape,
**not built until Phase 5**:

- `Item` is renamed and reshaped into `Account`: `value` → becomes the latest
  `Snapshot.balance` (no longer a column on the account itself), `liquid` → `accessible`,
  `excluded` stays. New fields: `kind` (`TRANSACTIONAL` | `VALUATION`), `cls` (free-text,
  user-editable — drives "net worth by class" grouping), `manualOnly`, `active`
  (soft-hide, keeps snapshots, same principle as a System's archived state).
- New `Snapshot` model: per-account, dated, keeps the original uploaded statement (not
  just extracted numbers) so figures are re-derivable if parsing improves later.
- `Transaction.linkedItemId` (currently an unpopulated placeholder with no real FK)
  becomes a real `accountId` foreign key.
- New `Receivable` item-type alongside asset/liability — money owed to the user, with no
  net-worth change on creation or repayment, never counted as income or spend.

No `Snapshot`/`Receivable` tables and no `Account` rename land in Phase 1 — standing up
empty tables three phases early adds migration surface with nothing writing to it yet.
This section exists so the shape is settled before Phase 5 starts, not discovered mid-build.

**Goal — stays split, not merged.** v1 has two separate models: `LifeGoal` (outcome,
status Active/Paused/Completed/Archived, no money fields) and `Goal` (finance savings
target: target/saved/monthlyContribution, no status). The handoff's single
`Goal { id, name, target, saved, monthly }` maps to v1's Finance `Goal` unchanged — the
field shape only makes sense for money, and CONTEXT.md's Goal language is Finance-specific
throughout. `LifeGoal` is untouched. Whether a Phase 4 System can link to a `LifeGoal`, a
`Goal`, or both is an open question for that phase's own grilling pass — not decided here.

## Design tokens

`app/globals.css` already matches this handoff's `DESIGN_TOKENS.md` almost exactly (bg,
surface, all six accent hexes, radii, shadows — confirmed by direct comparison). Phase 1's
tokens work is a diff-and-extend pass, not a rebuild: add anything genuinely missing
(chart-specific tokens, the class-colour hash-fallback), leave the rest. The "back-compat
alias" block (old token names pointing at the new surfaces, marked "remove once every page
has migrated") is not removed in this phase — that's an unrelated cleanup ticket, not a
Phase 1 blocker.
