/** Visual.config is untyped Json at the schema level (#161/#162) — these
 * narrow it per chart type that actually needs config, rather than
 * trusting a cast at every read site. Pure — no Prisma/React. */

export type ProgressBarConfig = { target: number };

export function parseProgressBarConfig(config: unknown): ProgressBarConfig | null {
  if (typeof config !== "object" || config === null) return null;
  const target = (config as Record<string, unknown>).target;
  return typeof target === "number" && Number.isFinite(target) ? { target } : null;
}

/** Current/target → a percent, clamped at 100 and rounded (#171) — the
 * one canonical formula behind every progress percentage in this app: a
 * Progress bar Visual's own fill width, and (via lib/finance/goal-math.ts's
 * goalProgressPercent, which now delegates here) Finance's goal rings.
 * Rounds because a Ring literally displays this as text ("70%"); a
 * Progress bar's fill width doesn't need that precision but rounding
 * doesn't visibly change a CSS percentage width either, so one formula
 * serves both without a visible difference to either. Deliberately has NO
 * lower clamp — Finance's own net-worth-backed goal ring can be
 * legitimately negative (liabilities exceeding assets) and must keep
 * showing that as a real negative percent, not floor it to "0%"; a
 * caller that specifically needs a non-negative result (a Progress bar's
 * CSS fill width can't render a negative one sensibly) clamps that itself
 * — see ProgressBarVisual. */
export function progressPercent(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

/** The four sources a Line/Bar/Progress bar/Streak heatmap chart can bind
 * to instead of holding ad-hoc VisualRecords (#166, ADR-0017) — resolved
 * at render time by lib/visuals/resolve-binding.ts, never persisted as
 * records. Scatter's own binding is #167. */
export type ChartAdapterKind = "habit-checkins" | "system-evaluations" | "goal-progress" | "finance-balances";

const ADAPTER_KINDS: ChartAdapterKind[] = ["habit-checkins", "system-evaluations", "goal-progress", "finance-balances"];

export type ChartBinding = { adapter: ChartAdapterKind; refId: string };

function parseBindingValue(binding: unknown): ChartBinding | null {
  if (typeof binding !== "object" || binding === null) return null;
  const { adapter, refId } = binding as Record<string, unknown>;
  if (typeof adapter !== "string" || !ADAPTER_KINDS.includes(adapter as ChartAdapterKind)) return null;
  if (typeof refId !== "string" || refId.length === 0) return null;
  return { adapter: adapter as ChartAdapterKind, refId };
}

export function parseChartBinding(config: unknown): ChartBinding | null {
  if (typeof config !== "object" || config === null) return null;
  return parseBindingValue((config as Record<string, unknown>).binding);
}

/** Scatter's own binding shape (#167) — independently bindable X and Y
 * axes, unlike every other chart type's single `binding`, since a
 * scatter plot has no natural date axis to hang one series off of. Either
 * axis alone can be bound while the other stays ad-hoc (a mixed chart) —
 * only when NEITHER is bound does this return null, meaning "fully
 * ad-hoc, read VisualRecords the normal way." */
export type ScatterBinding = { x: ChartBinding | null; y: ChartBinding | null };

export function parseScatterBinding(config: unknown): ScatterBinding | null {
  if (typeof config !== "object" || config === null) return null;
  const x = parseBindingValue((config as Record<string, unknown>).xBinding);
  const y = parseBindingValue((config as Record<string, unknown>).yBinding);
  return x || y ? { x, y } : null;
}

/** A Table's own binding (#169) — unlike a chart's `binding`/`xBinding`/
 * `yBinding`, which each point at one specific entity (`refId`), a bound
 * table's rows are an entire live entity list, so there's nothing to
 * pick beyond which source. */
export type TableAdapterKind = "goals" | "habits" | "tasks" | "systems";

const TABLE_ADAPTER_KINDS: TableAdapterKind[] = ["goals", "habits", "tasks", "systems"];

export type TableBinding = { adapter: TableAdapterKind };

export function parseTableBinding(config: unknown): TableBinding | null {
  if (typeof config !== "object" || config === null) return null;
  const binding = (config as Record<string, unknown>).tableBinding;
  if (typeof binding !== "object" || binding === null) return null;
  const adapter = (binding as Record<string, unknown>).adapter;
  if (typeof adapter !== "string" || !TABLE_ADAPTER_KINDS.includes(adapter as TableAdapterKind)) return null;
  return { adapter: adapter as TableAdapterKind };
}
