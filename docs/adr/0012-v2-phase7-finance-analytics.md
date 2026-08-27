# v2 Phase 7: Finance analytics — spend-vs-usual deviation, a Systems/surplus correlation, and promoting buried Statements analytics to Finance home

Prompted by the user asking for something that tells them "you've spent X more, or X% more, on Food
than usual this month." Auditing `lib/finance/` to answer that turned up two of the four candidate
features already built, just narrowly scoped: `lib/finance/statements.ts` (#118, ADR-0010) already
has `categoryTimeSeries` (6-month per-category totals) and `detectRecurringCharges`
(source+amount pairs repeating in 2+ distinct months) — both wired only into the
`/finances/statements` page, a manual-import-review flow the user doesn't land on routinely.
Neither is documented in `CONTEXT.md`'s Finance section. Decided from the repo, no external
design handoff doc for this phase, same as ADR-0011.

## What's actually new: the deviation callout

Nothing in the codebase computes a rolling "usual" baseline. The closest precedent,
`detectAnomalies` (also in `statements.ts`), flags a single transaction more than 2x its
category's mean — but that's a per-transaction judgment within one batch of statement-import
rows, not a persistent monthly comparison. `monthOverMonthDiff` and `yearOverYearComparison`
exist but are whole-spend only, not per-category.

New pure module: `lib/finance/spend-deviation.ts`. "Usual" = the average of `categoryBreakdown`
totals over the 3 calendar months immediately preceding the target month — a trailing average
reads as an ongoing habit, not one arbitrary reference point (a specific prior month, or the same
month a year ago), and 3 months matches the existing minimum-sample-size precedent already used
by `detectAnomalies` (`list.length < 3` gate) and Insights correlations (`CORRELATION_MIN_N`).

A category is only eligible for a deviation once it has nonzero spend in *each* of those 3
preceding months — not just that 3 months have elapsed — so a baseline is never built on mostly-
empty months (honest-empty-state pattern, matching `yearOverYearComparison`'s null-until-second-
year and `computeGoalVelocityKpi`'s "No active goals yet"). Below that threshold, the category
still appears in ordinary breakdowns, just without a deviation figure attached.

Whole-month spend gets the same treatment over `monthSpendTotal` instead of `categoryBreakdown` —
essentially free to add alongside the per-category version, and it's the more important number for
the North Star/surplus-rate story than any single category.

A deviation only becomes a visual callout (danger tone for "spent more", quiet positive note for
"spent less") past a ±20% band; inside that band the number still shows, just without a callout.
20% (vs. the 10-point band `computeSurplusRate`'s trend phrase already uses for "improving/
shrinking") avoids flagging ordinary month-to-month noise on categories, where relative swings run
larger than on a single surplus-rate percentage.

Surfaces as a new card on the Finance home page (`app/(protected)/(shell)/finances/page.tsx`), not
folded into the Insights weekly digest (this is finance-specific commentary, not a cross-Pillar
Insight) and not a Nudge (nothing actionable to check off — it's informational).

## Systems-on-track × surplus: the correlation pair ADR-0011 deferred

ADR-0011 explicitly punted "no Systems correlation pair yet." `computeSystemsOnTrackKpi`
(`lib/insights/kpis.ts`) already computes on-track % as a point-in-time snapshot via a private
`isOnTrack`/`onTrackPct` pair, callable at an arbitrary `asOf` date — the same shape
`getCorrelations()`'s other pairs need (one numeric value per day). `isOnTrack` gets exported so
`getCorrelations()` can reuse it directly rather than re-deriving the on-track predicate a second
time, the same "one rule, not two that can drift" principle ADR-0011 applied to the surplus-
exclusion fix.

## Promoting existing analytics to Finance home

`categoryTimeSeries` and `detectRecurringCharges` get wired into two new cards on Finance home,
alongside the existing `CategoryBreakdownView` (this-month bars) and `TrendChart` (cumulative cash
flow). The Statements page keeps both as-is — this isn't a move, just no longer exclusive to a
page the user only visits after uploading a statement.

## Out of scope

- Budget vs. actual is untouched — already built and already on Finance home (#123).
- No new correlation pairs beyond Systems-on-track × surplus.
- No per-transaction anomaly surfacing outside the existing Statements-page `detectAnomalies` flow.
- No subscription-cancellation action or reminder tied to `detectRecurringCharges` — display only,
  same as today.
- No deviation callout for Goals or North Star projections — spend categories and whole-month
  spend only.
