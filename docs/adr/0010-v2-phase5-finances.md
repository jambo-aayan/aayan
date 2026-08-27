# v2 Phase 5: Finances — statement upload over live APIs, LLM parsing, and a prioritized/vehicle-typed Goal plan

Phase 5 builds out the Finance pillar's remaining surface per the design handoff's stated
implementation order: accounts, snapshots, transactions, receivables, and Statements
(SCREENS.md's "Finances (pillar)" and "Statements" sections, DATA_MODEL.md §8). Decided ahead of
`/to-spec`, in a grilling session that also reopened and expanded the Goal model beyond the
handoff's own scope, at the user's explicit request.

## Data source: statement upload, not live bank/investment APIs

The handoff explicitly excludes live bank APIs from Phase 5 ("Statement upload and manual
valuation only... the prototype mocks realistic parsed transactions"). This app already has a
real, working Enable Banking OAuth integration (`lib/enable-banking/*`, `/finances/link-bank`) —
auth flow, session handling, link storage — and CONTEXT.md names the user's real accounts (Lloyds
via Enable Banking, a Trading 212 S&S ISA via its own API) as the eventual integration targets.
Despite that existing scaffolding and stated intent, Phase 5 follows the handoff's scope exactly:
Statements (upload + parse) is what gets built now. The Enable Banking flow is left **dormant,
untouched** — a real head start for a later, separate ticket, not wired into Statements or
Account/Snapshot in this phase. This is worth recording precisely because a future reader will
find working OAuth code that nothing calls and could reasonably assume it's dead or half-finished
rather than a deliberate scope boundary.

## Statement parsing: real, via Gemini 2.5 Flash — not mocked, not traditional heuristics

The handoff's own scope note says the parser is mocked ("the prototype mocks realistic parsed
transactions"). This app builds a **real** parser instead, using Gemini 2.5 Flash via Google's
`@google/genai` SDK: the uploaded PDF is sent directly as file input (no separate PDF-text-
extraction step needed), CSV as plain text, both against a structured JSON schema for extracted
transactions. Chosen over hand-written per-bank heuristics (regex/column-mapping rules) because
real bank statement layouts (Lloyds, Yonder, Trading 212 all differ) vary enough that heuristic
rules would need real per-bank samples to write and test against, which this sandbox doesn't have
— an LLM extracting against a schema generalizes across layouts without bank-specific code. New
env var `GEMINI_API_KEY`, documented in `DEPLOY.md`/`.env.example`, same pattern as Phase 4's
`BLOB_READ_WRITE_TOKEN`. Every parsed transaction carries a confidence
signal; below-threshold ones route to the uncategorised queue (DATA_MODEL.md's own stated intent)
rather than being silently accepted.

## Schema: Account/Snapshot/Receivable per ADR-0005, unchanged by this phase's new information

ADR-0005 already pre-decided the migration shape three phases ago: `Item`→`Account` (rename +
`kind`/`cls`/`manualOnly`/`active`), a new per-account dated `Snapshot` (keeps the original
uploaded file, via Vercel Blob — same storage choice as Phase 4's Checkpoint photos), and
`Transaction.linkedItemId`→a real `accountId` FK. Nothing decided in this phase's grilling changes
that shape — statement-upload fits it directly (a Snapshot's source is the uploaded file). `Goal`
stays a separate model from this Account/Snapshot/Receivable reshape, per ADR-0005's "stays split,
not merged" call — but grows real new structure of its own, below.

## Receivable: flagging a transaction creates a linked, open Receivable

Converting cash→receivable is a no-net-worth-change reclassification (DATA_MODEL.md). Reviewing an
outgoing transaction and flagging "this became a receivable" creates a new open `Receivable`
(amount defaults from the transaction, editable) linked back to it, and excludes that transaction
from spend totals — never counted as spend, per spec. Settling is a separate action on the
Receivable itself, optionally linking the repayment transaction; finding/flagging a matching
incoming transaction is never required to settle.

## Goal: vehicle-typed, explicitly prioritized, with a real contribution log

The handoff's own DATA_MODEL.md has no concept of a savings vehicle or ordering for Goals — a Goal
is just name/target/saved/monthlyContribution. CONTEXT.md names a real priority order (Emergency
fund → LISA → wedding → S&S ISA) that has nowhere to live in the app. Initially ruled out of scope
as beyond the handoff, then explicitly reopened and expanded at the user's request ("it can't be a
one-stop finance planner without it") into a materially larger addition than the rest of this
phase's schema work:

- **`vehicle` enum** on Goal: Emergency Fund / LISA / Pension / Stocks & Shares ISA / Cash ISA /
  Generic. A label only — no contribution-cap tracking, no bonus calculation (LISA's 25% government
  top-up, its £4,000/yr cap, its £450k property cap; ISA's £20,000/yr allowance) is modeled. Those
  are a real, separate feature, deliberately deferred rather than folded in here.
- **Emergency Fund becomes its own Goal row**, not just the existing liquid-net-worth runway calc
  (still computed separately, unchanged, from `accessible` Accounts) — it needs to be a real row to
  take its place at the top of an ordered list alongside the others.
- **Priority is an explicit, user-editable rank per Goal**, not implied by vehicle type — a fixed
  "Emergency fund always first" rule baked into the enum would be brittle the moment priorities
  actually change or two goals share a vehicle.
- **No automatic waterfall allocator.** Priority rank sorts and labels the list for display; it does
  not compute a recommended per-goal split of monthly surplus. `monthlyContribution` stays a number
  the user sets per goal themselves.
- **A dedicated "Financial plan" section** on the Finances dashboard, not a tweak to the existing
  small Goals Manage card — elevated, separate from the general net-worth/transactions surface, per
  the user's explicit ask for "a screen to set up all my financial goals/plans."
- **`GoalContribution`**: a dated, per-goal log entry; `saved` becomes the computed sum of its
  entries rather than a manually-overwritten total, giving real contribution history. Optionally
  linked to a Transaction, mirroring the Receivable mechanic exactly — reviewing an outgoing
  transaction can flag "this went toward Goal X" instead of "this became a receivable," creating a
  linked contribution and excluding it from spend totals the same way. A contribution can also be
  logged standalone with no transaction, for backfilling history or money moved outside anything
  tracked. `monthlyContribution` (the stated plan) and the contribution log (what actually happened)
  are kept deliberately distinct — they're allowed to diverge, and that divergence is itself useful
  information, not a bug to reconcile away.
- **A monthly surplus-split card**, not a Nudge — surplus is already computed; surfacing it as a
  passive card on the Financial plan section (pre-filled per-goal inputs at £0) avoids inventing a
  new monthly cron cadence the Nudges scheduler doesn't have today (Morning/Evening/Weekly-review
  only).
- **Progress rings already exist** (`GoalRingsCard`, `NorthStarRingCard`, a shared `Ring`
  component) — no new charting is built for "how far am I toward this goal." `GoalRingsCard`'s
  existing 3-goal cap is fixed to show the full prioritized list rather than silently truncating it,
  matching the no-silent-truncation convention Phase 4 established.

## Setup: a Finance-scoped checklist, not a new wizard pattern

CONTEXT.md flags "Finance needs a real setup flow" as unbuilt. Rather than a new multi-step wizard
pattern this app doesn't otherwise use, Phase 5 extends the existing "Day One" idiom
(`lib/onboarding`) scoped to Finance: a checklist card (Baseline set? · first Account added? · a
Goal created?) shown while those are still unset, each item linking straight to its existing
Manage card.
