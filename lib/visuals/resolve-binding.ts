import "server-only";
import { prisma } from "@/lib/prisma";
import { balancePoints, checkinPoints, evaluationPoints, goalProgressPoints, type SyntheticPoint } from "./adapters";
import { parseChartBinding, type ChartAdapterKind } from "./config";
import type { VisualWithRecords } from "./actions";

type SyntheticRecord = VisualWithRecords["records"][number];

function toRecords(visualId: string, points: SyntheticPoint[]): SyntheticRecord[] {
  return points.map((p, i) => ({
    id: `bound-${visualId}-${i}`,
    visualId,
    date: p.date,
    xValue: null,
    yValue: p.value,
    xLabel: null,
    note: null,
    createdAt: p.date,
  }));
}

/** Fetches a bound chart's raw rows and runs them through the matching
 * pure transform (lib/visuals/adapters.ts) — the impure half of the
 * fetch/transform split, mirroring lib/finance/cash-flow-trend.ts's own
 * "fetch raw rows, transform via a pure function" precedent. Returns null
 * for a refId that no longer resolves (a deleted Goal, say) so the caller
 * can render an empty chart rather than throwing. `target` is only ever
 * set for goal-progress — a Progress bar bound to a Goal reads it from
 * the Goal itself, not a manually-set number. */
async function resolvePoints(
  adapter: ChartAdapterKind,
  refId: string
): Promise<{ points: SyntheticPoint[]; target?: number } | null> {
  switch (adapter) {
    case "habit-checkins": {
      const checkIns = await prisma.checkIn.findMany({ where: { habitId: refId }, select: { date: true, level: true } });
      return { points: checkinPoints(checkIns) };
    }
    case "system-evaluations": {
      const evaluations = await prisma.systemEvaluation.findMany({
        where: { systemId: refId },
        select: { date: true, effectiveness: true, consistency: true, sustainability: true },
      });
      return { points: evaluationPoints(evaluations) };
    }
    case "goal-progress": {
      const goal = await prisma.goal.findUnique({
        where: { id: refId },
        include: { contributions: { select: { date: true, amount: true } } },
      });
      if (!goal) return null;
      return {
        points: goalProgressPoints(goal.contributions.map((c) => ({ date: c.date, amount: c.amount.toNumber() }))),
        target: goal.target.toNumber(),
      };
    }
    case "finance-balances": {
      const snapshots = await prisma.snapshot.findMany({
        where: { accountId: refId },
        select: { date: true, balance: true },
        orderBy: { date: "asc" },
      });
      return { points: balancePoints(snapshots.map((s) => ({ date: s.date, balance: s.balance.toNumber() }))) };
    }
  }
}

/** Resolves one Visual's records — an unbound (ad-hoc) Visual passes
 * through untouched; a bound one gets its `records` replaced with
 * synthetic, never-persisted rows built from its live source data, and
 * (for a Goal-bound Progress bar) its `config.target` merged in from the
 * Goal. Every chart-rendering component already reads off `visual.records`
 * and `visual.config` directly, so nothing downstream needs to know
 * whether a chart is bound or ad-hoc except the "hide the entry
 * controls" check (lib/visuals/config.ts's parseChartBinding). */
export async function resolveVisualBinding(visual: VisualWithRecords): Promise<VisualWithRecords> {
  const binding = parseChartBinding(visual.config);
  if (!binding) return visual;

  const resolved = await resolvePoints(binding.adapter, binding.refId);
  if (!resolved) return { ...visual, records: [] };

  const records = toRecords(visual.id, resolved.points);
  const config =
    resolved.target !== undefined
      ? { ...(typeof visual.config === "object" && visual.config !== null ? visual.config : {}), target: resolved.target }
      : visual.config;
  return { ...visual, records, config };
}

export async function resolveVisualBindings(visuals: VisualWithRecords[]): Promise<VisualWithRecords[]> {
  return Promise.all(visuals.map(resolveVisualBinding));
}
