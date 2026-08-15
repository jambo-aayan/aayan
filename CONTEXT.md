# Personal Life Management System

A personal life-management app covering health, habits, finance, and life admin for a single user. Originally prototyped as a single-file HTML/JS Claude.ai artifact (`window.storage` persistence, see `prototype/life-management-prototype.html`); this repo is the rebuild with a real backend and database, motivated mainly by unreliable persistence in the artifact environment (client-side storage intermittently failed with "Internal server error" / "Unexpected response type").

**Single user. No multi-tenancy needed.** Auth can be a simple password gate rather than a full identity provider.

> **Status: initial import, not yet settled.** This is the domain model as discussed in the prototype's originating chat — detailed for the elements that came up there, but the user isn't yet sure of the full breadth/scope of the tool, and the structure below may change. Treat this as a primary source for `/wayfinder`'s charting session, not a locked spec.

## Domain model

### Buckets
Ten life-domain categories, each shown as a node on a radial "mind map" view with cross-links between related buckets: **Spine & Pain, Sleep, Diet, Body Composition, Blood Pressure, Productivity, Looks, Healthcare Navigation, Money, Religion**. See "Existing bucket content" below for what's already tuned per bucket — don't regenerate this from scratch.

### Actions
Belong to a bucket. Either a **Goal** (one-off, `status`: not-started / in-progress / done, optional `dueDate`) or a **Habit** (recurring).

### Habits
- `frequency`: `daily` or `weekly`.
- **Daily**: streak = consecutive calendar days checked in. "Established" at 7 consecutive days.
- **Weekly**: streak = consecutive **Monday–Sunday weeks** with at least one check-in that week (any day within the week counts — e.g. laundry is "Saturday or Sunday", both should count as the same week). "Established" at 4 consecutive weeks.
  - ⚠️ **Bug already hit once**: a naive `floor(epochDays / 7)` week index doesn't align to real Mon–Sun weeks. Verify week-boundary math against real dates (a Saturday and the following Sunday must land in the same week) before reusing any week-index logic.
- **Check-in has 3 states**: not checked / **full** / **minimum**. Minimum still counts toward the streak (protects consistency on a bad day — this was a deliberate design decision, not an oversight) but renders visually distinct (e.g. faded/half-filled) so it's never indistinguishable from a full day. Tapping cycles: none → full → minimum → none.
- **Active/inactive toggle.** Inactive habits are excluded from *everything* that measures the user — streaks, bucket badges, weekly review, headache correlation, appointment prep sheets — but stay visible (dimmed) in their bucket, not deleted.
  - **New/seeded habits default to inactive.** The user opts in rather than opts out. This is intentional: starting too many habits at once is a known failure pattern for this user, and the seed data intentionally includes more habits than should ever run simultaneously.

### Goals
One-off, has `status`. Goals added via the "My Day" quick-add get a `myday: true` flag. **Only `myday`-flagged goals (plus habits) surface in the My Day view** — ordinary bucket-backlog goals (the ones seeded per-bucket, e.g. "Design AS routine") deliberately stay out of the daily view. They live in their bucket and in an "All Actions" cross-bucket list instead. This distinction was added after the user found the daily view cluttered with non-daily backlog items — don't merge them back together.

### Thoughts
Free-text, dated journal entries attached to a bucket. Optionally prompted (dismissible, never forced) after a habit check-in or goal status change.

### Systems
A layer *above* buckets, not inside them. Each System has: a philosophy/description (free text, "the method"), a checklist of setup-or-milestone steps (own completion state, independent of any habit streak), and links to specific habits/goals elsewhere for live-status reference (tapping a link jumps to the source). The same shape handles both ongoing processes (diet, decluttering) and one-off projects (wedding planning) — no need for a hard type split between them.

### Finance
Separate net-worth tracker:
- **Items**: assets/liabilities. `liquid: true` marks instant-access cash (drives the emergency-fund "runway" calc). `excluded: true` marks the pension — tracked and shown, but deliberately excluded from the headline net-worth figure because the user doesn't count money he can't access for ~30 years. Both **accessible net worth** and **total net worth** should exist as distinct, separately-labelled numbers.
- **Baseline**: monthly income + fixed outgoings → surplus.
- **Goals**: target / saved / monthly contribution → progress bar + projected completion date. Should warn if committed monthly amounts across goals exceed actual surplus.
- **Expenses**: dated one-off known costs, separate from recurring baseline items.
- **North Star**: one headline target + deadline, tracked against *accessible* net worth specifically, with a live on-track/behind verdict based on required vs actual monthly rate.

