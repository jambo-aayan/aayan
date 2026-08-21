const GAP_DANGER_THRESHOLD = 8;

export type ActivityFixture = {
  /** Null for Unsorted/Inbox tasks and habits with no pillar (schema-wise
   * every Habit has one, but a fixture can still model the edge case). */
  pillarId: string | null;
  /** True for a Thought — Thoughts is always its own bucket regardless of
   * whether the thought itself carries a pillarId tag, per the handoff's
   * "for each pillar plus Unsorted/Inbox and Thoughts" (three distinct
   * kinds of bucket, not Thoughts nested inside a Pillar's count). */
  isThought: boolean;
};

export type PillarFixture = { id: string; name: string; intendedSharePct: number | null };

export type AttentionBalanceRow = {
  id: string;
  label: string;
  actualSharePct: number;
  /** Null for Unsorted/Inbox and Thoughts — there's no Pillar row to hang
   * an intended share on, so no marker or gap line renders for them. */
  intendedSharePct: number | null;
  gap: number | null;
  gapIsDanger: boolean;
};

const UNSORTED_ID = "unsorted";
const THOUGHTS_ID = "thoughts";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Actual share of activity per Pillar (plus Unsorted/Inbox and Thoughts as
 * their own buckets), and the gap against each Pillar's stated intended
 * share (Pillar.intendedTimeShare, from #58) — the design_handoff_aayan
 * README's Attention balance module. Pure: `activities` is whatever the
 * caller already resolved as "one unit of activity" (a completed task, a
 * habit check-in, a thought) within its chosen window.
 */
export function computeAttentionBalance(pillars: PillarFixture[], activities: ActivityFixture[]): AttentionBalanceRow[] {
  const counts = new Map<string, number>();
  const bump = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);

  for (const activity of activities) {
    if (activity.isThought) bump(THOUGHTS_ID);
    else bump(activity.pillarId ?? UNSORTED_ID);
  }

  const total = activities.length;

  function toRow(id: string, label: string, intendedSharePct: number | null): AttentionBalanceRow {
    const actualSharePct = total === 0 ? 0 : round1(((counts.get(id) ?? 0) / total) * 100);
    const gap = intendedSharePct === null ? null : round1(actualSharePct - intendedSharePct);
    return { id, label, actualSharePct, intendedSharePct, gap, gapIsDanger: gap !== null && Math.abs(gap) > GAP_DANGER_THRESHOLD };
  }

  return [
    ...pillars.map((p) => toRow(p.id, p.name, p.intendedSharePct)),
    toRow(UNSORTED_ID, "Unsorted / Inbox", null),
    toRow(THOUGHTS_ID, "Thoughts", null),
  ];
}

/** "12 points over your intent" / "3 points under your intent" / "Right on
 * your intent" — the plain-language line under each bar. Null (no
 * intended share set) reads as a neutral note, not a claim about a gap
 * that doesn't exist. */
export function attentionGapLabel(row: AttentionBalanceRow): string {
  if (row.gap === null) return "No intent set yet.";
  if (row.gap === 0) return "Right on your intent.";
  const points = Math.abs(row.gap);
  const pointsLabel = `${points} point${points === 1 ? "" : "s"}`;
  return row.gap > 0 ? `${pointsLabel} over your intent.` : `${pointsLabel} under your intent.`;
}
