"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";
import { isValidIsoDateString } from "./date-validation";
import { parseChartBinding, type ChartAdapterKind } from "./config";
import type { Prisma, VisualType } from "@/lib/generated/prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateVisualPaths(pillarId: string, areaId: string | null) {
  const href = areaId ? `${pillarHref(pillarId)}/${areaId}` : pillarHref(pillarId);
  revalidatePath(href);
}

/** Matches getVisualsForPillar/getVisualsForArea's `include: { records }`
 * shape exactly, so the same type flows from the initial page fetch
 * through useUndoableCrudList's local state without a cast. */
export type VisualWithRecords = Prisma.VisualGetPayload<{ include: { records: true } }>;

export type CreateVisualResult = { ok: true; visual: VisualWithRecords } | { ok: false; error: string };

/** Creates an ad-hoc (unbound) chart or table — a bound chart's config is
 * set by #166, not here. `config` is empty for every type except Progress
 * bar, which needs its ad-hoc target set at creation time (there's nothing
 * else to derive "current vs. target" from until it's bound to a Goal in
 * #166). `records: []` on the return value matches VisualWithRecords's
 * shape so callers (ChartZone's useUndoableCrudList) can hold it without a
 * refetch. */
export async function createVisual(
  pillarId: string,
  areaId: string | null,
  type: VisualType,
  title: string,
  config: Prisma.InputJsonValue = {}
): Promise<CreateVisualResult> {
  const trimmed = title.trim();
  if (!trimmed) return { ok: false, error: "Give it a title first." };
  try {
    const visual = await prisma.visual.create({ data: { pillarId, areaId, type, title: trimmed, config } });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, visual: { ...visual, records: [] } };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}

export async function deleteVisual(pillarId: string, areaId: string | null, id: string): Promise<ActionResult> {
  try {
    await prisma.visual.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateVisualPaths(pillarId, areaId);
  return { ok: true };
}

/** Undo for deleteVisual — VisualRecord cascade-deletes with its Visual,
 * so restoring means recreating both with their original ids in one
 * transaction, same "recreate with original ids" approach as Finance's
 * restoreDeletedTransactions (#151, ADR-0015). A bound Visual's
 * `visual.records` here are resolve-binding.ts's synthetic, never-persisted
 * rows (its `config` still carries the real `binding` pointer, so undo
 * just needs the Visual row back) — recreating those synthetic rows as
 * real VisualRecords would permanently defeat the point of binding, so
 * they're skipped rather than replayed. */
export async function restoreVisual(visual: VisualWithRecords): Promise<ActionResult> {
  const bound = parseChartBinding(visual.config) !== null;
  try {
    await prisma.$transaction([
      prisma.visual.create({
        data: {
          id: visual.id,
          pillarId: visual.pillarId,
          areaId: visual.areaId,
          type: visual.type,
          title: visual.title,
          config: visual.config ?? {},
          sortOrder: visual.sortOrder,
          createdAt: visual.createdAt,
          updatedAt: visual.updatedAt,
        },
      }),
      ...(bound
        ? []
        : visual.records.map((r) =>
            prisma.visualRecord.create({
              data: {
                id: r.id,
                visualId: r.visualId,
                date: r.date,
                xValue: r.xValue,
                yValue: r.yValue,
                xLabel: r.xLabel,
                note: r.note,
                createdAt: r.createdAt,
              },
            })
          )),
    ]);
  } catch {
    return { ok: false, error: "Couldn't restore — try again." };
  }
  revalidateVisualPaths(visual.pillarId, visual.areaId);
  return { ok: true };
}

export type CreateVisualRecordResult =
  | { ok: true; record: Awaited<ReturnType<typeof prisma.visualRecord.create>> }
  | { ok: false; error: string };

/** Adds one ad-hoc data point. `date` is a plain YYYY-MM-DD string (the
 * form field's own value, already defaulted to today by the caller) —
 * parsed here rather than trusting a client-constructed Date, same
 * boundary-validation stance as the rest of this app's date-taking
 * actions. */
export async function createVisualRecord(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  date: string,
  value: number,
  note?: string
): Promise<CreateVisualRecordResult> {
  if (!isValidIsoDateString(date)) return { ok: false, error: "Enter a valid date." };
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid number." };
  try {
    const record = await prisma.visualRecord.create({
      data: { visualId, date: new Date(`${date}T00:00:00.000Z`), yValue: value, note: note?.trim() || null },
    });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, record };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}

export type CreateVisualRecordsBulkResult =
  | { ok: true; records: Awaited<ReturnType<typeof prisma.visualRecord.createManyAndReturn>> }
  | { ok: false; error: string };

/** Inserts an already-parsed batch of ad-hoc data points in one go (#165)
 * — the paste and CSV-upload entry paths both parse client-side via
 * lib/visuals/parse-records.ts, then call this once with only the rows
 * that parsed cleanly (a malformed row is never sent here at all, it's
 * shown as a skipped-row summary before the user confirms). Still
 * re-validates every row server-side, the same boundary-validation stance
 * as createVisualRecord above — this is a server action, so a caller
 * bypassing the client parser entirely can't slip an invalid date/number
 * past it. */
export async function createVisualRecordsBulk(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  rows: { date: string; value: number; note?: string }[]
): Promise<CreateVisualRecordsBulkResult> {
  if (rows.length === 0) return { ok: false, error: "Nothing to add." };
  const invalid = rows.find((r) => !isValidIsoDateString(r.date) || !Number.isFinite(r.value));
  if (invalid) return { ok: false, error: "One or more rows has an invalid date or number." };
  try {
    const records = await prisma.visualRecord.createManyAndReturn({
      data: rows.map((r) => ({
        visualId,
        date: new Date(`${r.date}T00:00:00.000Z`),
        yValue: r.value,
        note: r.note?.trim() || null,
      })),
    });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, records };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}

export type AdapterOption = { id: string; name: string };

/** Lists the entities the add-chart modal's entity picker offers for a
 * given source once "use existing data" is chosen (#166) — one Habit/
 * System/Goal/Account per row, name only (id is the refId a binding
 * stores). Habit and System are Pillar/Area-owned models, so they're
 * scoped to the chart's own page exactly the same way
 * getVisualsForPillar/getVisualsForArea scope Visuals themselves — a
 * Habit belonging to one of the Pillar's Areas doesn't show up as
 * bindable from the Pillar page, only from that Area's own page. Goal and
 * Account aren't Pillar/Area-owned, so those two list app-wide. */
export async function getAdapterOptions(
  adapter: ChartAdapterKind,
  pillarId: string,
  areaId: string | null
): Promise<AdapterOption[]> {
  const scope = areaId ? { areaId } : { pillarId, areaId: null };
  switch (adapter) {
    case "habit-checkins":
      return prisma.habit.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" } });
    case "system-evaluations":
      return prisma.system.findMany({ where: scope, select: { id: true, name: true }, orderBy: { name: "asc" } });
    case "goal-progress":
      return prisma.goal.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    case "finance-balances":
      return prisma.account.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  }
}

/** A Scatter chart's own ad-hoc data point (#164) — xValue+yValue, no
 * date, unlike every other chart type's createVisualRecord above. */
export async function createVisualXYRecord(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  x: number,
  y: number,
  note?: string
): Promise<CreateVisualRecordResult> {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: "Enter valid numbers for both X and Y." };
  try {
    const record = await prisma.visualRecord.create({
      data: { visualId, xValue: x, yValue: y, note: note?.trim() || null },
    });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, record };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}
