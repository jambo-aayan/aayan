export type ParsedTransactionForDedup = {
  date: string; // YYYY-MM-DD, matches ParsedTransaction's own shape
  amount: number;
  direction: "IN" | "OUT";
};

export type ExistingTransactionKey = {
  accountId: string | null;
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
};

function keyFor(accountId: string | null, date: string, amount: number, direction: "IN" | "OUT"): string {
  return `${accountId}|${date}|${amount}|${direction}`;
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Partitions newly parsed statement rows against what's already in the
 * DB, so re-uploading a statement whose date range overlaps a previous
 * upload only adds genuinely new rows (#149, ADR-0015). Dedup key:
 * `(accountId, date, amount, direction)` — deliberately excludes the
 * free-text description/source, since Gemini's extraction of the same
 * real bank line across two different statement documents isn't
 * guaranteed to produce identical wording. Pure — no DB access; the
 * caller fetches `existing` once (typically every Transaction on this
 * account) and passes it in.
 *
 * Known, accepted limitation: two genuinely distinct transactions that
 * happen to share the same account/date/amount/direction (e.g. two
 * separate £5 coffees on the same day) are indistinguishable by this key
 * and will collapse to one *if one of them is already in the DB*.
 * Deliberately accepted, same as the ADR's broader tradeoff —
 * under-detecting a true duplicate (re-importing the same real
 * transaction) is worse than the rare false-collapse of two
 * coincidentally-identical ones, which is also easy to notice and fix
 * manually (add the missing one back) if it ever happens.
 *
 * Only compares against `existing` — never against sibling rows within
 * the same `parsed` batch. An earlier version also collapsed same-batch
 * matches as a "defensive extra," but that's a materially different (and
 * unacceptable) risk: two genuinely distinct same-day/same-amount
 * transactions in one real statement (e.g. two identical parking fees)
 * would be silently and permanently dropped, mislabeled to the user as
 * "already existed" when neither one did. The AC only ever asked for
 * cross-upload dedup — this stays scoped to exactly that. */
export function partitionNewTransactions<T extends ParsedTransactionForDedup>(
  accountId: string,
  parsed: T[],
  existing: ExistingTransactionKey[]
): { toInsert: T[]; skipped: T[] } {
  const existingKeys = new Set(
    existing.filter((e) => e.accountId === accountId).map((e) => keyFor(e.accountId, dateOnly(e.date), e.amount, e.direction))
  );
  const toInsert: T[] = [];
  const skipped: T[] = [];
  for (const t of parsed) {
    const key = keyFor(accountId, t.date, t.amount, t.direction);
    if (existingKeys.has(key)) {
      skipped.push(t);
    } else {
      toInsert.push(t);
    }
  }
  return { toInsert, skipped };
}
