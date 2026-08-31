# Account Transfers (a third reclassification type), multi-statement upload, and a liability-account balance bug

Prompted by the user's actual usage pattern: Yonder (a credit card, `Account.type: LIABILITY`) is where
almost all real spending happens; Lloyd's (a bank account) pays the Yonder bill in full every month.
Two problems fell out of that once the [Phase 7](./0012-v2-phase7-finance-analytics.md) statement-
balance fix (ADR-0012's follow-up bug fix, shipped the same day) started working correctly: the monthly
bill payment shows up as an `OUT` on Lloyd's and an `IN` on Yonder, and nothing in the codebase knows
these are the same money moving between the user's own two accounts — so it silently inflates both spend
and income totals every month, exactly the kind of gap `Receivable`/`GoalContribution` already exist to
close for other reclassification cases (ADR-0010, #114/#120).

## A third reclassification type: Transfer

Deliberately not a generalization of `Receivable` — `Receivable` needs its own `status`
(OPEN/SETTLED), `openedAt`/`settledAt`, and `amount` because it can exist for months before a
repayment transaction is ever linked ("money owed", a state that persists independent of any
transaction). A Transfer has no such state: both its transactions already exist by the time a user
links them, so there's nothing to be "open" about. New minimal model instead:

```
Transfer { id, note?, createdAt }
```

No `amount`, no `date` — those already live on the two linked `Transaction` rows, and storing a
second copy would just be one more thing that could drift from them. `Transaction` gains a third
nullable `transferId` FK alongside `receivableId`/`goalContributionId`, atomically claimed the same
way `claimTransaction`'s WHERE-clause guard already does for the other two — a transaction can carry
exactly one reclassification, never more than one.

General to any two of the user's own Accounts, not hardcoded to Lloyd's/Yonder — the schema has no
concept of "the" credit card account, and shouldn't gain one just because this user has exactly two
Transactional accounts today.

**Guardrails enforced at link time**: the two transactions must be on *different* accounts (same-
account linking isn't a transfer, it's nonsense), and must have *opposite* directions (one `OUT`,
one `IN` — a transfer is definitionally money leaving one account and arriving another). No amount-
equality check between the two sides — mirrors `settleReceivable`'s existing repayment link, which
never enforced the repayment matches the original amount either (a minimum-payment-vs-statement-
balance mismatch, or bank rounding, shouldn't block linking).

## Linking UX: suggest, never auto-link

Fully manual linking (pick side A, then pick side B) was the safe baseline, matching
`flagAsReceivable`'s existing shape exactly — but this is a monthly, recurring action for this user,
so pure manual search across every transaction on every other account is real ongoing friction.
Compromise: a "suggested matches" list — candidate transactions on other accounts, opposite
direction, within ±5 days of the transaction being linked, ranked by closest amount, capped at 5 —
surfaced but never auto-selected. The user still explicitly confirms which one, if any, is the
match. No amount/date tolerance is enforced as a hard filter beyond that ±5-day window; it's a
ranking aid, not a validation rule.

**Unlinking** exists from day one (clears `transferId` on both sides, deletes the `Transfer` row) —
unlike `Receivable`/`GoalContribution`, which have no unflag action, because a suggestion-driven UI
makes an accidental wrong link more likely than the fully-manual receivable flow ever was.

## Consolidating the exclusion check

Before this ADR, "is this transaction real spend/income" was hand-derived as
`receivableId === null && goalContributionId === null`, duplicated inline across five call sites
(`categoryBreakdown`, `statements.ts`'s `isRealSpend`, `computeSurplusRate`, `getCorrelations`,
`spend-deviation.ts`). Adding a third field as a sixth copy-pasted `&& transferId === null` would
cross from "acceptable small duplication" into a real Duplicated Code smell with three fields to keep
in sync by hand. Consolidated into one shared predicate in `lib/finance/logic.ts` first, then every
call site switched to call it — "make the change easy, then make the easy change."

## Two smaller companion fixes, bundled in

Small enough not to need their own grilling round, but landing alongside this work since they
touch the same statement-upload path:

- **Multi-statement upload**: the upload control only ever accepted one file
  (`<input type="file">`, no `multiple`); `uploadStatement`/`uploadValuationStatement` each took one
  `File`. Extended to accept multiple files, parsed sequentially (not parallel — Gemini rate limits
  and the atomic balance-claim logic both favor one-at-a-time), with one combined result summary
  rather than a toast per file.
- **Liability-account balance-fallback direction bug**: `resolveStatementBalance`'s fallback path
  (used only when a statement states no closing balance at all) computed
  `previousBalance + netTransactionAmount(transactions)`, where `IN` adds and `OUT` subtracts —
  correct for a bank account, backwards for a credit card, where a purchase (`OUT`, real spending)
  should *increase* what's owed, not decrease it. Masked in practice whenever a statement states its
  own balance (which the Phase 7 follow-up fix now prioritizes), but a real bug for the CSV-without-
  balance edge case. Fixed by threading the account's `type` into the fallback computation and
  flipping the sign for `LIABILITY`.

## Out of scope

- No auto-detection/auto-linking of transfers — suggestion only, always a manual confirm.
- No support for a transfer split across multiple transactions on either side (e.g. two partial
  card payments in one month) — one transaction links to exactly one other.
- No generalization beyond Lloyd's/Yonder's specific pattern (bank pays credit card in full) — any
  two accounts, any direction, works the same way, but nothing assumes a "primary" vs "card" account.
- No change to how `netWorth()` signs a `LIABILITY` account's contribution — untouched, this ADR
  only affects the transaction-level spend/income exclusion and the statement-upload balance fallback.
