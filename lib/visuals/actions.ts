"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";
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
 * restoreDeletedTransactions (#151, ADR-0015). */
export async function restoreVisual(visual: VisualWithRecords): Promise<ActionResult> {
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
      ...visual.records.map((r) =>
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
      ),
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
  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime())) return { ok: false, error: "Enter a valid date." };
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid number." };
  try {
    const record = await prisma.visualRecord.create({
      data: { visualId, date: parsedDate, yValue: value, note: note?.trim() || null },
    });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, record };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
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
