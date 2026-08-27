# v2 Phase 2 (Habits and Tasks): recurrence scope, streaks, and adherence rewiring

**Status**: accepted

Scope: the design decisions for Phase 2 of the design_handoff_personal_os v2 rebuild —
check-in cycling, streaks, schedules, recurrence, My Day, and carry-over — decided ahead of
the build, per the handoff README's Implementation order. Decided against the *already-built*
v1 Task/Habit mechanics: check-in cycling (`cycleTodayCheckIn`), the recurrence engine
(`nextOccurrenceDate`), and My Day carry-over (`addYesterdayTasksToToday`) all already exist
and already match the handoff's spec closely — this phase is extension work on top of that,
not a rebuild, and none of it reshapes existing data the way Phase 1's Area merge did.

## Task's repeat rule grows, but stays narrower than Habit's schedule

Habit's schedule richness (`PER_WEEK`, `EVERY_N_WEEKS` — the latter already existed pre-Phase
1) doesn't fully carry over to `TaskRepeatRule`, unlike ADR-0003's earlier extension (which
matched Task to Habit's *then*-current richness: Daily/Weekdays/Selected weekdays/Weekly/Every
N days/Monthly/Custom).

- **`EVERY_N_WEEKS`** — added. Same shape as the existing `EVERY_N_DAYS`, no new schema field:
  `nextOccurrenceDate` computes `addUtcDays(fromDueDate, intervalN * 7)`, reusing
  `repeatIntervalN`.
- **`EVERY_N_MONTHS`** — added, prompted by DATA_MODEL.md's Task section explicitly naming
  "quarterly" as a recurrence option, which nothing in v1 covers (`MONTHLY` only ever means
  every 1 month). Rather than a one-off hardcoded `QUARTERLY` value, this is `EVERY_N_MONTHS`
  with `intervalN=3` — composable, reusing `repeatIntervalN`, consistent with treating Task's
  repeat vocabulary as primitives rather than copying the prototype's casual phrasing literally.
  `nextOccurrenceDate` computes `addUtcMonths(fromDueDate, intervalN)`.
- **`PER_WEEK`** — deliberately **not** added to Task. It's a count-based adherence-tracking
  concept ("4 times this week," measured against an expected/done count), not a
  next-due-date concept — it has no single "next occurrence" to compute, which is exactly what
  `nextOccurrenceDate` needs. Don't force it onto Task's recurrence shape.

Both new `TaskRepeatRule` values are additive Postgres enum changes (`ALTER TYPE ... ADD
VALUE`), no data migration — no existing Task row can already hold a value that doesn't exist
yet.

## PER_WEEK habit streaks

Unspecified anywhere in the handoff (DATA_MODEL.md only covers count-based habits' adherence
*percentage*, not streaks) — defined here since Phase 2's own scope includes streaks:

- A `PER_WEEK` habit's streak is **consecutive Mon–Sun weeks where `doneCount >=
  scheduleTargetCount`** for that week — the count-based analogue of `weeklyStreak`'s
  "consecutive weeks with at least one check-in," gated on hitting the count instead.
- Same Monday-anchoring as the existing `weeklyStreak` (`lib/habits/streak.ts`'s `mondayOf`).
- Same in-progress-week handling as `weeklyStreak` already has: a current week that hasn't yet
  met its target doesn't prematurely break the streak — only a fully-elapsed week that failed
  to hit target does. `weeklyStreak` already gets this right by only counting back from the
  most recent week that has a real check-in; the `PER_WEEK` version follows the same shape,
  counting back from the most recent week that actually hit its target.
- "Established" threshold: reuses the existing `WEEKLY` frequency's threshold (4 consecutive
  weeks) — no evidence anywhere in the handoff for a different number specific to count-based
  habits, so don't invent one.

## HabitStatus.ARCHIVED stays as-is; "Retired" is a copy-layer label only

SCREENS.md's Habit card spec calls the status control "Active / Paused / Retired," and
INTERACTIONS.md's empty-states table describes "Retired habit: Strikethrough name, out of
adherence maths" — exactly what `ARCHIVED` already does. Read as copy, not schema: renaming a
live enum value is exactly the kind of hard-to-reverse migration Phase 1 was built to avoid
introducing more of, for a difference that's cosmetic. `HabitStatus.ARCHIVED` is untouched;
the Habit status control adds `"ARCHIVED": "Retired"` to a label map, the same pattern
`REPEAT_LABEL`/`REMINDER_LABEL` already use for enum-value-to-copy translation.

## Adherence call-site rewiring is split across Phase 2 and Phase 6

Phase 1 (ADR-0005) deliberately left `lib/insights/consistency.ts`, `momentum.ts`, `kpis.ts`,
`weekly-digest.ts`, and `lib/nudges/data.ts` on their pre-`expectedCount`/`doneCount` logic,
since nothing could create a `PER_WEEK` habit yet. Phase 2 is exactly what makes that
possible, so leaving all five untouched is no longer safe — a `PER_WEEK` habit read by code
that doesn't know about it (e.g. treating `habitOccursOn`'s always-`true` `PER_WEEK` case as
"due every day") would silently corrupt a shared number, the same class of problem the
correlation-gate fix (ADR-0005) existed to prevent.

Split by how directly each surface shows a `PER_WEEK` habit's own numbers:

- **Phase 2**: the Habit card's own streak badge and adherence percentage; `consistency.ts`
  (DATA_MODEL.md's own "single source of truth" component for the 28-day grid — every other
  Insights surface either reads through it or duplicates its logic, so it can't be left wrong).
- **Phase 6** (Insights, built last, per the handoff's own ordering): `kpis.ts` (KPI strip
  wording), `momentum.ts`, `weekly-digest.ts` (digest phrasing), `nudges/data.ts` (nudge
  eligibility rules). These get their full rewiring and polish pass once Insights is actually
  being built, not as a Phase 2 side quest.
