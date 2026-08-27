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

export type ReceivableFlaggableTransaction = { receivableId: string | null };

/** A transaction can only be linked to one reclassification at a time
 * (#114, ADR-0010) — a transaction already flagged as a receivable can't
 * be flagged again without first being unflagged/settled. */
export function canFlagAsReceivable(transaction: ReceivableFlaggableTransaction): boolean {
  return transaction.receivableId === null;
}
