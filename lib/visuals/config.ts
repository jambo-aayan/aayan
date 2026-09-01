/** Visual.config is untyped Json at the schema level (#161/#162) — these
 * narrow it per chart type that actually needs config, rather than
 * trusting a cast at every read site. Pure — no Prisma/React. */

export type ProgressBarConfig = { target: number };

export function parseProgressBarConfig(config: unknown): ProgressBarConfig | null {
  if (typeof config !== "object" || config === null) return null;
  const target = (config as Record<string, unknown>).target;
  return typeof target === "number" && Number.isFinite(target) ? { target } : null;
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
