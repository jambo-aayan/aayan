"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { pillarHref } from "@/lib/pillars/nav";
import { readCells, stripCell, withCell } from "./table-data";
import type { Prisma, TableColumn, TableColumnType, TableRow } from "@/lib/generated/prisma/client";

/** Freeform Table column/row management (#168, ADR-0017) — separate from
 * lib/visuals/actions.ts's chart-focused Visual/VisualRecord actions
 * since a Table's own child models (TableColumn/TableRow) have nothing to
 * do with charts. Follows the same undo-with-original-ids pattern as
 * restoreVisual throughout. */

export type ActionResult = { ok: true } | { ok: false; error: string };

function revalidateVisualPaths(pillarId: string, areaId: string | null) {
  const href = areaId ? `${pillarHref(pillarId)}/${areaId}` : pillarHref(pillarId);
  revalidatePath(href);
}

export type CreateColumnResult = { ok: true; column: TableColumn } | { ok: false; error: string };

export async function createTableColumn(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  name: string,
  type: TableColumnType,
  sortOrder: number
): Promise<CreateColumnResult> {
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the column a name first." };
  try {
    const column = await prisma.tableColumn.create({ data: { visualId, name: trimmed, type, sortOrder } });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, column };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}

export type RemovedCell = { rowId: string; value: unknown };
export type DeleteColumnResult = { ok: true; removed: RemovedCell[] } | { ok: false; error: string };

/** Deletes a column and strips its key out of every row's `data` — "removing
 * a column removes that data from every row" per #168's acceptance
 * criteria, not just hiding a now-unused key. Captures each row's removed
 * value first so the caller can hold it for undo (restoreTableColumn). */
export async function deleteTableColumn(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  columnId: string
): Promise<DeleteColumnResult> {
  try {
    const rows = await prisma.tableRow.findMany({ where: { visualId }, select: { id: true, data: true } });
    const removed: RemovedCell[] = [];
    const updates = rows.flatMap((r) => {
      const cells = readCells(r.data);
      if (!(columnId in cells)) return [];
      removed.push({ rowId: r.id, value: cells[columnId] });
      return [
        prisma.tableRow.update({ where: { id: r.id }, data: { data: stripCell(r.data, columnId) as Prisma.InputJsonValue } }),
      ];
    });
    await prisma.$transaction([prisma.tableColumn.delete({ where: { id: columnId } }), ...updates]);
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, removed };
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
}

/** Undo for deleteTableColumn — recreates the column with its original id
 * and sortOrder, then reinjects each row's removed value. A row deleted
 * during the undo window is simply skipped (nothing left to reinject
 * into), same "best effort, not a hard dependency" stance as everywhere
 * else undo touches related rows. */
export async function restoreTableColumn(
  column: TableColumn,
  removed: RemovedCell[],
  pillarId: string,
  areaId: string | null
): Promise<ActionResult> {
  try {
    const rows = await prisma.tableRow.findMany({
      where: { id: { in: removed.map((r) => r.rowId) } },
      select: { id: true, data: true },
    });
    const dataByRowId = new Map(rows.map((r) => [r.id, r.data]));
    await prisma.$transaction([
      prisma.tableColumn.create({
        data: { id: column.id, visualId: column.visualId, name: column.name, type: column.type, sortOrder: column.sortOrder },
      }),
      ...removed
        .filter((r) => dataByRowId.has(r.rowId))
        .map((r) =>
          prisma.tableRow.update({
            where: { id: r.rowId },
            data: { data: withCell(dataByRowId.get(r.rowId), column.id, r.value) as Prisma.InputJsonValue },
          })
        ),
    ]);
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true };
  } catch {
    return { ok: false, error: "Couldn't restore — try again." };
  }
}

export type CreateRowResult = { ok: true; row: TableRow } | { ok: false; error: string };

export async function createTableRow(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  sortOrder: number
): Promise<CreateRowResult> {
  try {
    const row = await prisma.tableRow.create({ data: { visualId, data: {}, sortOrder } });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, row };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}

export async function deleteTableRow(
  visualId: string,
  pillarId: string,
  areaId: string | null,
  rowId: string
): Promise<ActionResult> {
  try {
    await prisma.tableRow.delete({ where: { id: rowId } });
  } catch {
    return { ok: false, error: "Couldn't delete — try again." };
  }
  revalidateVisualPaths(pillarId, areaId);
  return { ok: true };
}

/** Undo for deleteTableRow — recreates the row with its original id and
 * data, same "recreate with original ids" approach as restoreVisual.
 * Takes `data: unknown` rather than TableRow's own JsonValue-typed field
 * so a caller holding TableCell's client-side Record<string, unknown>
 * shape (lib/visuals/table-data.ts) can pass it straight through without
 * a cast of its own. */
export async function restoreTableRow(
  row: Omit<TableRow, "data"> & { data: unknown },
  pillarId: string,
  areaId: string | null
): Promise<ActionResult> {
  try {
    await prisma.tableRow.create({
      data: {
        id: row.id,
        visualId: row.visualId,
        boundEntityId: row.boundEntityId,
        data: (row.data ?? {}) as Prisma.InputJsonValue,
        sortOrder: row.sortOrder,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch {
    return { ok: false, error: "Couldn't restore — try again." };
  }
  revalidateVisualPaths(pillarId, areaId);
  return { ok: true };
}

export type UpdateCellResult = { ok: true; row: TableRow } | { ok: false; error: string };

/** One inline cell edit — read-modify-write, since Prisma's Json field has
 * no partial-update operator. `value` is already the type-coerced JS
 * value the caller's input produced (string/number/boolean/ISO date
 * string per the column's type); this layer doesn't re-validate it
 * against the column's declared type, same "the UI only offers the right
 * input for the type" trust the rest of this app places in its own
 * forms.
 *
 * `boundEntityId` is only ever non-null for a bound table's row (#169) —
 * such a row often has no real TableRow yet (built-in columns render
 * straight off the live entity, nothing to persist for those), so `rowId`
 * may be resolve-table-binding.ts's synthetic `bound-row-*` placeholder
 * rather than a real id. The first time a custom-column value is entered
 * for that entity, this creates the backing TableRow lazily via `upsert`
 * keyed on the schema's `@@unique([visualId, boundEntityId])` — atomic,
 * so two concurrent first-edits for the same entity can't each create a
 * duplicate row (a plain find-then-create here would race). */
export async function updateTableCell(
  rowId: string,
  boundEntityId: string | null,
  visualId: string,
  pillarId: string,
  areaId: string | null,
  columnId: string,
  value: unknown
): Promise<UpdateCellResult> {
  try {
    let existing = await prisma.tableRow.findUnique({ where: { id: rowId }, select: { id: true, data: true } });
    if (!existing && boundEntityId) {
      existing = await prisma.tableRow.upsert({
        where: { visualId_boundEntityId: { visualId, boundEntityId } },
        update: {},
        create: { visualId, boundEntityId, data: {} },
        select: { id: true, data: true },
      });
    }
    if (!existing) return { ok: false, error: "Couldn't save — try again." };
    const row = await prisma.tableRow.update({
      where: { id: existing.id },
      data: { data: withCell(existing.data, columnId, value) as Prisma.InputJsonValue },
    });
    revalidateVisualPaths(pillarId, areaId);
    return { ok: true, row };
  } catch {
    return { ok: false, error: "Couldn't save — try again." };
  }
}
