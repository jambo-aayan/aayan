# Personal Life Management System

A personal life-management app covering health, habits, finance, and life admin for a single user. Originally prototyped as a single-file HTML/JS Claude.ai artifact (`window.storage` persistence, see `prototype/life-management-prototype.html`); this repo is the rebuild with a real backend and database, motivated mainly by unreliable persistence in the artifact environment (client-side storage intermittently failed with "Internal server error" / "Unexpected response type").

**Single user. No multi-tenancy needed** for now — a possible future product to sell has been mentioned, but nothing here is designed for multi-tenancy yet. Auth can be a simple password gate rather than a full identity provider.

> **Status: actively being charted via `/wayfinder`.** The structure below reflects a restructuring decided during that charting session (see the `wayfinder:map` issue for the full decision trail) — it supersedes the flatter "10 buckets" model from the original prototype chat. MVP scope is **Health + Finances** only; the other Pillars are sketched but deliberately left loose until their turn comes.

## Language

**Pillar**:
A top-level life domain — the highest level of the hierarchy. MVP Pillars: Health, Finances. Deferred Pillars (still real, just not yet built out): Religion, Productivity, Relationship, Career. As of ADR-0016, **a Pillar is user-creatable at any time** — the deferred list above isn't a gate on new Pillars, it's just what hasn't been fleshed out yet. Every Pillar (seeded or user-created) gets a dedicated page (a nav-bar entry, at `/{pillarId}`) built from the same generic **section**-based layout — see "Page section" below — except Finances, which keeps its own bespoke, non-sectioned shape (Items/Baseline/Goals/Expenses/North Star, ADR-0016 leaves it untouched).
_Avoid_: Bucket (the original prototype's term — replaced for being too informal). "Category" used to be avoided here too (the original prototype used it as a synonym for Pillar) — as of ADR-0015, **Category is now a real, distinct Finance-scoped concept** (a Transaction's spending category — see "Finance" below), unrelated to Pillar. Don't conflate the two just because they share a name.

**Area**:
A sub-topic within a Pillar, e.g. Sleep or Diet within Health. Carries over the original prototype's "buckets" one level down. Not every Pillar needs Areas — Finances' existing shape (Items, Baseline, Goals, Expenses, North Star) doesn't need them. As of ADR-0016, **an Area is user-creatable under any Pillar** (name only — everything else is filled in later) and gets its own dedicated page at `/{pillarId}/{areaId}`, same generic section-based layout as a Pillar page.
_Avoid_: Sub-bucket, Topic.

**Page section** (ADR-0016):
One block of a Pillar or Area page — North Star, Goals, Habits, Systems, Tasks, or Thoughts, each scoped to that Pillar/Area. A Pillar/Area page is a **reorderable, toggleable list** of these, not a fixed layout — the user picks which show and in what order, per Pillar/Area (a systems-heavy Pillar can feature Systems and hide Tasks, say). Deliberately generic groundwork for a much larger "modular, Notion-like" ambition (see "Future direction" below) without building that ambition yet — new section *types* (Chart, Table) are a later, separate spec, but the list itself is already built to accept them without rework. A page can also carry fixed, non-section content above its section list for content that doesn't fit the generic model (e.g. Health's Ankylosing Spondylitis Area keeps its bespoke Pain & Mobility Tracking card this way); Finances' entire page is exactly this kind of fixed content, with no section list today.

**System** (deferred — not required for Health+Finances MVP):
A process within a single Pillar that can target one Area or several Areas in that same Pillar at once — e.g. a stretch routine that improves both the Ankylosing Spondylitis and Body Composition Areas within Health. Systems don't cross Pillars. Concept kept for later — build a real System only once a concrete one earns a dedicated screen (e.g. "Payday routine"); for MVP a System can just be an informal label rather than a managed object.
_Avoid_: The original prototype's "layer above buckets" framing — that's now inverted; Systems live inside a Pillar, not above all of them.

