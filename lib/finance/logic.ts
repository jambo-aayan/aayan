export type SnapshotLike = { date: Date; balance: number };

/** A Valuation account's value for any given point in time is its most
 * recent known Snapshot on or before that date, carried forward — a gap
 * between statements doesn't make the account look like it vanished
 * (ADR-0010). Returns null when no snapshot exists yet on or before the
 * date, rather than fabricating a zero balance. */
export function resolveAccountValueAt(snapshots: SnapshotLike[], asOf: Date): number | null {
  const eligible = snapshots.filter((s) => s.date.getTime() <= asOf.getTime());
  if (eligible.length === 0) return null;
  return eligible.reduce((latest, s) => (s.date.getTime() > latest.date.getTime() ? s : latest)).balance;
}

export type GoalPriorityRow = { priority: number };

/** Sorts Goals by their explicit priority rank (ascending — lower number
 * first), not implied by vehicle type (ADR-0010). Array.prototype.sort is
 * stable, so goals sharing a rank keep their existing relative order. */
export function sortGoalsByPriority<T extends GoalPriorityRow>(goals: T[]): T[] {
  return [...goals].sort((a, b) => a.priority - b.priority);
}

export type ReclassifiableTransaction = {
  receivableId: string | null;
  goalContributionId: string | null;
  transferId: string | null;
};

/** A transaction can only carry one reclassification at a time — a
 * receivable, a goal contribution, or a transfer, never more than one
 * (#114/#120, ADR-0010; #138, ADR-0013). A transaction already linked to
 * one can't be linked to another without first being unflagged/unlinked. */
export function canReclassifyTransaction(transaction: ReclassifiableTransaction): boolean {
  return transaction.receivableId === null && transaction.goalContributionId === null && transaction.transferId === null;
}

export type SpendClassifiedTransaction = {
  receivableId: string | null;
  goalContributionId: string | null;
  transferId: string | null;
};

/** Whether a transaction counts as real spend/income anywhere totals are
 * computed — a receivable-, goal-contribution-, or transfer-flagged
 * transaction is a reclassification, not real money movement (ADR-0010,
 * ADR-0013). The single shared predicate for what was previously 5
 * duplicated inline checks across categoryBreakdown, statements.ts,
 * computeSurplusRate, getCorrelations, and spend-deviation.ts's own
 * reliance on categoryBreakdown (#137) — kept as one rule so it can never
 * drift between call sites. */
export function isRealSpend(transaction: SpendClassifiedTransaction): boolean {
  return transaction.receivableId === null && transaction.goalContributionId === null && transaction.transferId === null;
}

export type TransferCandidateTransaction = { accountId: string | null; direction: "IN" | "OUT" };

/** A Transfer only makes sense between two different Accounts (same-
 * account linking isn't a transfer) with opposite directions (money has
 * to actually leave one account and arrive another) — #138, ADR-0013. No
 * amount-equality check: mirrors settleReceivable's existing repayment
 * link, which never enforced the repayment matches the original amount
 * either (a minimum-payment-vs-statement-balance mismatch, or bank
 * rounding, shouldn't block linking). */
export function canLinkTransfer(a: TransferCandidateTransaction, b: TransferCandidateTransaction): boolean {
  if (a.accountId === null || b.accountId === null || a.accountId === b.accountId) return false;
  return a.direction !== b.direction;
}

export const TRANSFER_CANDIDATE_WINDOW_DAYS = 5;
export const TRANSFER_CANDIDATE_MAX = 5;

export type RankableTransaction = { id: string; accountId: string | null; direction: "IN" | "OUT"; date: Date; amount: number };

/** Ranks candidate transactions as likely Transfer matches for `target` —
 * a suggestion, never an auto-link (#139, ADR-0013). Filtered to what
 * canLinkTransfer would allow (different account, opposite direction) and
 * within ±TRANSFER_CANDIDATE_WINDOW_DAYS of target's date, then sorted by
 * closest absolute amount difference first and capped at
 * TRANSFER_CANDIDATE_MAX — the user still picks, this just surfaces the
 * likeliest options first. */
