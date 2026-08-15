# Personal Life Management System

A personal life-management app covering health, habits, finance, and life admin for a single user. Originally prototyped as a single-file HTML/JS Claude.ai artifact (`window.storage` persistence, see `prototype/life-management-prototype.html`); this repo is the rebuild with a real backend and database, motivated mainly by unreliable persistence in the artifact environment (client-side storage intermittently failed with "Internal server error" / "Unexpected response type").

**Single user. No multi-tenancy needed** for now — a possible future product to sell has been mentioned, but nothing here is designed for multi-tenancy yet. Auth can be a simple password gate rather than a full identity provider.

> **Status: actively being charted via `/wayfinder`.** The structure below reflects a restructuring decided during that charting session (see the `wayfinder:map` issue for the full decision trail) — it supersedes the flatter "10 buckets" model from the original prototype chat. MVP scope is **Health + Finances** only; the other Pillars are sketched but deliberately left loose until their turn comes.

## Language

**Pillar**:
A top-level life domain — the highest level of the hierarchy. MVP Pillars: Health, Finances. Deferred Pillars: Religion, Productivity, Relationship, Career.
_Avoid_: Bucket (the original prototype's term — replaced for being too informal), Category.

**Area**:
A sub-topic within a Pillar, e.g. Sleep or Diet within Health. Carries over the original prototype's "buckets" one level down. Not every Pillar needs Areas — Finances' existing shape (Items, Baseline, Goals, Expenses, North Star) doesn't need them.
_Avoid_: Sub-bucket, Topic.

**System** (deferred — not required for Health+Finances MVP):
A process within a single Pillar that can target one Area or several Areas in that same Pillar at once — e.g. a stretch routine that improves both the Ankylosing Spondylitis and Body Composition Areas within Health. Systems don't cross Pillars. Concept kept for later — build a real System only once a concrete one earns a dedicated screen (e.g. "Payday routine"); for MVP a System can just be an informal label rather than a managed object.
_Avoid_: The original prototype's "layer above buckets" framing — that's now inverted; Systems live inside a Pillar, not above all of them.

**Action**:
A Habit or Goal — the day-to-day or one-off unit of work. Attaches either directly to an Area, or to a System (as one of the steps that make the System work). Never required to have both — a simple habit with no System is fine.
_Avoid_: Task (reserved for wayfinder's own ticket type — don't reuse it for in-app items).

**Cross-Pillar link**:
When something genuinely spans two Pillars (e.g. "buy a house" touches both Finances and Relationship), it lives in exactly one Pillar as its source of truth, with a visible link from the other — never duplicated as two independent copies. Extends the cross-links the original prototype's mind-map view already drew between buckets.

**North Star**:
Every Pillar has one, and every Area has one — a single headline goal that Actions within it work toward, always visible when you open that Pillar or Area. Originally a Finances-only concept (see "Finance" below); generalized to the whole hierarchy.
_Avoid_: Don't confuse with an ordinary Goal — a North Star is the *one* headline target for its Pillar/Area, not one of potentially several Goals.

**Current state**:
A short free-text status field on an Area — where things stand right now (e.g. "Mild, well-managed"), editable anytime, shown prominently alongside the Area's North Star. Distinct from the North Star (the target) and from Actions (the day-to-day work). Free text rather than a fixed severity scale — a scale that fits a health condition wouldn't fit every Area, and a free field needs no upfront taxonomy design.

## Pillars

### Health (MVP)
Areas: Ankylosing Spondylitis, Sleep, Diet, Body Composition, Blood Pressure, Looks, Healthcare Navigation. See "Existing content, tuned to this user" below — these Areas carry their prior detail forward unchanged, just renested under Health. Health itself has a Pillar-level North Star (not yet chosen); each Area has its own North Star plus a free-text Current state (see "Language").

**Area naming convention**: Areas are named for the user's actual, specific issue or focus — not a generic category. "Spine & Pain" became "Ankylosing Spondylitis" for this reason. Apply the same lens to any new Area; existing Areas with already-specific names (Sleep, Diet, ...) don't need renaming.

### Finances (MVP)
Keeps its existing shape from the original prototype (see "Finance" below) — Items, Baseline, Goals, Expenses, North Star. No Area layer needed; Systems (e.g. "Payday routine") and Actions attach directly. Its existing North Star (house deposit) is the Pillar-level one.

### Religion (deferred)
Carries forward Jumma (Friday prayer) and Quran reading from the original prototype. Not yet re-examined under the Pillar/Area/System model — revisit when this Pillar's turn comes.

### Productivity (deferred)
Existed in the original prototype as a flat bucket; not yet re-examined under the new model.

### Relationship (deferred)
About the user's relationship with his partner, Faria — wedding planning (getting married next summer), important shared dates/calendar, and a distinct sentimental sub-section for memories/highlights/moments from their conversations. Confirmed as in-scope and fairly wide, but not yet broken into Areas/Systems — deferred past MVP.

### Career (deferred, name not fully settled — working name, was "Startup")
Two parts: the user's day job (e.g. sample-apps work) and Jumbo Labs (his startup with friends), each with further sub-parts. Ideas floated but not committed: an agent that keeps a CV up to date, an agent that surfaces job opportunities. Explicitly open-ended — user is still open to suggestions here. Deferred past MVP.

**Dropped**: "Funeral" was floated as a possible Pillar but confirmed as a stray thought, not a real one — not in scope.

## Habits
- `frequency`: `daily` or `weekly`.
- **Daily**: streak = consecutive calendar days checked in. "Established" at 7 consecutive days.
- **Weekly**: streak = consecutive **Monday–Sunday weeks** with at least one check-in that week (any day within the week counts — e.g. laundry is "Saturday or Sunday", both should count as the same week). "Established" at 4 consecutive weeks.
  - ⚠️ **Bug already hit once**: a naive `floor(epochDays / 7)` week index doesn't align to real Mon–Sun weeks. Verify week-boundary math against real dates (a Saturday and the following Sunday must land in the same week) before reusing any week-index logic.
- **Check-in has 3 states**: not checked / **full** / **minimum**. Minimum still counts toward the streak (protects consistency on a bad day — this was a deliberate design decision, not an oversight) but renders visually distinct (e.g. faded/half-filled) so it's never indistinguishable from a full day. Tapping cycles: none → full → minimum → none.
- **Active/inactive toggle.** Inactive habits are excluded from *everything* that measures the user — streaks, badges, weekly review, headache correlation, appointment prep sheets — but stay visible (dimmed), not deleted.
  - **New/seeded habits default to inactive.** The user opts in rather than opts out. This is intentional: starting too many habits at once is a known failure pattern for this user, and the seed data intentionally includes more habits than should ever run simultaneously.

## Goals
One-off, has `status` (not-started / in-progress / done), optional `dueDate`. Goals added via the "My Day" quick-add get a `myday: true` flag. **Only `myday`-flagged goals (plus habits) surface in the My Day view** — ordinary backlog goals deliberately stay out of the daily view, living in their Area/Pillar and in an "All Actions" cross-cutting list instead. This distinction was added after the user found the daily view cluttered with non-daily backlog items — don't merge them back together.

## Thoughts
Free-text, dated journal entries. **Cross-cutting, not Pillar-bound** — a quick-add reachable from the homepage (same pattern as the old "My Day" quick-add), for a general daily journal that can be about anything. Tagging a Thought to a specific Pillar or Area is *optional*, not mandatory — use it when a Thought is actually about Health, or Finances specifically; leave it untagged for a general entry. Optionally prompted (dismissible, never forced) after a habit check-in or goal status change. In MVP scope.

## Finance
Separate net-worth tracker, living inside the Finances Pillar:
- **Items**: assets/liabilities. `liquid: true` marks instant-access cash (drives the emergency-fund "runway" calc). `excluded: true` marks the pension — tracked and shown, but deliberately excluded from the headline net-worth figure because the user doesn't count money he can't access for ~30 years. Both **accessible net worth** and **total net worth** should exist as distinct, separately-labelled numbers.
- **Baseline**: monthly income + fixed outgoings → surplus.
- **Goals**: target / saved / monthly contribution → progress bar + projected completion date. Should warn if committed monthly amounts across goals exceed actual surplus.
- **Expenses**: dated one-off known costs, separate from recurring baseline items.
- **North Star**: one headline target + deadline, tracked against *accessible* net worth specifically, with a live on-track/behind verdict based on required vs actual monthly rate.

## Symptoms (deferred — not in Health+Finances MVP)
Simple daily log: headache (none/mild/bad), sleep (poor/ok/good). Feeds a correlation view (habit-done days vs headache days), scoped to the Health Pillar. **Deliberately conservative** — requires a minimum sample (~6 logged days, ~3 days on each side of a habit) before showing any comparison, and is always framed as "something to raise with a clinician," never as a diagnosis or conclusion. Don't remove these guardrails to make the feature feel more "finished." Fully designed already, from the original prototype — just not part of this MVP; revisit post-launch.

## Appointments (deferred — not in Health+Finances MVP)
Name + date, scoped to the Health Pillar. Generates a "prep sheet" beforehand (symptom summary, habit adherence, background context, blank space for the user's own questions) and prompts for outcome notes afterward. The follow-up half matters as much as the prep half — the thing that gets lost with multiple clinicians over months is what the last one actually said. Fully designed already, from the original prototype — just not part of this MVP; revisit post-launch.

## Behavioural principles (learned by hitting them — keep these)
1. **Low-maintenance is a hard constraint**, stated explicitly and repeatedly by the user. Features that add friction to routine daily input have been rejected before (e.g. a frequency picker on every habit add, tags on every task). Any new recurring-input feature should have a sensible default and *not* ask a question every time it's used.
2. **Seeding must be per-item and idempotent, not per-Pillar.** New content added after the user has already interacted with an Area/Pillar must still apply on next load. Track applied seeds by a stable, human-readable string ID (e.g. `diet-protein`), not a coarser "already seeded" boolean — the first version of this got it wrong and silently dropped new seed items.
3. **Undo over confirmation dialogs** for routine deletes. A brief toast with an undo action beats a modal "are you sure?" for anything low-stakes. Reserve harder confirmation for genuinely destructive bulk actions (e.g. a full data reset).
4. **Never silently swallow a failed save.** Surface it, retry with backoff, and give the user a manual backup path as a last resort. This was the direct trigger for the rebuild — don't reintroduce silent failure.
5. **Escape all user-entered text before rendering into HTML.** Fixed once already after an audit; keep it fixed.
6. **Ask before big architectural additions**, propose a concrete design, and let the user redirect — this user engages well with a clear proposal plus 1-3 tightly-scoped questions, not open-ended "what do you want" prompts.

## Existing content, tuned to this user (reuse, don't regenerate)
- **Ankylosing Spondylitis** (Health Area): ankylosing spondylitis (mild), cervicogenic headaches, rounded shoulders. Cascade: lumbar stiffness → desk-to-bed slouch → neck flexion → headache. No heavy axial loading, no barbell squats/deadlifts — spine-safe exercise selection throughout.
- **Sleep** (Health Area): possible OSA under investigation (witnessed pauses, daytime sleepiness); phone-in-bed flagged as highest-leverage change.
- **Diet** (Health Area): dislikes most fruit/veg plus separate anxiety around trying new foods — build from what already works, never push unfamiliar produce. Protein is a relative strength.
- **Body Composition** (Health Area): reframed from a weight target to muscle-to-fat ratio; track waist + photos over scale weight.
- **Blood Pressure** (Health Area): previously elevated, resolved after ~10kg weight loss.
- **Finances**: UK-based. LISA under-40 first-time-buyer bonus is the highest-priority savings vehicle (25% guaranteed return, £450k property cap — a real constraint in Surrey). Pension: 5% employee + 11% employer (exceptional, ~£10k/yr growth). Emergency fund → LISA → wedding → S&S ISA is the priority order. Dental work is explicitly conditional on the quote being reasonable, not a committed goal. (A house purchase, 3-4 years out, is anticipated — will need a cross-Pillar link to Relationship once that Pillar is designed.)
- **Religion**: Islamic practice — Jumma (Friday prayer), Quran reading.

## Migrating existing data
The Claude.ai artifact has a working **Export** feature (Map view footer) producing a single JSON blob of the full app state. Bring that file into the new project and write a one-time import script/endpoint mapping it onto the new schema — don't ask the user to re-enter months of habit history, streaks, or financial figures. Treat the exported JSON's shape as the source of truth for what fields exist; it reflects everything actually built, not just what's documented here. The old flat "bucket" list in the export will need mapping onto the new Pillar → Area structure (Health absorbs most of the old buckets; Finances and Religion carry over closer to as-is).

## Stack

See [ADR-0001](./docs/adr/0001-stack-choice.md) for the stack decision and reasoning — kept out of this file since `CONTEXT.md` is domain vocabulary only, not implementation detail.
