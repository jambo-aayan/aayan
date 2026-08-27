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
