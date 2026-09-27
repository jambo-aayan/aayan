# Aayan: Project Overview

This is a single-document tour of the Aayan codebase: what the app is, what it does, how it's built, and where to find things. For exact domain vocabulary, see [`CONTEXT.md`](../CONTEXT.md). For why things are the way they are, see the ADRs in [`docs/adr/`](./adr/). This document summarizes both and points to them; it doesn't replace them.

---

## 1. What it is

Aayan is a **personal life-management app** (a "personal OS") for **one user**. It brings together:

- **Health**: habits, logged metrics, pain and mobility tracking, and Areas such as Sleep, Diet and Spondylitis.
- **Finances**: net worth, accounts, statement uploads, transactions, budgets, savings goals and a North Star target.
- **Work tracking**: Tasks, Habits, Goals and Systems (routines and experiments).
- **Reflection**: Thoughts (a journal), a guided Weekly Review, computed Insights and proactive Nudges.

The app started as a single-file HTML/JS prototype built as a Claude.ai artifact (it's still kept at `prototype/life-management-prototype.html`). It was rebuilt as a real Next.js and Postgres app because the prototype's client-side storage kept failing. That history shows up in the design: the app never silently swallows a failed save, and there's a one-time importer for the prototype's JSON export.

**Design constraints that shape everything:**

| Constraint | Consequence |
|---|---|
| Single user, no multi-tenancy | Auth is one shared password (bcrypt hash in an env var). There is no `User` table. |
| Free to run | Vercel free tier, Neon Postgres free tier, and Vercel Blob. Gemini is used only for statement parsing. |
| Laptop *and* phone | Installable PWA with a responsive shell that switches at a **900px** breakpoint (ADR-0014). |
| Low maintenance for the user | Sensible defaults everywhere. Recurring inputs don't ask questions each time, and new habits are opt-in (seeded as paused). |
| Honest analytics | Correlations and comparisons have minimum sample sizes and show empty states instead of fabricated numbers. |

---

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 16.3** (App Router, React 19.2, Server Components and Server Actions), TypeScript |
| Routing gate | `proxy.ts` (Next 16's replacement for `middleware.ts`) does a cheap check that the session cookie exists. The authoritative session check runs in the protected layout. |
| Database | **PostgreSQL** on **Neon**, accessed via **Prisma 7** with the `@prisma/adapter-pg` driver adapter. The client is generated into `lib/generated/prisma`. |
| File storage | **Vercel Blob**, for System Checkpoint step photos. |
| AI | **Gemini 2.5 Flash** (`@google/genai`), used to parse uploaded bank statements (PDF/CSV) into structured transactions and categorize them against a fixed category list. |
| Charts | **Recharts** |
| Icons | **lucide-react** |
| Dates | **chrono-node**, for natural-language due dates in Task quick-add |
| Styling | CSS Modules per component plus `app/globals.css` design tokens. No UI framework. |
| Tests | **Vitest**: about 58 test files co-located with the pure logic in `lib/` |
| Hosting | **Vercel**, with **Vercel Cron** driving Nudges |

Scripts (`package.json`): `dev`, `build`, `start`, `lint`, `typecheck`, `test`. `postinstall` runs `prisma generate`. `vercel-build` runs `prisma migrate deploy` before `next build`.

> Note from `CLAUDE.md`: this Next.js version has breaking changes compared with older versions. Read `node_modules/next/dist/docs/` before writing framework-level code.

---

## 3. Core domain model

The app is organized as a **hierarchy of life domains**, with work items and data attached at each level.

```
Pillar (Health, Finances, Miscellaneous, user-created ...)
 ├─ North Star            (one headline target, optional)
 ├─ Area (Sleep, Diet, Spondylitis ...)   ← optional layer
 │    ├─ North Star + Current state (free text)
 │    └─ page sections ...
 ├─ Goals    (outcomes: Active / Paused / Completed / Archived)
 ├─ Habits   (recurring behaviours with a schedule + check-ins)
 ├─ Tasks    (one-off work, in Lists, with Steps / repeat / My Day)
 ├─ Systems  (Processes & Experiments made of typed Steps)
 ├─ Thoughts (journal entries, optionally tagged)
 ├─ Metrics  (user-defined things to log over time)
 └─ Visuals  (charts & tables placed on the page)
```

### Key concepts (from `CONTEXT.md`)

- **Pillar**: a top-level life domain. Pillars are user-creatable (a name plus an accent color), and each one gets its own nav entry and page at `/{pillarId}`. Health and Finances are the MVP Pillars and Miscellaneous is also seeded. Religion, Productivity, Relationship and Career are sketched but deferred.
- **Area**: a sub-topic within a Pillar. Areas are user-creatable (name only) and each has a page at `/{pillarId}/{areaId}`. They're named after the user's specific issue, not a generic category. The seeded Health Areas are Spondylitis, Sleep, Diet, Training & body, Grooming and Care.
- **Page section** (ADR-0016): each Pillar or Area page is a reorderable, toggleable list of sections: North Star, Goals, Habits, Systems, Tasks, Thoughts, **Charts** and **Table**. Charts and Table are *zones* that can hold many Visuals. Finances is the exception: it keeps its own custom page.
- **Task**: one-off work. A Task always belongs to exactly one **List** (the default is *Inbox*). It can also have an optional Pillar, Area, Goal, tags, due date and time, reminder, repeat rule, and lightweight **Steps**. Membership in **My Day** is stored as a per-date record.
- **Habit**: a recurring behaviour with a required Pillar and optional Area. Schedules can be daily, weekdays, selected weekdays, weekly, every N days, every N weeks, monthly, N times per week, or custom. A Habit's status is Active, Paused or Archived, and it can link to Goals.
- **Goal**: an outcome, not a unit of work. Tasks and Habits serve Goals.
- **System**: a structured procedure. There are two kinds:
  - A **Process** is an ongoing routine.
  - An **Experiment** is time-boxed, with a review date and a Continue, Escalate or Stop verdict.

  A System is built from typed Steps (Checklist, Checkpoint with photo, Milestone, Measure, Repeating). Systems support templates and runs, nesting one level deep, a decisions log and periodic **Evaluations** (1–5 ratings for Effectiveness, Consistency and Sustainability).
- **Metric** and **MetricEntry**: user-defined values to log over time. The value type can be Number, 1–5 scale, Boolean, Enum or Text. The cadence can be Daily, Weekly or Ad hoc, and a Metric can be marked required. Metrics replaced the old fixed daily-log sheet (#181–#188). The default Metrics are Mood, Stress, Energy, Sleep quality, Pain, Headache, Stiffness, Weight, Waist and Blood Pressure.
- **Visual** (ADR-0017): a chart (Line, Bar, Progress bar, Scatter or Streak heatmap) or a table on a page. Data is either **ad hoc** (entered directly, one at a time or pasted or uploaded as CSV) or **bound** to live domain data through adapters: habit check-ins, System evaluation scores, goal progress, account balances or transactions, category spend. Bound Visuals never copy their source data.
- **Thought**: a dated journal entry. It isn't tied to a Pillar, but can optionally be tagged with a Pillar or Area.
- **Nudge**: a proactive reminder, such as habit due, task overdue, streak at risk, weekly review ready, System review due, category spend anomaly or metric log due.
- **Insight**: a derived, never-stored reading of the user's data (momentum, KPIs, correlations and so on).

**Retired terms, per `CONTEXT.md`**: *Bucket* (now Pillar), *Action* (split into Task, Habit and Goal), and *Category* used to mean Pillar. **Category** now means only a Finance spending category.

---

## 4. Feature tour (by screen)

All authenticated screens live under `app/(protected)/(shell)/` and share the app shell: a sidebar on desktop, and a header plus nav drawer on mobile.

### Navigation

The **Home**, **Log** and **Insights** nav entries are fixed. Next come the data-driven **Pillar** entries (Health, Finances, user-created). **Nudges** and **Settings** come last. A **command palette** (`components/command-palette.tsx`, `lib/palette/`) gives keyboard search across pages and entities.

### Welcome and login
- `/login` is the password form. Failed attempts trigger a lockout with exponential backoff after 5 free attempts, from 30s up to 1h (ADR-0004). Sessions last **30 days** and are stored in the `Session` table.
- `/` shows a quiet "Take a moment first" welcome with a link to Home.

### Home (`/today`)
- Today header with stat cards for habits left to check in and active goals.
- **My Day tasks**, with carry-over of yesterday's unfinished tasks and today's completed list.
- Today's habit check-ins. A check-in cycles through none, full, minimum and back to none.
- **Log today** quick-add for ad hoc date-based charts.
- **Thought quick-add**.
- **Day-one onboarding** replaces Home when the app is empty: name your pillars, write a North Star, add one habit, capture something. It also offers a "load sample data" button. Settings has an *Empty-app mode* that forces this view for demos.

### Log (`/log`, `/log/metrics`, `/log/metrics/[metricId]`)
- The single place for logging. It lists every non-archived Metric due today or this week, grouped by Pillar with a *General* group first, plus an always-visible *Ad hoc* section.
- Each row has a status dot: logged, required but not yet logged, or optional.
- **Metric management**: create, edit, reorder, scope to a Pillar or Area, archive. Metrics are soft-deleted only, so their history is never lost.
- **Per-metric history** view with a trend chart and gap markers for missed periods.
- `/log-today` (the old fixed sheet) now redirects here.

### Tasks (`/tasks`, `/all-tasks`, `/by-date`, `/my-day`)
- A Lists-first task manager: a sidebar of Lists (each with its own color), quick-add with **natural-language dates** (chrono-node), a detail composer, Steps, tags, reminders and filters.
- The **repeat engine** (`lib/tasks/recurrence.ts`) creates the next occurrence when a repeating task is completed. It supports daily, weekdays, selected weekdays, weekly, every N days/weeks/months, monthly and custom (ADR-0003, ADR-0006).
- A by-date grouped view and an all-tasks view. `/all-actions` redirects here for legacy links.

### Habits (`/habits`)
- Habit manager with composer, filters and status control.
- Streaks (`lib/habits/streak.ts`). A daily habit counts as "established" at 7 consecutive days. A weekly habit is measured over **Monday–Sunday weeks** and is established at 4 weeks. The week-boundary math has been carefully verified, because a naive `floor(epochDays/7)` was a real bug early on.
- A **minimum** check-in counts toward the streak but is rendered differently from a full one.

### Goals (`/goals`, `/goals/[goalId]`)
- Goal manager with filters and a status control. The detail page shows the linked Habits and Tasks.

### Systems (`/systems`)
- The Systems tab lists Processes and Experiments, with a *Show archived* toggle.
- System cards show steps, widgets, runs from templates, nested children, the decisions log and evaluations.
- Deleting a System can be undone within the session. Deleting a template unlinks its runs instead of deleting them (ADR-0008, ADR-0011).

### Thoughts (`/thoughts`)
- A journal list and composer with optional Pillar or Area tags. A dismissible thought prompt can appear after a habit check-in or goal change.

### Pillars (`/pillars`, `/[pillarId]`, `/[pillarId]/[areaId]`)
- `/pillars` shows every Pillar as a card or as a **mind map** with a computed layout (ADR-0014), and has a "new Pillar" tile.
- A Pillar or Area page has an editable North Star and Current state, then the **section list**. The Section manager lets the user show, hide and reorder sections per page.
- Each Pillar or Area can have any number of Charts and Tables. Tables can be freeform, or bound to Goals, Habits, Tasks or Systems with extra custom columns.
- The Spondylitis Area keeps its custom **Pain & Mobility tracker** as fixed content above the sections. It scores pain and mobility on 0–10 scales and shows a weekly average, a week-over-week trend and a conservative habit correlation.

### Finances (`/finances` and sub-pages)
The largest single area (ADR-0010, 0012, 0013, 0015).

- **Dashboard**:
  - stat row
  - cash-flow trend chart
  - North Star ring, which tracks **accessible** net worth against a target and deadline, with an on-track or behind verdict and a projection
  - goal rings
  - net-worth breakdown ring
  - activity table
- **Accounts**: assets and liabilities. An account is either *Transactional* (it has a transaction ledger) or *Valuation* (balance only, such as a pension). Balances are stored as dated **Snapshots**. Flags mark whether an account counts as *accessible* cash and whether it's *excluded* from the accessible net-worth figure (the pension is).
- **Baseline**: monthly income and fixed outgoings, which give the surplus.
- **Goals**: savings goals. Each has a vehicle (Emergency fund, LISA, Pension, S&S ISA, Cash ISA, Generic), an explicit priority and a monthly plan. The amount saved is the sum of logged **GoalContributions**. The app warns when the monthly commitments across goals exceed the surplus.
- **Budget vs. actual**: a monthly limit per category, compared with that month's actual spend and a pace-based projection to month end.
- **Transactions** (`/finances/transactions`):
  - paginated, filterable by category or subcategory, account, date range and search
  - can be grouped by Statement
  - bulk actions
  - **Reclassification**: each transaction can be flagged as exactly one of **Receivable** (money owed to you), **Goal contribution** or **Transfer** between your own accounts. Reclassified transactions are excluded from spend and income totals.
  - **Transfer suggestions**: likely matching pairs are surfaced for the user to confirm. Nothing is ever linked automatically.
- **Statements** (`/finances/statements`):
  - Upload one or more PDF/CSV statements. Gemini parses them into transactions and a balance Snapshot.
  - Duplicate rows from overlapping uploads are skipped using `(account, date, amount, direction)`.
  - Each upload gets a generated name.
  - The page also shows analytics: month-over-month and year-over-year comparisons, a 6-month trend per category, top merchants and **recurring-charge detection**.
- **Uncategorised queue** (`/finances/uncategorised`): transactions to review. This includes low-confidence parses that are held for review.
- **Categories**: a *fixed* two-level hierarchy, such as Food > Groceries (`lib/finance/categories.ts`). The categorizer always picks a leaf category. Settings shows the hierarchy read-only. The hierarchy is fixed because the earlier free-text version splintered into about 40 near-duplicate categories.
- **Spend deviation**: compares this month's spend in a category with its trailing 3-month average, and highlights swings beyond ±20%.
- **Full reset**: a Settings action behind a confirmation. It wipes all transactions and the data derived from them, but keeps accounts, goals and habits.
- **Bank linking** (`/finances/link-bank`): a working **Enable Banking** OAuth integration (UK Open Banking). It is **deliberately inactive**, because statement upload is the chosen data source for now (ADR-0010).

### Insights (`/insights`)
All values are computed from live data and nothing is stored (`lib/insights/`). A range control selects the time window.
- **Momentum**: a 0–100 score calculated as `0.5×adherence + 0.3×followThrough + 0.2×surplusRate` over a rolling 28 days.
- **KPI cards**: habit adherence, task follow-through, goal velocity, surplus rate and Systems on track.
- **Consistency grid**, **Neglect radar** and **Attention balance**, which compares actual time share per Pillar with the intended share.
- **Task flow**, **Trajectory** (projected date to reach the North Star) and **Weekly digest**.
- **Correlations**: Pearson's r between any two Metrics or daily series, shown only once n ≥ 5. Results are limited to the 8 largest by magnitude and include a clinician-style caveat. Pairs of a yes/no event against a continuous value use a mean split instead.
- **Category spend** trend and anomaly card, with drill-down sheets.

### Nudges (`/nudges`)
- An inbox of reminders with Unread, All and Snoozed filters, snooze, and "Mark all read".
- The **Delivery rules** card has toggles for the morning brief, evening check-in and streak warnings.
- Rules (ADR-0002):
  - **Quiet hours** run from 22:00 to 07:30. Nudges that come up then are held and delivered together afterwards.
  - Nudges are **deduplicated** to one per habit per day, and the most severe one wins.
  - The morning brief is **one combined nudge**.
  - Snoozing **re-checks the trigger** when the snooze ends.
  - Opening the page does **not** mark nudges as read.
- `/api/cron/nudges` runs them, triggered by **Vercel Cron** (`vercel.json`) at 07:30 daily (morning), 20:30 daily (evening) and 18:00 on Sundays (weekly review). The route is protected by `CRON_SECRET`.

### Weekly review (`/weekly-review`)
A guided **five-step** Sunday routine: **Close out** stale tasks → triage **Habits** → **Re-rank** next week's priorities → review the **Numbers** → **Write it**. The digest can be saved as a Thought.

### Settings (`/settings`)
- Toggles for reduce motion, empty-app mode and the weekly review prompt.
- Pillar colors and intended time share, the read-only category reference, and the finance full reset.

---

## 5. Architecture and code layout

```
app/
  layout.tsx, globals.css, register-service-worker.tsx
  login/                     password form
  (protected)/               authenticated route group
    layout.tsx               authoritative session check (Node runtime, Prisma)
    page.tsx                 welcome screen
    (shell)/                 everything inside the sidebar/mobile shell
      layout.tsx             fetches data-driven nav (Pillars), palette data
      [pillarId]/[areaId]/   generic Pillar/Area pages
      today/ log/ tasks/ habits/ goals/ systems/ thoughts/
      finances/ insights/ nudges/ weekly-review/ settings/ pillars/ ...
  api/
    login/, logout/          session cookie issue/destroy
    health/                  DB connectivity probe → {"ok":true}
    import/                  one-time prototype JSON import (idempotent)
    cron/nudges/             Vercel Cron entry point
    finance/enable-banking/callback/   OAuth callback (inactive)

components/                  UI; one folder per feature where large
  (tasks/, habits/, goals/, log/, metrics/, visuals/, insights/,
   finance-dashboard/, statements/, weekly-review/, nudges/, thoughts/,
   pillar-page/, day-one/, toast/ ...) + shared primitives
   (card, row-actions, editable-text, color-swatch-picker, toggle-switch ...)

lib/                         domain logic, one folder per domain
  <domain>/data.ts           server-side reads (Prisma queries)
  <domain>/actions.ts        Server Actions (writes)
  <domain>/*.ts              pure logic, unit-tested in *.test.ts
  prisma.ts                  Prisma client singleton (pg adapter)
  auth/                      password, session, lockout, rate-limit
  generated/prisma/          generated client (not hand-edited)

prisma/
  schema.prisma              ~1,300 lines, heavily doc-commented
  migrations/                49 migrations (Aug–Sep 2026)

proxy.ts                     edge cookie gate (redirects to /login)
public/                      manifest.json, sw.js (install-only SW), icons, brand
prototype/                   the original single-file HTML prototype
docs/adr/                    17 Architecture Decision Records
docs/research/               Enable Banking & UK Open Banking research
docs/agents/                 conventions for AI agent skills (issues, labels, domain docs)
```

### Conventions worth knowing
- **Code is split into data, actions and pure logic.** Pure functions such as streaks, schedules, recurrence, net worth, spend deviation, correlations, dedup and the natural-language date parser live in separate files with Vitest tests. `data.ts` and `actions.ts` are thin layers over Prisma.
- **Seeding is per item and idempotent.** Seeded rows use stable, human-readable slug IDs (for example `health`, `metric-pain`, `diet-protein`) and are upserted, so new seed content still gets added to an existing database. Code that depends on seeded rows references those IDs, never their names.
- **Values are stored as dated child rows.** Account balances are Snapshots, goal savings are GoalContributions and Metric values are MetricEntries, so there's always a history instead of one overwritten number.
- **Bound data is read live.** Visual adapters, Habit occurrences (computed from the schedule, not stored) and Insights are all computed each time they're rendered.
- **Undo instead of confirmation dialogs** for routine deletes (a toast with Undo). Hard confirmation is reserved for destructive bulk actions.
- **Failed saves are never silent.** `lib/with-retry.ts` retries with backoff, and errors are shown to the user.
- **Mobile first.** Rows of actions collapse into a "⋯" overflow menu below 900px (`components/row-actions.tsx`).

---

## 6. Data model at a glance

About 50 Prisma models, grouped by domain:

| Domain | Models |
|---|---|
| Auth and settings | `Session`, `LoginLockout`, `AppSettings` (singleton) |
| Structure | `Pillar`, `Area` (including section-order configuration) |
| Habits | `Habit`, `HabitGoal`, `CheckIn` (full or minimum) |
| Goals | `LifeGoal` (Pillar goals), `ActionGoal` (legacy) |
| Tasks | `TaskList`, `Task`, `TaskStep`, `TaskTag`, `TaskTagOnTask`, `MyDayEntry` |
| Logging | `Metric`, `MetricEntry`, `PainMobilityLog` |
| Systems | `System`, `SystemStep`, `SystemStepOccurrence`, `SystemHabit`, `SystemGoal`, `SystemDecision`, `SystemEvaluation` |
| Finance | `Account`, `Snapshot`, `Statement`, `Transaction`, `Category`, `Receivable`, `Transfer`, `Goal`, `GoalContribution`, `Baseline`, `Budget`, `FinanceNorthStar`, `EnableBankingLink` |
| Journal | `Thought` |
| Nudges and review | `Nudge` (unique `dedupKey`, stored severity), `WeeklyReviewSession` |
| Visuals | `Visual`, `VisualRecord`, `TableColumn`, `TableRow` |

The schema is documented inline in `prisma/schema.prisma`. Almost every model has a `///` comment explaining its purpose and the decisions behind it.

---

## 7. Running, testing and deploying

### Environment variables (`.env.example`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Use Neon's pooled host in production. |
| `APP_PASSWORD_HASH_B64` | Base64-encoded bcrypt hash of the shared password |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob, for System checkpoint photos |
| `GEMINI_API_KEY` | Statement parsing |
| `CRON_SECRET` | Authenticates Vercel Cron calls to `/api/cron/nudges` |

### Local development
```bash
cp .env.example .env     # fill in DATABASE_URL + APP_PASSWORD_HASH_B64
npm install              # also runs prisma generate
npx prisma migrate dev
npm run dev              # http://localhost:3000 → /login
```
Generate a password hash with:
```bash
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1], 10)).toString('base64'))" "your-password"
```

### Quality checks
```bash
npm test            # Vitest unit tests
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
```

### Deployment
See [`DEPLOY.md`](../DEPLOY.md). In short: create a Neon database, create a Vercel project (with a Blob store and the env vars above) and deploy. `vercel-build` applies migrations automatically. To verify the deploy, check that `/` redirects to `/login` and that `/api/health` returns `{"ok":true}`. The app can then be installed as a PWA on mobile.

---

## 8. Project history (by phase)

The ADRs record the rebuild phase by phase. Most phases followed a design handoff ("design_handoff_personal_os v2").

| ADR | Phase or topic |
|---|---|
| 0001 | Stack: Next.js on Vercel, Neon Postgres, Prisma, password gate, PWA |
| 0002 | Nudge delivery rules |
| 0003 | Task repeat engine extended to match Habit schedules |
| 0004 | 30-day session and login rate-limiting |
| 0005 | **v2 Phase 1**: foundations (design tokens, PER_WEEK habits, Miscellaneous pillar, correlation minimum n=5) |
| 0006 | **Phase 2**: habits and tasks (recurrence, streaks, My Day) |
| 0007 | **Phase 3**: daily log sheet (since replaced by the Metric system) |
| 0008 / 0009 | **Phase 4**: Systems, and System review nudges |
| 0010 | **Phase 5**: Finances (statement upload with Gemini parsing, goal vehicles and priority) |
| 0011 | **Phase 6**: Insights rewiring, System deletion and evaluation |
| 0012 | **Phase 7**: finance analytics (spend deviation, Systems×surplus correlation) |
| 0013 | Account Transfers, multi-statement upload |
| 0014 | Mobile fit: row-actions overflow menu, computed mind-map layout |
| 0015 | Finance data integrity: Category taxonomy, Statement model, deduplication, reset |
| 0016 | User-creatable Pillars and Areas, generic section-based pages |
| 0017 | Generic data and visualization (charts and tables on any page) |

The most recent work (#181–#188), which has no separate ADR yet, replaced the fixed daily-log sheet with the generic **Metric** system. It added the global Log tab, metric management, history and trend views, and a missed-logging nudge. It also generalized the correlation engine to work on any pair of Metrics.

---

## 9. Explicit non-goals and future direction

**Non-goals** (from `CONTEXT.md`):
- No generic Kanban or task board.
- No calendar or events system.
- No heavy financial reporting beyond what's already described.
- No multi-tenancy for now.

**Deferred features:**
- **Pillars**: Religion, Productivity, Relationship and Career are sketched but not built out.
- **Appointments**: a Health feature for prep sheets and outcome notes. It's fully designed but not built.
- **Live bank and investment sync**: Enable Banking for bank and card accounts, and Trading 212's own API for investments.

**Long-term ambition:** a modular, "Notion at a much lower level" platform, where new features for a Pillar or Area come from configuring generic building blocks instead of writing custom code. This could also lead to selling the product. The section list (ADR-0016) and Visuals (ADR-0017) are the first concrete steps; the rest isn't designed yet.