**Task**:
A one-off unit of work — title, optional notes, an optional List/Pillar/Area/Goal/Tags, due date+time, reminder, repeat rule, and lightweight Steps (sub-items with their own completion state that never auto-complete the parent). Lives in exactly one List (defaulting to the always-present "Inbox" list if none is chosen), independent of My Day.
_Avoid_: Action (retired — see below), Goal (a Task is one-off and lower-ceremony than a Goal; don't conflate the two just because both can be one-off-feeling).

**Habit**:
A recurring unit of work — required Pillar, optional Area, a schedule (daily / selected weekdays / weekly / every N days / every N weeks / monthly / custom), a status (Active/Paused/Archived), and optional links to one or more Goals (one marked primary). See "Habits" below for check-in/streak mechanics.

**List**:
A practical grouping for Tasks (e.g. "Groceries," "Work") — distinct from a Pillar (a life domain) and a Tag (flexible metadata). Every Task belongs to exactly one List; the always-present "Inbox" List is where a Task lands if none is chosen, so capturing a Task never forces a categorization decision up front. A List has its own user-configurable accent color, independent of any Pillar's color (no bleed between the two).

**Goal**:
An outcome, not a unit of work — required Pillar, optional Area, a status (Active/Paused/Completed/Archived). Tasks and Habits can link to a Goal; a Goal itself does no work, it's what the linked Tasks/Habits are in service of.
_Avoid_: Action (retired — see below).

**Action** _(retired)_:
Used to mean "a Habit or Goal" in this glossary's earlier draft, written before Task existed as its own entity. Task, Habit, and Goal are now three separate first-class things, connected through Pillar/Area/Goal rather than nested under a shared "Action" umbrella — don't reintroduce the term.

**My Day**:
A daily working view for Tasks only (not Goals — that flag was retired when Task/Habit/Goal split apart). A Task's My Day membership is a per-date record (so any past day's My Day is reconstructable), independent of that Task's List — reordering within My Day never reorders the List, and vice versa. Active Habits also surface on the Home page for the day, computed from their schedule rather than stored, but that's a separate concept from a Task's My Day membership.

**Cross-Pillar link**:
When something genuinely spans two Pillars (e.g. "buy a house" touches both Finances and Relationship), it lives in exactly one Pillar as its source of truth, with a visible link from the other — never duplicated as two independent copies. Extends the cross-links the original prototype's mind-map view already drew between buckets.

**North Star**:
Every Pillar has one, and every Area has one — a single headline goal that Actions within it work toward, always visible when you open that Pillar or Area. Originally a Finances-only concept (see "Finance" below); generalized to the whole hierarchy. **Optional, not mandatory upfront** — the structure supports setting one on any Pillar/Area, but nothing requires it to be filled in before launch. The user will set them from inside the app as they decide what each one should be, not as part of this spec.
_Avoid_: Don't confuse with an ordinary Goal — a North Star is the *one* headline target for its Pillar/Area, not one of potentially several Goals.

**Current state**:
A short free-text status field on an Area — where things stand right now (e.g. "Mild, well-managed"), editable anytime, shown prominently alongside the Area's North Star. Distinct from the North Star (the target) and from Actions (the day-to-day work). Free text rather than a fixed severity scale — a scale that fits a health condition wouldn't fit every Area, and a free field needs no upfront taxonomy design.

