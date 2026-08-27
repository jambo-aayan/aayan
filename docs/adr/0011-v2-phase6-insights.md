# v2 Phase 6: Insights — reconnecting PER_WEEK/Finance-reclassification bugs, and bringing Systems in

Phase 6 is the "full rewiring and polish pass" ADR-0006/ADR-0007 both deferred until Insights was
actually being built, rather than doing it as a side quest in Phase 2/3. `lib/insights/` itself
predates this rebuild almost entirely (commits #68-#78, before Phase 1 even started) and was only
ever kept *compiling* through each schema change since, never rewired onto the new behavior each
phase introduced. Decided ahead of `/to-spec`, working from the repo itself — CONTEXT.md's
Insight glossary entry and the ADR-0006/0007 deferred-work notes — since no external design
handoff doc exists for this phase.

## Two real correctness bugs, not just deferred polish

Auditing `lib/insights/` against the current data model surfaced two genuine bugs, not just
stale wording:

**`computeSurplusRate`** (`lib/insights/momentum.ts`, backing both the Momentum score and the
Surplus Rate KPI card) sums every OUT transaction with no exclusion for `receivableId`/
`goalContributionId`. Per ADR-0010/#114/#120, a transaction flagged "this became a receivable" or
"this went toward Goal X" is a reclassification, not real spend — every other spend-total
consumer (`categoryBreakdown`, `budgetVsActual`) already excludes both. `computeSurplusRate` and
`getCorrelations`' own hand-rolled `surplusByDay` loop (a second, independent implementation of
the same exclusion rule) both get fixed to exclude them, and the correlations one is rewritten to
call `computeSurplusRate` per-day instead of duplicating its logic — one rule, not two that can
drift apart, the same principle #123 applied when it fixed `categoryBreakdown`'s own version of
this exact gap.

**PER_WEEK ("N× a week") habit adherence** is unfixed in `momentum.ts`'s `adherenceForHabit`,
despite `habitOccursOn` (the schedule engine) having supported PER_WEEK since Phase 2. Because
`habitOccursOn` answers "is this due today" with a flat `true` every day for PER_WEEK (the real
gate is the count, not a per-day due/not-due split — see its own doc comment), `adherenceForHabit`
currently treats a 4×/week habit as scheduled all 7 days, deflating its adherence percentage by
counting un-due days as missed. `lib/insights/consistency.ts` already fixed this for the
Consistency grid (Phase 2, "rewire onto expectedCount") by swapping its `scheduled` count onto
`expectedCount`/`doneCount` while keeping a day-by-day `logged` accumulation for MINIMUM's 0.5
partial credit. `momentum.ts`'s `adherenceForHabit` gets the identical treatment. Because
`kpis.ts`'s adherence KPI, `weekly-digest.ts` (via `getKpiSummary`), and `getCorrelations`'
adherence-by-day series all call into `momentum.ts` rather than reimplementing the math, this one
fix reconnects all three — no separate rewiring needed per ADR-0006's original worry.

The same bug exists in `lib/nudges/data.ts`'s `scheduledToday` (the `HABIT_DUE` nudge's
eligibility check), which also calls `habitOccursOn` naively. A PER_WEEK habit that's already hit
its weekly target still reads `scheduledToday: true` for the rest of the week, firing a nudge
every remaining day past the goal. Fixed to mean "target not yet met this week" — comparing
`doneCount` for the current week against `scheduleTargetCount` (now selected in the Prisma query,
previously omitted since nothing read it) — rather than delegating to `habitOccursOn` alone.
`STREAK_AT_RISK`'s "consecutive days" framing doesn't transfer to a count-based habit either:
for PER_WEEK, it's redefined as days-remaining-this-week vs. shortfall-from-target, not
`dailyStreak`.

## Systems gets one KPI: "on track", scoped to Experiments only

Systems (Phase 4) currently has zero presence anywhere in Insights — no KPI, no correlation, no
Attention Balance tie-in. Decided: a 5th KPI card, "Systems on track" — the percentage of ACTIVE
Experiments with no overdue, unresolved review, reusing `lib/systems/logic.ts`'s `isVerdictDue`
directly (the same check the `SYSTEM_REVIEW_DUE` nudge already uses) rather than inventing a
second definition of "overdue."

Deliberately **Experiments only** — Processes have no review-date/verdict concept at all (per
DATA_MODEL.md §5, a Process's "mark concluded" is an open-ended note, not a pass/fail against a
date), so there's no natural due-date to be "on track" against. Folding Process adherence
(missed Repeating-step occurrences) into the same percentage would combine two genuinely
different meanings of "on track" into one number nobody could explain — the same "a score nobody
can explain gets ignored" principle Momentum's own fixed weights already encode. When there are
no ACTIVE Experiments, the KPI honestly reports that rather than fabricating 100%, matching every
other threshold-gated widget in this app (`lib/systems/widgets.ts`, `yearOverYearComparison`,
etc.).

## Two new correlation pairs, in two different shapes

ADR-0005's own `split-mean.ts` doc comment named "sleep vs. stiffness, trained vs. mood" as the
pairs this module was generalized for — neither has ever been wired into an actual Insights
display.

**Sleep-vs-stiffness** is two continuous DailyLog fields (`sleepQuality`, `stiffness`) — a
straightforward 4th entry in `getCorrelations()`'s existing Pearson-correlation `pairs` array,
same shape as the three pairs already there.

**Trained-vs-mood** is a boolean predicate (did the seeded `TRAINED_HABIT_ID` habit get checked
in that day) against a continuous value (`DailyLog.mood`) — this is what `split-mean.ts` computes
(mean-split, not Pearson's r), and `getCorrelations()`'s existing `CorrelationsSection` only
renders `r`/`n`/strength-shaped results. Rather than force a boolean predicate through Pearson
(which would need an arbitrary 0/1 encoding and misrepresent what's being measured), this ships
as its own small card next to Correlations, reusing `splitMean` directly — the same function
`lib/systems/widgets.ts`'s `ratingVsAdherence` already calls for an analogous boolean-vs-
continuous shape (per ADR-0008).

## Out of scope

- Rewiring `weekly-digest.ts`'s own prose/phrasing beyond what it inherits for free from the
  `momentum.ts`/`kpis.ts` fixes above — no new digest sections.
- A Systems-specific correlation pair (e.g. rating vs. some other series) — the KPI above is
  Phase 6's whole Systems footprint; a correlation pair is a separate, later decision if wanted.
- Attention Balance counting Systems activity toward a Pillar's actual time-share — considered
  and explicitly declined in favor of the single KPI card, to avoid stretching one Insights
  surface's definition of "attention" across two unrelated measurement models in the same pass.