### Symptoms
Simple daily log: headache (none/mild/bad), sleep (poor/ok/good). Feeds a correlation view (habit-done days vs headache days). **Deliberately conservative** — requires a minimum sample (~6 logged days, ~3 days on each side of a habit) before showing any comparison, and is always framed as "something to raise with a clinician," never as a diagnosis or conclusion. Don't remove these guardrails to make the feature feel more "finished."

### Appointments
Name + date. Generates a "prep sheet" beforehand (symptom summary, habit adherence, background context, blank space for the user's own questions) and prompts for outcome notes afterward. The follow-up half matters as much as the prep half — the thing that gets lost with multiple clinicians over months is what the last one actually said.

## Behavioural principles (learned by hitting them — keep these)
1. **Low-maintenance is a hard constraint**, stated explicitly and repeatedly by the user. Features that add friction to routine daily input have been rejected before (e.g. a frequency picker on every habit add, tags on every task). Any new recurring-input feature should have a sensible default and *not* ask a question every time it's used.
2. **Seeding must be per-item and idempotent, not per-bucket.** New content added to a bucket after the user has already interacted with it must still apply on next load. Track applied seeds by a stable, human-readable string ID (e.g. `diet-protein`, `sys-wedding-3`), not a bucket-level "already seeded" boolean — the first version of this got it wrong and silently dropped new seed items.
3. **Undo over confirmation dialogs** for routine deletes. A brief toast with an undo action beats a modal "are you sure?" for anything low-stakes. Reserve harder confirmation for genuinely destructive bulk actions (e.g. a full data reset).
4. **Never silently swallow a failed save.** Surface it, retry with backoff, and give the user a manual backup path as a last resort. This was the direct trigger for the rebuild — don't reintroduce silent failure.
5. **Escape all user-entered text before rendering into HTML.** Fixed once already after an audit; keep it fixed.
6. **Ask before big architectural additions**, propose a concrete design, and let the user redirect — this user engages well with a clear proposal plus 1-3 tightly-scoped questions, not open-ended "what do you want" prompts.

## Existing bucket content (tuned to this user — reuse, don't regenerate)
- **Spine & Pain**: ankylosing spondylitis (mild), cervicogenic headaches, rounded shoulders. Cascade: lumbar stiffness → desk-to-bed slouch → neck flexion → headache. No heavy axial loading, no barbell squats/deadlifts — spine-safe exercise selection throughout.
- **Sleep**: possible OSA under investigation (witnessed pauses, daytime sleepiness); phone-in-bed flagged as highest-leverage change.
- **Diet**: dislikes most fruit/veg plus separate anxiety around trying new foods — build from what already works, never push unfamiliar produce. Protein is a relative strength.
- **Body Composition**: reframed from a weight target to muscle-to-fat ratio; track waist + photos over scale weight.
- **Blood Pressure**: previously elevated, resolved after ~10kg weight loss.
- **Money**: UK-based. LISA under-40 first-time-buyer bonus is the highest-priority savings vehicle (25% guaranteed return, £450k property cap — a real constraint in Surrey). Pension: 5% employee + 11% employer (exceptional, ~£10k/yr growth). Emergency fund → LISA → wedding → S&S ISA is the priority order. Dental work is explicitly conditional on the quote being reasonable, not a committed goal.
- **Religion**: Islamic practice — Jumma (Friday prayer), Quran reading.

## Migrating existing data
The Claude.ai artifact has a working **Export** feature (Map view footer) producing a single JSON blob of the full app state. Bring that file into the new project and write a one-time import script/endpoint mapping it onto the new schema — don't ask the user to re-enter months of habit history, streaks, or financial figures. Treat the exported JSON's shape as the source of truth for what fields exist; it reflects everything actually built, not just what's documented here.

## Suggested stack (not yet decided — see wayfinder map)
- **Next.js (App Router) + TypeScript** — single framework for frontend + API routes, one deploy target
- **PostgreSQL + Prisma** — habit check-ins as a real table (`habit_id, date, level`), not a JSON blob, since correlation/insights need date-range queries
- **Password-gate auth** — single user, no identity provider needed
- **Railway or Fly.io** — bundled Postgres + app hosting, git-push deploys, cheap at this scale
- **PWA manifest** — this is used every morning on mobile; treat mobile as the primary surface, desktop as secondary
