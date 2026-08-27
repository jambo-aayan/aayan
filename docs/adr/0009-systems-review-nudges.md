# System review-due Nudges: materialized, first navigating primary action, run nudges point at the template's card

A follow-up to Phase 4 (Systems): tie an Experiment's overdue review date into the existing
Nudges surface (ADR-0002), instead of leaving it as a card-only, render-time `isVerdictDue`
check. Three deliberate deviations from every existing Nudge type, decided while grilling:

- **Materialized, not render-time.** `isVerdictDue` (`lib/systems/logic.ts`) is a pure
  comparison, recomputed on every render, with no stored row — the opposite of how every
  existing Nudge type works (cron-materialized rows, see ADR-0002). A new `SYSTEM_REVIEW_DUE`
  type follows the Nudges precedent (matching `TASK_OVERDUE`'s cadence and toggle-less,
  always-on delivery) rather than inventing a third pattern — it gets the unread badge, the
  Nudges tab, and snooze for free, and `isVerdictDue` itself is untouched, still gating the
  card's own "Set verdict" UI.

- **First primary action that actually navigates.** Every existing Nudge type's primary action
  button only calls `markNudgeRead` — despite labels like "Log now" or "Open review", none of
  them navigate anywhere. `SYSTEM_REVIEW_DUE`'s primary action deep-links via the #108 focus
  mechanism (float-to-top, coral ring) *and* marks read, because the plumbing already exists and
  a review-due nudge with nowhere to click through to would be a worse first impression of the
  pairing than any existing type currently gives. This is a genuine behavioral split from the
  other six types, not yet backported to them.

- **A run's nudge targets its template's card, not itself.** An actual run (a `System` row with
  `templateId` set) never gets its own card — `SystemsList` only renders template/standalone
  rows; a run only appears nested inside its template's "Runs" section. So while eligibility and
  the dedup key are still per-run (three overdue runs of one template surface three separate
  nudges), the deep link on all of them points at the template's card, where the actual
  "Set verdict" control lives.

Dedup key: `system-review:{id}:{date}`, severity 3 (same tier as `TASK_OVERDUE`) — same
per-day-dedup, no-auto-resolve-on-unread precedent as every other type (ADR-0002); only a
snoozed row gets re-checked on wake.