**Category** (Finance-scoped, ADR-0015):
A Transaction's spending category (e.g. Food, Housing, Transport) — a real, user-editable list (add/rename/merge), not free text. Unrelated to Pillar despite the shared word — see the note under "Pillar" above.
_Avoid_: Using "Category" to mean Pillar (the original prototype's usage, now retired).

**Statement** (Finance-scoped, ADR-0015):
One uploaded bank/card statement — the record of an upload event itself (institution, account, period, source file), distinct from the `Snapshot` (balance) and `Transaction`s (line items) it produces. A Snapshot or Transaction not created via upload has no Statement.

## Pillars

### Health (MVP)
Areas: Ankylosing Spondylitis, Sleep, Diet, Body Composition, Blood Pressure, Looks, Healthcare Navigation. See "Existing content, tuned to this user" below — these Areas carry their prior detail forward unchanged, just renested under Health. Health can have a Pillar-level North Star, and each Area can have its own North Star plus a free-text Current state (see "Language") — left empty at launch, filled in by the user later from inside the app, not decided as part of this spec.

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
- **Active/inactive toggle.** Inactive habits are excluded from *everything* that measures the user — streaks, badges, weekly review, the pain/mobility correlation view — but stay visible (dimmed), not deleted.
  - **New/seeded habits default to inactive.** The user opts in rather than opts out. This is intentional: starting too many habits at once is a known failure pattern for this user, and the seed data intentionally includes more habits than should ever run simultaneously.

## Goals
Superseded by the Task/Habit/Goal split above — a Goal is now an outcome (`Active`/`Paused`/`Completed`/`Archived`), not a one-off unit of work with a `dueDate` or a `myday` flag. Day-to-day one-off work now lives on Task instead; Task carries `myDay` (see "My Day" above), Goal does not. The old "All Actions" cross-cutting list is superseded by "All Tasks" (which itself is being redesigned into a Lists-first Tasks page per the Claude Design handoff — see `docs/adr/` once that decision lands).

## Systems
A named **Process** (an ongoing routine) or **Experiment** (a time-boxed test with a review date
and a Continue/Escalate/Stop verdict) — distinct from a Habit (a single recurring behaviour) and
a Goal (an outcome): a System is the structured *procedure* around one or more Habits/Goals. A
**template** defines the steps; a **run** is one execution of a template, copying its steps at
creation time. Scoped to one Pillar (optionally narrower, one Area).

**Deletion**: a System can be archived (hidden, kept) or fully deleted (undo-able within the
session, full step/decision/occurrence/evaluation history restored on undo — deleting a template
un-links its runs rather than deleting them too, same for a nested parent and its children).

**Evaluation**: a dated, user-logged check-in on how a System is actually going — independent of
a Process's eventual "mark concluded" or an Experiment's eventual verdict, since neither answers
"how's it going right now." Three 1-5 ratings per entry (Effectiveness, Consistency,
Sustainability) plus an optional note; the overall score is their plain average, always shown
alongside the three, never instead of them. No forced cadence — logged whenever the user chooses.

## Insights & Nudges
Pillar-independent surfaces from the Claude Design handoff (v2). See [ADR-0011](./docs/adr/0011-v2-phase6-insights.md) for the Phase 6 rewiring/additions pass and [ADR-0012](./docs/adr/0012-v2-phase7-finance-analytics.md) for the Phase 7 Systems×surplus correlation.

**Insight**:
A derived, computed reading of the user's own data — never stored, always recalculated. Covers **Momentum** (a single `0–100` composite score: `0.5×adherence + 0.3×followThrough + 0.2×surplusRate` over a rolling 28 days), per-metric KPI cards (habit adherence, task follow-through, goal velocity, surplus rate, Systems on track), the habit consistency grid, Attention Balance (actual time-share per Pillar vs. a user-stated intended share, set per-Pillar alongside its Accent color), Neglect radar, Task flow, correlations (Pearson's r between paired continuous daily series, gated below `n=5` — see `CORRELATION_MIN_N`; a boolean-predicate-vs-continuous pair like trained-vs-mood uses a mean-split instead, see `splitMean`, gated below 3 logged days per side; pairs include adherence×follow-through, adherence×pain, adherence×surplus, sleep×stiffness, and — as of Phase 7 — Systems-on-track %×surplus), and Trajectory (projected date to a Pillar's North Star at current pace — only Finance has a real numeric North Star target/deadline today).

**Nudge**:
A reminder the app surfaces proactively (habit due, task overdue, streak at risk, weekly review ready, metric off target) — distinct from a notification a user has to go looking for. See [ADR-0002](./docs/adr/0002-nudges-delivery-rules.md) for delivery behavior (quiet hours, dedup, coalescing, snooze, read-state).

**Weekly review**:
A guided, five-step Sunday ritual (close out stale Tasks, log/triage Habits, re-rank next week's priorities, review the week's numbers, write a digest) — not just a report. The digest can be saved as a Thought.

## Thoughts
Free-text, dated journal entries. **Cross-cutting, not Pillar-bound** — a quick-add reachable from the homepage (same pattern as the old "My Day" quick-add), for a general daily journal that can be about anything. Tagging a Thought to a specific Pillar or Area is *optional*, not mandatory — use it when a Thought is actually about Health, or Finances specifically; leave it untagged for a general entry. Optionally prompted (dismissible, never forced) after a habit check-in or goal status change. In MVP scope.

## Finance
Separate net-worth tracker, living inside the Finances Pillar:
- **Items**: assets/liabilities. `liquid: true` marks instant-access cash (drives the emergency-fund "runway" calc). `excluded: true` marks the pension — tracked and shown, but deliberately excluded from the headline net-worth figure because the user doesn't count money he can't access for ~30 years. Both **accessible net worth** and **total net worth** should exist as distinct, separately-labelled numbers.
- **Baseline**: monthly income + fixed outgoings → surplus. A fixed, recurring monthly summary — distinct from Transactions below, which are the actual dated ledger.
- **Goals**: target / saved / monthly contribution → progress bar + projected completion date. Should warn if committed monthly amounts across goals exceed actual surplus.
- **Transactions** (MVP): dated, categorized entries — income or expense — replacing the earlier plain "Expenses" concept with real granularity. Each has an amount, a direction (in/out), a Category (see "Language" — a real user-editable entity as of ADR-0015, not free text), and an optional source/medium label. Feeds both a chronological "Recent Transactions" list and a this-month category breakdown. This is the actual ledger; Baseline stays as the separate fixed-recurring summary. Browsed via a paginated, filterable (category/account/date range/search) list, groupable by Statement, rather than one unbounded scroll (ADR-0015). Duplicate rows from a re-uploaded, overlapping statement are detected and skipped automatically on `(account, date, amount, direction)`, never inserted twice (ADR-0015).
- **Statement** (see "Language"): one row per upload, holding the generated name, institution, period, and source file — Transactions and Snapshots link back to the Statement that produced them. Statements, and everything they produced, can be bulk-deleted together (transactions + their linked balance Snapshot, one action) via a per-statement select-all shortcut in the Transactions list (ADR-0015).
- **North Star**: one headline target + deadline, tracked against *accessible* net worth specifically, with a live on-track/behind verdict based on required vs actual monthly rate. Also supports a simple projection (e.g. "on current trajectory, £X in 5 years") as a lightweight forecast, not a separate feature.
- **Account linking** (MVP): bank accounts, credit cards, and (for this user specifically) the investment account all connect via API for automatic balance/transaction/position sync, rather than manual entry only.
  - **Bank + credit card**: via an Open Banking aggregator. **Confirmed: Enable Banking's "Restricted Production" tier** — free for personal use, whitelisting your own accounts, no pricing conversation needed; exactly the "developer linking their own accounts" scenario. (Earlier "not independently verified" caveat is resolved.) Lloyds is a documented UK ASPSP, so bank coverage there is solid; Yonder's specific coverage is still unconfirmed (see "user's actual accounts" below — manual entry is the accepted fallback). GoCardless (the historically free option) is closed to new signups since July 2025 — ruled out. **Plaid and TrueLayer checked and ruled out**: both require a sales conversation for UK/EU production access, no self-serve pay-as-you-go — doesn't fit the free-to-run constraint regardless of bank coverage.
  - **Investments — reversed from "manual entry, settled."** That call assumed investment accounts need an Open Banking aggregator (which indeed doesn't cover them) — but **Trading 212 has its own free, first-party Public API** (account cash balance + portfolio positions/P&L, API key from account settings, no subscription required), confirmed via its official docs. Since the user's investment account is specifically a Trading 212 Stocks & Shares ISA, this sidesteps the Open Banking gap entirely — use Trading 212's own API rather than an aggregator. Currently in beta; a minor risk to note, not a blocker. **This is specific to Trading 212** — the general principle (Open Banking doesn't cover investment platforms) still holds for any investment platform without its own API.
  - **Sync frequency is low** — the user checks weekly/monthly at most, not multiple times a day. This matters for Yonder specifically (see below): the value of API sync over manual entry is much smaller at this frequency, so it's not worth chasing a paid aggregator contract just for one card.
  - **The user's actual accounts**: bank is **Lloyds** (CMA9-mandated — near-guaranteed aggregator coverage via Enable Banking). Credit card is **Yonder** (newer, smaller issuer — try Enable Banking too, no extra cost since it's already integrated for Lloyds; if uncovered, **fall back to manual entry** rather than pursuing a paid aggregator. Checked: TrueLayer and Plaid are both sales-gated commercial contracts, not pay-per-call — a willingness to pay a little doesn't actually unlock either of them for a single low-volume user, so "paid" isn't a real third option here, just Enable-Banking-if-covered vs. manual). Investment is **Trading 212** S&S ISA (own API, see above).
  - **Usage pattern**: Yonder is where actual day-to-day spending happens — Lloyds is comparatively quiet (salary in, Yonder bill payment out). **Yonder is the account that matters for spending analysis/category breakdown**; Lloyds' Transactions will mostly be two recurring types (salary, credit card payment), not a rich spending signal. If Yonder ends up on manual entry, the category-breakdown feature depends on the user actually keeping that manual entry current — worth surfacing this dependency rather than assuming Lloyds data alone is enough.
  - Linked/synced accounts still populate as **Items**, **Transactions**, and position data — this is a data-source decision, not a new domain concept.
