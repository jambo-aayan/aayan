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

export function parseChartBinding(config: unknown): ChartBinding | null {
  if (typeof config !== "object" || config === null) return null;
  const binding = (config as Record<string, unknown>).binding;
  if (typeof binding !== "object" || binding === null) return null;
  const { adapter, refId } = binding as Record<string, unknown>;
  if (typeof adapter !== "string" || !ADAPTER_KINDS.includes(adapter as ChartAdapterKind)) return null;
  if (typeof refId !== "string" || refId.length === 0) return null;
  return { adapter: adapter as ChartAdapterKind, refId };
}
