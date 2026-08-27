/** A logged SystemEvaluation entry's three dimensions — the shape this
 * pure module operates on, independent of Prisma's row shape (a caller
 * maps its own fetched rows into this). */
export type EvaluationFixture = {
  date: Date;
  effectiveness: number;
  consistency: number;
  sustainability: number;
  note: string | null;
};

/**
 * An entry's overall score — the plain average of its three 1-5 ratings.
 * Always shown alongside the individual ratings, never in place of them
 * (docs/adr/0011-v2-phase6-insights.md §"System evaluation") — the whole
 * point of three separate questions is catching divergence between
 * dimensions that a single blended number would hide.
 */
export function evaluationScore(entry: { effectiveness: number; consistency: number; sustainability: number }): number {
  return (entry.effectiveness + entry.consistency + entry.sustainability) / 3;
}

const STALENESS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An ACTIVE System is "stale" once it's gone 30+ days with no evaluation
 * logged at all — a soft card badge, same idiom as the Statements tab's
 * flag for accounts with no recent statement upload, not a new visual
 * language, and not a Nudge (ADR-0011 explicitly defers any Nudge
 * tie-in). `mostRecentDate` is the caller's own most-recent-first lookup
 * (getSystemEvaluations, or a System's own `evaluations[0]`), null when a
 * System has never had one logged — always stale in that case, same as
 * "no statement ever uploaded" would be.
 */
export function isEvaluationStale(mostRecentDate: Date | null, today: Date): boolean {
  if (mostRecentDate === null) return true;
  const days = Math.floor((today.getTime() - mostRecentDate.getTime()) / DAY_MS);
  return days >= STALENESS_DAYS;
}

export type NeedsAttentionEntry = {
  systemId: string;
  systemName: string;
  score: number;
  reason: "low-score" | "declining-trend";
};

/**
 * Surfaces the single System most worth a look: a sharpest-first declining
 * trend (any one dimension dropping 1+ point from a System's previous
 * entry to its latest) takes priority over a plain lowest-recent-score
 * ranking, since a declining System is the more urgent signal — a System
 * that's merely been low but flat isn't newly worth attention. Falls back
 * to lowest recent score when nothing is declining. Distinct from the
 * Neglect radar (which measures *absence* of activity): this measures
 * *presence with declining quality*, a different failure mode a
 * recency-only signal can't see (ADR-0011). Returns null when no System
 * has any evaluation entries at all.
 */
export function needsAttention(
  systems: { id: string; name: string; entries: EvaluationFixture[] }[]
): NeedsAttentionEntry | null {
  let sharpestDecline: NeedsAttentionEntry | null = null;
  let sharpestDeclineAmount = 0;
  let lowestScore: NeedsAttentionEntry | null = null;

  for (const system of systems) {
    if (system.entries.length === 0) continue;
    // Most recent first is the caller's contract (getSystemEvaluations) —
    // sort defensively here too so this function is correct even if a
    // caller passes entries in a different order.
    const sorted = [...system.entries].sort((a, b) => b.date.getTime() - a.date.getTime());
    const latest = sorted[0];
    const latestScore = evaluationScore(latest);

    if (lowestScore === null || latestScore < lowestScore.score) {
      lowestScore = { systemId: system.id, systemName: system.name, score: latestScore, reason: "low-score" };
    }

    if (sorted.length >= 2) {
      const previous = sorted[1];
      const drop = Math.max(
        previous.effectiveness - latest.effectiveness,
        previous.consistency - latest.consistency,
        previous.sustainability - latest.sustainability
      );
      if (drop >= 1 && drop > sharpestDeclineAmount) {
        sharpestDeclineAmount = drop;
        sharpestDecline = { systemId: system.id, systemName: system.name, score: latestScore, reason: "declining-trend" };
      }
    }
  }

  return sharpestDecline ?? lowestScore;
}