- **Budget**: a standing monthly spending limit for one Transaction category (`limit`, one row per category, no rollover — read fresh against each month's actual spend). "Budget vs. actual" compares it against that month's `categoryBreakdown` total, plus a pace-based projection of where the category will land by month-end.
- **Statements analytics**: a set of read-only comparisons computed over Transactions — month-over-month diff, year-over-year diff (whole-spend only, honestly null until a second year of data exists), per-category 6-month trend, top merchants, and detected recurring charges (a source+amount pair repeating in 2+ distinct calendar months — the closest thing to "subscription detection" this app does). Originally built only for the `/finances/statements` import-review page; the trend and recurring-charge views also surface on Finance home as of Phase 7 (ADR-0012).
- **Spend deviation**: "you spent X% more on Food than usual this month" — a category's (or the whole month's) current spend compared against its own trailing 3-month average, distinct from Statements' month-over-month/YoY diffs (which compare against one specific reference point, not a rolling "usual"). Requires nonzero spend in each of the 3 preceding months to be eligible; below that, no deviation is shown for that category. Only becomes a visual callout past a ±20% swing (ADR-0012).
- **Transfer**: a third reclassification type alongside Receivable and Goal contribution (ADR-0013) — links two Transactions (one `OUT`, one `IN`, on two different Accounts) as the same money moving between the user's own accounts, e.g. Lloyd's paying Yonder's credit card bill. Excluded from spend/income totals everywhere the other two reclassifications already are. Unlike a Receivable, has no OPEN/SETTLED lifecycle and no `amount` of its own — both sides already exist by the time they're linked. Linking is suggest-and-confirm (candidate matches ranked by date/amount proximity), never automatic; unlinking is supported. As of ADR-0015, likely transfers are proactively surfaced as a "possible transfers to review" list rather than relying on the user to notice and manually open "Link as transfer" — still suggest-and-confirm, never auto-linked.
- **Full reset** (ADR-0015): a confirmation-gated Settings action that wipes all Transactions and everything that hangs off them (Snapshots, Transfers, Receivables, GoalContributions, Statements), while keeping Accounts/Goals/Habits themselves intact for re-upload. Exists so the data-integrity fixes above can be applied to a clean slate instead of data already corrupted by the bugs they fix.

