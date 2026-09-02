"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";
import { isValidIsoDateString } from "./date-validation";
import type { ChartAdapterKind } from "./config";
import type { Prisma, VisualType } from "@/lib/generated/prisma/client";

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateVisualPaths(pillarId: string, areaId: string | null) {
  const href = areaId ? `${pillarHref(pillarId)}/${areaId}` : pillarHref(pillarId);
  revalidatePath(href);
}

/** Matches getVisualsForPillar/getVisualsForArea's `include: { records,
 * columns, rows }` shape exactly, so the same type flows from the initial
 * page fetch through useUndoableCrudList's local state without a cast —
 * `columns`/`rows` (#168) are always empty for a chart type, only a Table
 * ever populates them. */
export type VisualWithRecords = Prisma.VisualGetPayload<{ include: { records: true; columns: true; rows: true } }>;

export type CreateVisualResult = { ok: true; visual: VisualWithRecords } | { ok: false; error: string };

/** Creates an ad-hoc (unbound) chart, or a freeform Table (#168) — a bound
 * chart's config is set by #166, not here. `config` is empty for every
 * type except Progress bar, which needs its ad-hoc target set at creation
 * time (there's nothing else to derive "current vs. target" from until
 * it's bound to a Goal in #166). `records`/`columns`/`rows: []` on the
 * return value matches VisualWithRecords's shape so callers (ChartZone/
 * TableZone's useUndoableCrudList) can hold it without a refetch. */
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
    return { ok: true, visual: { ...visual, records: [], columns: [], rows: [] } };
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

/** Undo for deleteVisual — VisualRecord/TableColumn/TableRow all
 * cascade-delete with their Visual, so restoring means recreating all of
 * them with their original ids in one transaction, same "recreate with
 * original ids" approach as Finance's restoreDeletedTransactions (#151,
 * ADR-0015). resolve-binding.ts's synthetic, never-persisted records (a
 * fully-bound chart's #166 single binding, or Scatter's #167 fully- or
 * mixed-bound axes) all carry a `bound-${visualId}-${i}` id rather than a
 * real cuid — replaying one of those as a real VisualRecord would
 * permanently defeat the point of binding, so they're filtered out here
 * by id shape rather than replayed. A mixed-binding Scatter's real,
 * still-persisted manual-axis rows (kept alongside the synthetic ones in
 * `visual.records`, see resolve-binding.ts) have ordinary cuids and pass
 * straight through — they're genuinely gone once the cascade-delete
 * happens, same as any other real VisualRecord, so undo needs to recreate
 * them for real. A Table's columns/rows (#168) are never synthetic —
 * every one gets replayed as-is. */
export async function restoreVisual(visual: VisualWithRecords): Promise<ActionResult> {
  const realRecords = visual.records.filter((r) => !r.id.startsWith("bound-"));
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
      ...realRecords.map((r) =>
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
      ...visual.columns.map((c) =>
        prisma.tableColumn.create({
          data: { id: c.id, visualId: c.visualId, name: c.name, type: c.type, sortOrder: c.sortOrder },
        })
      ),
      ...visual.rows.map((r) =>
        prisma.tableRow.create({
          data: {
            id: r.id,
            visualId: r.visualId,
            boundEntityId: r.boundEntityId,
            data: r.data ?? {},
            sortOrder: r.sortOrder,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
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

/** Home's "Log today" widget (#170) — upserts by date rather than always
 * creating, the same "entering a second value the same day updates
 * rather than duplicates" shape lib/metrics/actions.ts's logMetricEntry
 * uses for its own DAILY/WEEKLY-cadence upsert (#184). Unlike
 * logMetricEntry, there's no DB uniqueness on (visualId, date) backing
 * this — a chart's regular "Add
 * data" form and bulk CSV import both intentionally allow multiple
 * records on the same date already (#163/#165), so this only upserts at
 * the app level, matching whatever single record (if any) this widget
 * itself finds for today; it never touches a second same-day record a
 * different flow might have created. `date` is the caller's own
 * client-computed "today" (lib/local-date.ts's todayLocalDateString),
 * same reasoning ThoughtQuickAdd already applies — never server-computed,
 * to avoid a timezone mismatch between what the user sees as "today" and
 * what gets stored. */
export async function logTodayValue(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  date: string,
  value: number
): Promise<CreateVisualRecordResult> {
  if (!isValidIsoDateString(date)) return { ok: false, error: "Enter a valid date." };
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid number." };
  try {
    const day = new Date(`${date}T00:00:00.000Z`);
    const existing = await prisma.visualRecord.findFirst({ where: { visualId, date: day } });
    const record = existing
      ? await prisma.visualRecord.update({ where: { id: existing.id }, data: { yValue: value } })
      : await prisma.visualRecord.create({ data: { visualId, date: day, yValue: value } });
    revalidateVisualPaths(pillarId, areaId);
    revalidatePath("/today");
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
    case "category-spend": {
      // Category isn't Pillar/Area-owned either — lists every category,
      // top-level and leaf alike, app-wide, same as Goal/Account above. A
      // leaf's name is prefixed with its parent's so "General" (Shopping)
      // and "General" (Travel) read as distinct options.
      const categories = await prisma.category.findMany({
        select: { id: true, name: true, parent: { select: { name: true } } },
        orderBy: [{ parent: { name: "asc" } }, { name: "asc" }],
      });
      return categories.map((c) => ({ id: c.id, name: c.parent ? `${c.parent.name}: ${c.name}` : c.name }));
    }
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

/** A mixed-binding Scatter's manual-axis data point (#167) — only the
 * un-bound axis's value gets a form at all (the bound axis reads live
 * data, nothing to type in for it), so this stores just that one field,
 * unlike createVisualXYRecord's pair. resolve-binding.ts's
 * manualAxisValues reads these back in createdAt order to pair them by
 * index against the bound series (lib/visuals/adapters.ts's
 * joinBoundWithManual — no date on these rows to join by instead). */
export async function createVisualAxisRecord(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  axis: "x" | "y",
  value: number,
  note?: string
): Promise<CreateVisualRecordResult> {
  if (!Number.isFinite(value)) return { ok: false, error: "Enter a valid number." };
  try {
    const record = await prisma.visualRecord.create({
      data: {
        visualId,
        xValue: axis === "x" ? value : null,
        yValue: axis === "y" ? value : null,
        note: note?.trim() || null,
      },
    });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, record };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}
