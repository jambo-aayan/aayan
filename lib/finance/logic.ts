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

export type ReclassifiableTransaction = { receivableId: string | null; goalContributionId: string | null };

/** A transaction can only carry one reclassification at a time — a
 * receivable OR a goal contribution, never both (#114/#120, ADR-0010).
 * A transaction already linked to either can't be linked again without
 * first being unflagged. */
export function canReclassifyTransaction(transaction: ReclassifiableTransaction): boolean {
  return transaction.receivableId === null && transaction.goalContributionId === null;
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
 * balance — IN adds, OUT subtracts. Used to derive the Snapshot balance a
 * statement upload creates, carrying the account's prior balance forward
 * plus whatever the newly parsed transactions moved (#115, ADR-0010). */
export function netTransactionAmount(transactions: SignedAmount[]): number {
  return transactions.reduce((sum, t) => sum + (t.direction === "IN" ? t.amount : -t.amount), 0);
}
