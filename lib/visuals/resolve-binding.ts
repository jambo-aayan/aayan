import "server-only";
import { prisma } from "@/lib/prisma";
import {
  balancePoints,
  checkinPoints,
  evaluationPoints,
  goalProgressPoints,
  joinBoundWithManual,
  joinPointsByDate,
  type SyntheticPoint,
  type XYPoint,
} from "./adapters";
import { parseChartBinding, parseScatterBinding, type ChartAdapterKind } from "./config";
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

function toXYRecords(visualId: string, points: XYPoint[]): SyntheticRecord[] {
  return points.map((p, i) => ({
    id: `bound-${visualId}-${i}`,
    visualId,
    date: null,
    xValue: p.x,
    yValue: p.y,
    xLabel: null,
    note: null,
    createdAt: new Date(),
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

/** Scatter's mixed-binding case (#167, matching ADR-0017's "separately
 * ad-hoc or bound" design) — one axis bound to a live source, the other
 * still ad-hoc. The manual axis's values come straight off the Visual's
 * own persisted VisualRecords (only that axis's field was ever populated
 * for them, per createVisualAxisRecord), oldest first, then
 * joinBoundWithManual pairs them by index against the bound series. */
function manualAxisValues(records: VisualWithRecords["records"], axis: "x" | "y"): number[] {
  return [...records]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((r) => (axis === "x" ? r.xValue : r.yValue))
    .filter((v): v is number => v !== null);
}

async function resolveScatterBinding(visual: VisualWithRecords): Promise<VisualWithRecords> {
  const scatterBinding = parseScatterBinding(visual.config);
  if (!scatterBinding) return visual;
  const { x, y } = scatterBinding;

  if (x && y) {
    const [xResolved, yResolved] = await Promise.all([resolvePoints(x.adapter, x.refId), resolvePoints(y.adapter, y.refId)]);
    if (!xResolved || !yResolved) return { ...visual, records: [] };
    return { ...visual, records: toXYRecords(visual.id, joinPointsByDate(xResolved.points, yResolved.points)) };
  }

  // Mixed binding: one axis bound, one still ad-hoc. The plotted points
  // are synthetic joined pairs (appended below), but `visual.records`
  // itself — the real, still-persisted manual-axis rows — is kept
  // alongside them rather than replaced, so restoreVisual's undo can
  // still recreate real data if this chart gets deleted right after
  // (scatterPoints only ever reads a record with both xValue and yValue
  // set, so a manual-only row with just one field never renders as a
  // stray point — it's inert for display, present only for undo).
  if (x) {
    const xResolved = await resolvePoints(x.adapter, x.refId);
    if (!xResolved) return visual;
    const pairs = joinBoundWithManual(xResolved.points, manualAxisValues(visual.records, "y"));
    return {
      ...visual,
      records: [...visual.records, ...toXYRecords(visual.id, pairs.map((p) => ({ x: p.bound, y: p.manual })))],
    };
  }

  // y is guaranteed non-null here — parseScatterBinding only returns a
  // non-null result when at least one axis is bound.
  const yResolved = await resolvePoints(y!.adapter, y!.refId);
  if (!yResolved) return visual;
  const pairs = joinBoundWithManual(yResolved.points, manualAxisValues(visual.records, "x"));
  return {
    ...visual,
    records: [...visual.records, ...toXYRecords(visual.id, pairs.map((p) => ({ x: p.manual, y: p.bound })))],
  };
}

/** Resolves one Visual's records — an unbound (ad-hoc) Visual passes
 * through untouched; a bound one gets its `records` replaced with
 * synthetic, never-persisted rows built from its live source data, and
 * (for a Goal-bound Progress bar) its `config.target` merged in from the
 * Goal. Every chart-rendering component already reads off `visual.records`
 * and `visual.config` directly, so nothing downstream needs to know
 * whether a chart is bound or ad-hoc except the "hide the entry
 * controls" check (lib/visuals/config.ts's parseChartBinding/
 * parseScatterBinding). Scatter (#167) is its own branch — it binds one
 * or two independent sources (one per axis) rather than a single shared
 * one, so it's resolved via resolveScatterBinding instead of the
 * single-source path every other bindable chart type uses. */
export async function resolveVisualBinding(visual: VisualWithRecords): Promise<VisualWithRecords> {
  if (visual.type === "SCATTER") return resolveScatterBinding(visual);

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
