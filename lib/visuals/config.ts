/** Visual.config is untyped Json at the schema level (#161/#162) — these
 * narrow it per chart type that actually needs config, rather than
 * trusting a cast at every read site. Pure — no Prisma/React. */

export type ProgressBarConfig = { target: number };

export function parseProgressBarConfig(config: unknown): ProgressBarConfig | null {
  if (typeof config !== "object" || config === null) return null;
  const target = (config as Record<string, unknown>).target;
  return typeof target === "number" && Number.isFinite(target) ? { target } : null;
}
