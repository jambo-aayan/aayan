# Finance data integrity: Category taxonomy, Statement model, duplicate detection, transfer suggestions, and a full reset

Prompted by the user hitting six compounding problems on the Finances page at once: a "category
trend" view made useless by near-duplicate category strings, an unpaginated transaction list, no
duplicate detection on re-uploaded statements, no way to delete a transaction, a cashflow chart with
no hover detail, and numbers that "don't add up" (bundled into the same grilling session — see the
`grilling` skill session referenced from spec #146). Grilled jointly rather than as six independent
fixes because several share a root cause or a data model.

## Root causes, not symptoms

Two of the six symptoms trace back to the same gap: nothing on `Transaction` links it back to the
upload event it came from, and nothing checks whether an incoming statement row already exists
before inserting it. Re-uploading a statement whose date range overlaps a previous upload (the
user's own example: an August 15th partial statement, then the September 1st full one) silently
duplicates every overlapping row — which is very plausibly why "the numbers don't add up," alongside
the already-known ADR-0013 gap (an unflagged Transfer still double-counts spend and income). Fixing
both is table stakes before "delete everything and start fresh" (#6) is safe to act on — otherwise
the fresh start just re-accumulates the same problems on the next upload.

The category mess has a similarly single root cause: `Transaction.category` is free text, populated
by two independent, unvalidated sources (a `<datalist>` suggestion the user can type past, and
Gemini's free-guess during statement extraction) with no normalization between them. A trend view
that groups by exact string match was always going to fragment.

## `Category`: a new first-class Finance entity

**Naming note**: `CONTEXT.md`'s `Pillar` glossary entry says to avoid "Category" as a synonym for
Pillar — that's a leftover from the original prototype, where "Category" meant what's now `Pillar`.
This is a *different*, Finance-scoped concept (a Transaction's spending category, already referred
to informally as "category" in the Finance section of `CONTEXT.md` before this ADR) — not a revival
of the old usage. Glossary updated to make the distinction explicit rather than inventing an awkward
alternate name that fights existing prose.

A real `Category` table (`id`, `name`, unique), replacing the free-text `Transaction.category` string
with a `categoryId` FK. Pre-seeded with the existing default set (Housing, Food, Transport, Shopping,
Entertainment, Other) so the app isn't a blank slate on day one. User-editable from Settings://
add, rename, and **merge** (reassign every Transaction on category A onto category B, then delete A)
— merge is the one operation that actually cleans up an existing mess, not just prevents new ones.

Both category-entry paths get constrained to this table: manual entry becomes a real `<select>`
instead of a free-text input with a suggestion list, and the Gemini statement-extraction prompt is
given the current category names and asked to pick one (or fall back to "Other") rather than
free-generating a string.

## `Statement`: a new first-class Finance entity

Today, uploading a statement creates only a `Snapshot` row (`accountId`, `date`, `balance`,
`sourceFileUrl`, `confidence`) — no record of the upload event itself, no stored filename, and no
link from the `Transaction`s it produced back to it. That makes "group transactions by the statement
they came from" and "give statements a sensible name" both impossible without a schema change.

```
Statement {
  id
  accountId          -> Account
  name               // generated, user-editable afterward
  institutionName?
  periodStart?
  periodEnd?
  sourceFileUrl       // moved off Snapshot
  originalFilename?
  uploadedAt
}
```

`Snapshot` and `Transaction` each gain a nullable `statementId` FK (nullable because manual balance
entries and manually-entered transactions have no statement). `Statement` sits alongside `Snapshot`
rather than absorbing it — `Snapshot` already means "a balance at a point in time" independent of
statement upload (manual balance edits use it too), and folding the two together would force every
manual balance update to fake a statement.

**Naming**: generated as `{institutionName} — {account name} — {month YYYY}` from metadata the
*existing* Gemini extraction call is extended to also return (`institutionName`, `periodStart`,
`periodEnd`, added to the schema already used for transaction extraction — one round-trip, not two).
When extraction can't determine these confidently, falls back to `{account name} — Statement
{upload date}` using data already in the DB, so a low-confidence extraction never produces a blank
or broken name. Editable inline afterward, in case the generated name is wrong.

## Duplicate detection on upload

Dedup key: `(accountId, date, amount, direction)`. Deliberately excludes the transaction's free-text
`source`/description — that comes from Gemini's extraction of the same real bank line, and two
separate extractions of overlapping statement documents aren't guaranteed to produce byte-identical
wording, even though it's the same underlying transaction. Requiring an exact `source` match would
under-detect exactly the case the user described.

Behavior: rows matching an existing Transaction's key are silently skipped, not inserted a second
time; rows that don't match are inserted and linked to the new `Statement`. Upload finishes with a
count summary ("42 imported, 8 already existed") rather than a per-row confirmation step — the user
explicitly wants this to be a background "just notice and only add the new ones" behavior, not
another decision to make on every re-upload.

Skipped duplicates are left exactly as they were (still linked to whichever `Statement` first
inserted them) — the new `Statement` only claims the rows it actually inserted.

## Transfer suggestions surfaced proactively

ADR-0013 built Transfer linking as suggest-and-confirm, triggered by the user manually opening
"Link as transfer" on a specific transaction — which means an unflagged transfer is only fixed if
the user happens to think to go looking for it. The underlying candidate-ranking heuristic
(`canLinkTransfer`/`rankTransferCandidates` in `lib/finance/logic.ts`) is reused, not replaced:
extended with a `findTransferSuggestions()` pass that scans the whole unflagged Transaction set for
probable pairs, surfaced as a dedicated "possible transfers to review" list on the Finances page
(not an inline per-row badge — a batch-review list gives the user one sitting to clear instead of
something easy to scroll past). Still never auto-links; every suggestion requires the same explicit
confirm ADR-0013 already established.

## Transaction browsing: paginated, filterable, groupable by statement

The transaction list currently renders every row with no `take`/limit at all. Replaced with a
paginated, URL-search-param-driven list — filters for category, account, date range, and free-text
search, following the same `searchParams`-prop-plus-client-filter-component pattern already used by
Goals/Habits/Tasks (not a new convention). "Group by statement" is one more dimension in the same
list rather than a parallel view, so there's only one transaction-browsing UI to keep correct.

## Bulk delete

Row-level delete-with-undo already exists (`useUndoableCrudList`, matching Goals/Habits/Accounts) —
nothing new needed there. New: checkbox multi-select across rows, plus a "select all in this
statement" shortcut next to each statement group, both feeding the same underlying delete action.
Deleting a statement's transactions deletes its linked `Snapshot` (balance data point) in the same
action — a half-deleted statement (transactions gone, a stale balance snapshot left behind) is a
more confusing state than either extreme, and removing a statement is almost always because it was
wrong or duplicated, which puts the balance it recorded in the same doubt.

## Cashflow chart hover

Small, presentational — a vertical guide line plus a tooltip (date + that day's running balance, the
same value already plotted by `cashFlowTrend()`) on hover, added via a small pure
`nearestCashFlowPoint()` lookup helper alongside the existing chart data function. Not treated as its
own grilling branch; bundled here the same way ADR-0013 bundled its two companion fixes.

## Full reset, once the above ships

A real, confirmation-gated ("type DELETE to confirm") Settings action — the first of its kind in
this app; no prior "danger zone" pattern existed to reuse. Wipes `Transaction`, `Snapshot`,
`Transfer`, `Receivable`, `GoalContribution`, and `Statement` (all six now needed on the wipe list
now that `Statement` exists); keeps `Account`/`Goal`/`Habit` shells intact so the user re-uploads
into the same structure rather than rebuilding it. Ordered as explicit deletes (no cascade defined
today), not a raw script — built as a reusable in-app action since the user may want it again if a
future bug surfaces, not a one-off cleanup this session runs directly.

## Out of scope

- No account-linking/Open Banking work — still fully manual/statement-upload driven, per the
  existing "Setup / first-run" section of `CONTEXT.md`.
- No auto-linking of transfers — suggestion-and-confirm only, unchanged from ADR-0013.
- No amount-range or merchant-name filter on the transaction list — category/account/date-range/
  search cover the realistic use cases; amount-range is rarely how a transaction is actually found.
- No net-worth/accounts-card visual redesign — noted in passing during triage, not part of this
  body of work.
- No change to `Budget`, `Statements analytics`, or `Spend deviation` (ADR-0012) — those read from
  `Transaction`/`categoryBreakdown` and inherit the Category/dedup fixes for free, no direct changes
  needed to those modules themselves.

## Addendum (#173): `Category` becomes a fixed, system-managed hierarchy

The user-editable flat taxonomy this ADR introduced above fragmented again over time — organic
Add/merge use produced ~40 near-duplicate categories (Housing/Housing (Rent)/Rent, Shopping ×5
variants, Utilities ×6 variants, etc.), the same failure mode this ADR originally fixed, just via a
different mechanism (user-driven drift instead of two unvalidated free-text sources). Rather than
another round of merge-cleanup, `Category` gains one level of hierarchy (`parentId`, nullable
self-relation — top-level categories have `parentId: null`, subcategories point to a parent) and
becomes fixed: no more Add/Rename/Merge from Settings (that screen becomes read-only, a later
ticket), the taxonomy only changes by editing `lib/finance/categories.ts`'s `CATEGORY_HIERARCHY` and
writing a matching migration.

**A `Transaction` always categorizes at the leaf (subcategory) level, never a top-level category
directly.** Every top-level category needs at least one subcategory to be assignable at all — even
"Other" gets a single "Uncategorized" leaf, so the fallback path still lands on a real leaf rather
than the special-casing a top-level fallback would need everywhere spend is grouped by category.
This can't be enforced by a Postgres check constraint (no same-table subquery support), so it's an
app-layer invariant instead: the statement/import categorizer only ever resolves to a leaf (#174),
and every category-grouping/breakdown module downstream can assume `categoryId` is always a leaf.

`Category.parentId`'s FK is `ON DELETE CASCADE` rather than this codebase's usual optional-relation
default of `SET NULL` — deliberately, since a `parentId: null` row left behind by `SET NULL` would
silently (and incorrectly) look like a new top-level category rather than an orphaned subcategory.
Cascading is safe specifically because the taxonomy is now fixed and system-managed: a top-level
category is never deleted except by a migration that's also revising its subcategories in the same
breath.