## Pain & Mobility Tracking (MVP — Ankylosing Spondylitis Area only)
Replaces the original prototype's generic headache/sleep Symptoms log for MVP, narrowed to what the user actually asked for: a **Pain** score and a **Mobility Score** (each 0–10), logged regularly against the Ankylosing Spondylitis Area, charted over time with a weekly average and a trend vs. the prior week. Feeds a correlation view (habit-done days vs. pain days) — the explicit goal is seeing what works and what doesn't. **Deliberately conservative**, carried over from the original Symptoms design: requires a minimum sample (~6 logged days, ~3 days on each side of a habit) before showing any comparison, and is always framed as "something to raise with a clinician," never as a diagnosis or conclusion. Don't remove these guardrails to make the feature feel more "finished." Scoped to this one Area for MVP — not a Health-Pillar-wide feature; extend to other Areas only if a real need shows up.
_Avoid_: "Symptoms" (the original prototype's broader, headache/sleep-specific term — this MVP feature is narrower and Area-specific).

## Appointments (deferred — not in Health+Finances MVP)
Name + date, scoped to the Health Pillar. Generates a "prep sheet" beforehand (symptom summary, habit adherence, background context, blank space for the user's own questions) and prompts for outcome notes afterward. The follow-up half matters as much as the prep half — the thing that gets lost with multiple clinicians over months is what the last one actually said. Fully designed already, from the original prototype — just not part of this MVP; revisit post-launch.

## Explicit non-goals
Stated directly, to stop scope creep before it starts:
- **No generic task board / Kanban feature.** Habits and Goals are the only work-tracking primitives — don't add a general-purpose board/board-column concept.
- **No events/calendar system.** Appointments (deferred) has dates, but that's not a calendar feature — don't build one.
- **No heavy financial reporting.** Net worth, Goals, and the Transactions list/category breakdown (see "Finance") are the ceiling for MVP — no generated reports, statements, or budget-vs-actual analysis beyond that.

## Future direction — logged for later (not scheduled)
Surfaced during the Pillars/Areas grilling session (2026-09-01), explicitly deferred by the user to its own future grilling/spec session rather than folded into Pillars/Areas now:

**A modular, "Notion at a much lower level" platform.** The long-term ambition is for the app to be self-sufficient for adding new features/plots/visuals to a Pillar or Area without bespoke development each time — enough generic building blocks (and eventually a way to compose them) that a new Area's specific needs can usually be met by configuring existing primitives rather than writing new code for it. Explicitly tied to a possible future intent to sell the product, which is why it wants more general-purpose capability than a single-user tool strictly needs today. Not scoped, not designed — revisit with a dedicated grilling session when it's actually time to pursue it. Contrast with the immediately-adjacent, concretely-scoped visuals/data system described under "Finance" and pillar/area pages, which the user *did* ask to build now, just kept simple.

## Setup / first-run
What needs real user input before the app is useful, vs. what ships pre-filled:
- **Finance needs a real setup flow.** There's no way to seed the user's actual salary, savings, or goals — a first-run (or Settings-accessible, for redoing later) flow should capture: monthly income + fixed outgoings (Baseline), starting Items (assets/liabilities — either entered manually or populated by linking an account, see "Finance" above), existing Goals (e.g. Emergency fund, LISA — target and amount already saved), and the Finances North Star (target + deadline) if the user wants to set it now. Account linking (bank/credit card/investment) is part of this setup flow, not a separate feature — connecting an account is one way of populating Items and Transactions, manual entry is the other, and both must stay available since not every account will be linkable.
- **Health needs no dedicated wizard.** The tuned seed content (see "Existing content, tuned to this user") already covers it — Areas, and example Habits (seeded inactive, per the opt-in principle). The user activates and edits from inside the app as needed; no upfront wizard.
- **Everything seeded or entered must be editable in-app afterward** — via Settings, or inline "click to edit" on the item itself (whichever fits the item). This isn't a one-time input; the user expects to revise Habits, Goals, Areas' Current state, and Finance figures over time without needing a redeploy.

## Behavioural principles (learned by hitting them — keep these)
1. **Low-maintenance is a hard constraint**, stated explicitly and repeatedly by the user. Features that add friction to routine daily input have been rejected before (e.g. a frequency picker on every habit add, tags on every task). Any new recurring-input feature should have a sensible default and *not* ask a question every time it's used.
2. **Seeding must be per-item and idempotent, not per-Pillar.** New content added after the user has already interacted with an Area/Pillar must still apply on next load. Track applied seeds by a stable, human-readable string ID (e.g. `diet-protein`), not a coarser "already seeded" boolean — the first version of this got it wrong and silently dropped new seed items.
3. **Undo over confirmation dialogs** for routine deletes. A brief toast with an undo action beats a modal "are you sure?" for anything low-stakes. Reserve harder confirmation for genuinely destructive bulk actions (e.g. a full data reset).
4. **Never silently swallow a failed save.** Surface it, retry with backoff, and give the user a manual backup path as a last resort. This was the direct trigger for the rebuild — don't reintroduce silent failure.
5. **Escape all user-entered text before rendering into HTML.** Fixed once already after an audit; keep it fixed.
6. **Ask before big architectural additions**, propose a concrete design, and let the user redirect — this user engages well with a clear proposal plus 1-3 tightly-scoped questions, not open-ended "what do you want" prompts.
7. **Mobile is a first-class target, not an afterthought** (ADR-0014). The app's shell (sidebar vs. mobile nav-drawer/header) is responsive at a `900px` breakpoint — reuse that breakpoint, don't invent a second one. A row of actions that's fine on desktop needs an explicit mobile treatment (e.g. an overflow menu) before it ships, not after a screenshot catches it overflowing. A layout that positions elements by hand-placed coordinates (percentages, pixel offsets) tuned for today's exact content is a known trap once that content's size or count can change — prefer a computed layout from the start.

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
