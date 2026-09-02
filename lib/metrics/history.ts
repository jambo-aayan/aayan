export type MetricEntryForHistory = { date: Date; numberValue: number | null; textValue: string | null };
export type HistoryPoint = { label: string; value: number };

/** A Metric's numeric entries (NUMBER/SCALE_5/BOOLEAN) as chart points,
 * oldest first (#185) — feeds LineTrendChart the same way every other
 * bound/ad-hoc chart in the app already does. Entries with no
 * numberValue (a TEXT/ENUM metric's, or a gap) are skipped rather than
 * plotted as 0 — a missing day is missing, not zero. */
export function metricHistoryPoints(entries: MetricEntryForHistory[]): HistoryPoint[] {
  return entries
    .filter((e): e is MetricEntryForHistory & { numberValue: number } => e.numberValue !== null)
    .map((e) => ({ label: e.date.toISOString().slice(0, 10), value: e.numberValue }));
}
