# v2 Phase 3 (Daily log sheet): a new model, not an extension of PainMobilityLog

**Status**: accepted

Scope: the design decisions for Phase 3 of the design_handoff_personal_os v2 rebuild — the
daily log sheet (DATA_MODEL.md §7) that feeds Spondylitis, Sleep, Care and every correlation
— decided ahead of the build, per the handoff README's Implementation order. Unlike Phase 2,
this phase has no existing v1 mechanic to extend: `PainMobilityLog` is the only related model
already built, and it turns out not to be the same concept as the new sheet, not a narrower
version of it.

## New `DailyLog` model; `PainMobilityLog` stays untouched

The new sheet is a **single cross-cutting entry per date** — not per Area — covering mood,
stress, energy, sleep quality, pain, headache, stiffness, and optional weight/waist/BP, all on
a **1–5 scale** (per DATA_MODEL.md's "Scale consistency" rule). `PainMobilityLog` is
Area-scoped (currently only Spondylitis), stores `pain`/`mobility` on a **0–10 scale**, and is
live production data.

These can't be the same table — different grain (per-date vs per-Area-per-date) and different
scale. Decided: add a new `DailyLog` model with the full DATA_MODEL.md §7 field set;
`PainMobilityLog` is left exactly as it is, no shape change, no data migration. New pain
entries land in `DailyLog.pain` (1–5) going forward; old `PainMobilityLog.pain` rows (0–10)
remain queryable as historical record on their own.

**Explicitly not done**: converting old `PainMobilityLog.pain` values into `DailyLog` rows via
a 0–10→1–5 mapping. A converted historical point is not the same measurement as a real 1–5
entry — mixing the two scales in one `correlate()` call would fabricate continuity that isn't
there, which is exactly what the handoff's honesty rules exist to prevent. If a chart ever
needs to span the transition, that's a display-layer "series resumes on date X" concern to
solve later, not a reason to lossily rewrite history now.

## `mobility` and `trained` are derived from specific habits, not sheet inputs

DATA_MODEL.md: `stateLog.mobility` comes from "the stretch-routine habit check-in, not a daily
rating" — the standalone mobility rating was removed for overlapping with stiffness.
`stateLog.trained` (referenced in the correlation section) works the same way, from a
"Trained today" habit. Neither is a field on the daily log sheet itself.

Nothing in the schema currently designates a `Habit` row as playing either role. Decided:
stable seeded habit-ID constants, mirroring `lib/health/seed-data.ts`'s existing
`ANKYLOSING_SPONDYLITIS_AREA_ID` pattern exactly — e.g. a `STRETCH_HABIT_ID` and a
`TRAINED_HABIT_ID` backed by real seeded `Habit` rows, read by whatever computes `DailyLog`'s
derived fields at save time.

**Explicitly not done**: a general-purpose "role" flag on `Habit`. That solves a problem that
doesn't exist yet — there are only ever these two derived fields per the current spec — and
the seeded-constant pattern is already proven elsewhere in this codebase. Generalize only if a
third derived-from-habit field actually shows up.

## Headache's day's-worst rule is a silent no-op, not an error

DATA_MODEL.md: headache tracks the day's worst value; "a lower tap later in the day is
refused, not allowed to erase a bad morning." Decided: the control simply doesn't move to the
lower value — no error toast, no explanation shown. This isn't a failure case; it's the field
correctly reflecting what already happened today, and a toast would misrepresent a normal,
expected interaction as something going wrong. Needs a small severity-ordering utility
(`NONE < MILD < MODERATE < BAD`), the same shape as the existing `CheckInLevel` cycling logic
in `lib/habits/check-in.ts`.

## Natural-language input is deferred past Phase 3

INTERACTIONS.md's one interaction detail beyond DATA_MODEL.md's field list: "a
natural-language input parses 'weight 78.2, pain 3, stiff 20 min, headache mild'." This is a
nontrivial keyword/unit extraction parser across ~9 fields with synonyms — a different kind of
problem than the existing `chrono-node`-based date parser (`lib/tasks/natural-date-parser.ts`),
which only handles dates.

Decided: Phase 3 ships the structured form only — numeric inputs and segmented controls per
field, full validation, the headache/stiffness business rules, honest blanks for untouched
optional fields. The NL parser is a follow-on enhancement once the structured form and its
save path are proven, matching how Phase 1 and Phase 2 both deferred creation-form UI work as
a separate concern from the underlying mechanics (e.g. no `PER_WEEK` habit-creation form landed
alongside the schedule engine itself).

## Phase boundary: raw values vs. correlations

Following ADR-0006's precedent for where Insights-surface work lands: displaying the log
sheet's own raw values on the Spondylitis/Sleep/Care area pages (DATA_MODEL.md: "Spondylitis —
pain and stiffness from the log sheet... Sleep — sleep-vs-stiffness computed through the
shared correlation function") is Phase 3 scope for the raw-value half — it's literally what
"feeds" those pages means. Actually wiring new correlation pairs (sleep-vs-stiffness,
trained-vs-mood, etc.) into Insights displays is Phase 6 work, the same split already applied
to `kpis.ts`/`momentum.ts`/`weekly-digest.ts`/`nudges/data.ts` in Phase 2.
