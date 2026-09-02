export type MetricEntryForHistory = { id: string; date: Date; numberValue: number | null; textValue: string | null };
export type HistoryPoint = { label: string; value: number };
export type MetricCadence = "DAILY" | "WEEKLY" | "AD_HOC";

/** DAILY/WEEKLY entries are already one-per-period (the DB's own
 * @@unique([metricId, date]) constraint), so a day-only label is
 * unambiguous. AD_HOC entries can repeat same-day (#181's own point of
 * that cadence), so they need the full timestamp or two same-day entries
 * would render as indistinguishable, overlapping x-axis ticks. */
function formatLabel(date: Date, cadence: MetricCadence): string {
  return cadence === "AD_HOC" ? date.toISOString().slice(0, 16).replace("T", " ") : date.toISOString().slice(0, 10);
}

/** A Metric's numeric entries (NUMBER/SCALE_5/BOOLEAN) as chart points,
 * oldest first (#185) — feeds LineTrendChart the same way every other
 * bound/ad-hoc chart in the app already does. Entries with no
 * numberValue (a TEXT/ENUM metric's, or a gap) are skipped rather than
 * plotted as 0 — a missing day is missing, not zero. */
export function metricHistoryPoints(entries: MetricEntryForHistory[], cadence: MetricCadence): HistoryPoint[] {
  return entries
    .filter((e): e is MetricEntryForHistory & { numberValue: number } => e.numberValue !== null)
    .map((e) => ({ label: formatLabel(e.date, cadence), value: e.numberValue }));
}