export function rankTransferCandidates<T extends RankableTransaction>(target: RankableTransaction, candidates: T[]): T[] {
  const windowMs = TRANSFER_CANDIDATE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return candidates
    .filter((c) => c.id !== target.id && canLinkTransfer(target, c))
    .filter((c) => Math.abs(c.date.getTime() - target.date.getTime()) <= windowMs)
    .sort((a, b) => Math.abs(a.amount - target.amount) - Math.abs(b.amount - target.amount))
    .slice(0, TRANSFER_CANDIDATE_MAX);
}

/** Below this, a statement-parsed transaction is held for review rather
 * than silently accepted with a possibly-wrong category (#115, ADR-0010).
 * Chosen as a starting point balancing false-holds against silently
 * accepting a miscategorized transaction — tunable without a schema
 * change since it's read fresh on every parse. */
export const CONFIDENCE_THRESHOLD = 0.7;

/** A manually entered transaction has no confidence score (null) and is
 * never held — the threshold only applies to statement-parsed ones. */
export function isHeldForReview(confidence: number | null): boolean {
  if (confidence === null) return false;
  return confidence < CONFIDENCE_THRESHOLD;
}

export type ValidationResult = { ok: true } | { ok: false; error: string };

export const MAX_STATEMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_STATEMENT_MIME_TYPES = new Set(["application/pdf", "text/csv"]);

/** Client-side and server-side pre-upload check for a statement upload —
 * PDF or CSV only, 10MB cap, matching Phase 4's Checkpoint photo
 * validation shape (#115, ADR-0010). */
export function validateStatementUpload(mimeType: string, sizeBytes: number): ValidationResult {
  if (!ALLOWED_STATEMENT_MIME_TYPES.has(mimeType)) {
    return { ok: false, error: "That doesn't look like a statement — try a PDF or CSV." };
  }
  if (sizeBytes > MAX_STATEMENT_BYTES) {
    return { ok: false, error: "That statement is too large — keep it under 10MB." };
  }
  return { ok: true };
}

export type SignedAmount = { amount: number; direction: "IN" | "OUT" };

/** The net effect of a batch of parsed transactions on an account's
 * balance — IN adds, OUT subtracts (#115, ADR-0010). Only a fallback input
 * to resolveStatementBalance below, for a statement that doesn't state its
 * own closing balance — not itself the source of truth for a Snapshot's
 * balance. */
export function netTransactionAmount(transactions: SignedAmount[]): number {
  return transactions.reduce((sum, t) => sum + (t.direction === "IN" ? t.amount : -t.amount), 0);
}

/** The Snapshot balance a statement upload creates. Prefers the statement's
 * own stated closing balance (ground truth) over the computed running
 * total — a computed total can never recover from a wrong starting point
 * (e.g. the account's balance before its very first statement upload), so
 * every subsequent upload would otherwise carry that error forward
 * indefinitely. Falls back to the computed delta only when the statement
 * doesn't state a balance at all (e.g. some CSV exports) — and only in
 * that fallback, `accountType` matters: netTransactionAmount's IN-adds/
 * OUT-subtracts convention is correct for an ASSET (spending reduces what
 * you hold), but backwards for a LIABILITY like a credit card, where a
 * purchase (OUT) increases what's owed rather than decreasing it (#141,
 * ADR-0013). The closing-balance-stated path is already sign-agnostic — a
 * plain magnitude straight from the statement — so accountType has no
 * effect there. */
export function resolveStatementBalance(
  previousBalance: number,
  transactions: SignedAmount[],
  closingBalance: number | null,
  accountType: "ASSET" | "LIABILITY"
): number {
  if (closingBalance !== null) return closingBalance;
  const delta = netTransactionAmount(transactions);
  return previousBalance + (accountType === "LIABILITY" ? -delta : delta);
}
