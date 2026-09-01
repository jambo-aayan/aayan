"use client";

import { useEffect, useRef, useState } from "react";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { VisualCard } from "./visual-card";
import { AddTableColumnForm } from "./add-table-column-form";
import { TableCell } from "./table-cell";
import { readCells, stripCell, withCell } from "@/lib/visuals/table-data";
import { isBuiltInColumnId } from "@/lib/visuals/table-binding";
import { parseTableBinding } from "@/lib/visuals/config";
import {
  createTableColumn,
  createTableRow,
  deleteTableColumn,
  deleteTableRow,
  restoreTableColumn,
  restoreTableRow,
  updateTableCell,
  type RemovedCell,
} from "@/lib/visuals/table-actions";
import type { VisualWithRecords } from "@/lib/visuals/actions";
import type { TableColumn, TableColumnType, TableRow } from "@/lib/generated/prisma/client";
import cardStyles from "./visual-card.module.css";
import styles from "./table-visual.module.css";

const UNDO_WINDOW_MS = 5000;

/** `TableRow.data` is Prisma's untyped `JsonValue` — narrowed to a plain
 * object everywhere client-side state actually touches it (table-data.ts's
 * readCells/stripCell/withCell already return exactly this shape), so
 * local state doesn't need a cast at every read/write site. */
type TableRowState = Omit<TableRow, "data"> & { data: Record<string, unknown> };

function toRowState(row: TableRow): TableRowState {
  return { ...row, data: readCells(row.data) };
}

/** Read-only display for a built-in column's value — plain text, no
 * input, since these are never user-editable (lib/visuals/
 * table-binding.ts resolves them fresh from the live entity on every
 * render). */
function formatBuiltInValue(type: TableColumnType, value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (type === "CHECKBOX") return value === true ? "Yes" : "No";
  return String(value);
}

/** Renders one Table Visual — freeform (#168) or bound to a live entity
 * list (#169, ADR-0017). Columns/rows are plain local state rather than
 * two separate useUndoableCrudList instances, since deleting/restoring a
 * column also mutates every row's `data` (lib/visuals/table-data.ts's
 * stripCell/withCell) and the shared hook has no way to carry that extra
 * per-row-value payload through its own generic remove/restore shape.
 * Columns and rows each get their own 5s undo toast, same window as
 * useUndoableCrudList's.
 *
 * A bound table's `columns`/`rows` are resolve-table-binding.ts's live
 * view — built-in columns (lib/visuals/table-binding.ts's
 * isBuiltInColumnId, a colon in the id) render read-only and can't be
 * removed or added to via "+ Row" (there's no such trigger at all for a
 * bound table); only "+ Column" for custom columns still applies, same
 * create/remove/undo path as freeform. Since the row set itself is
 * server-computed from live entities, a fresh `visual` (an entity added/
 * removed elsewhere) needs to actually reach this already-mounted
 * component's local state rather than staying pinned to its mount-time
 * snapshot — table-zone.tsx keys a bound TableVisual by a fingerprint of
 * its rows/columns instead of just `visual.id`, so React remounts this
 * component fresh (and its useState below re-reads the new `visual`)
 * exactly when the live data actually changed, without an effect
 * fighting React's own "don't setState from a prop in an effect"
 * guidance. A freeform table doesn't need this — a stale prop can't
 * happen for it, its only data source *is* this component's own
 * actions. */
export function TableVisual({
  visual,
  pillarId,
  areaId,
  onRemove,
}: {
  visual: VisualWithRecords;
  pillarId: string;
  areaId: string | null;
  onRemove: () => void;
}) {
  const { notifyError } = useToast();
  const bound = parseTableBinding(visual.config) !== null;
  const [columns, setColumns] = useState<TableColumn[]>(visual.columns);
  const [rows, setRows] = useState<TableRowState[]>(() => visual.rows.map(toRowState));
  const [columnUndo, setColumnUndo] = useState<{ column: TableColumn; removed: RemovedCell[] } | null>(null);
  const [rowUndo, setRowUndo] = useState<TableRowState | null>(null);
  const columnUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rowUndoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same cleanup useUndoableCrudList's own undo timer gets — without it, a
  // column/row removed right before this component unmounts (navigating
  // away mid-undo-window) leaves the timeout armed to call setColumnUndo/
  // setRowUndo after unmount.
  useEffect(() => {
    return () => {
      if (columnUndoTimer.current) clearTimeout(columnUndoTimer.current);
      if (rowUndoTimer.current) clearTimeout(rowUndoTimer.current);
    };
  }, []);

  async function handleAddColumn(name: string, type: TableColumnType) {
    const result = await withRetry(() => createTableColumn(visual.id, pillarId, areaId, name, type, columns.length));
    if (!result.ok) {
      notifyError(result.error);
      return { ok: false, error: result.error };
    }
    setColumns((prev) => [...prev, result.column]);
    return { ok: true };
  }

  async function handleRemoveColumn(column: TableColumn) {
    setColumns((prev) => prev.filter((c) => c.id !== column.id));
    const result = await withRetry(() => deleteTableColumn(visual.id, pillarId, areaId, column.id));
    if (!result.ok) {
      setColumns((prev) => [...prev, column]);
      notifyError(result.error);
      return;
    }
    setRows((prev) => prev.map((r) => ({ ...r, data: stripCell(r.data, column.id) })));
    setColumnUndo({ column, removed: result.removed });
    if (columnUndoTimer.current) clearTimeout(columnUndoTimer.current);
    columnUndoTimer.current = setTimeout(() => setColumnUndo(null), UNDO_WINDOW_MS);
  }

  async function handleUndoColumn() {
    if (!columnUndo) return;
    if (columnUndoTimer.current) clearTimeout(columnUndoTimer.current);
    const { column, removed } = columnUndo;
    setColumnUndo(null);
    const result = await withRetry(() => restoreTableColumn(column, removed, pillarId, areaId));
    if (!result.ok) {
      notifyError(result.error);
      return;
    }
    // Re-sorted by sortOrder rather than appended — the restored column
    // reappears at its original position instead of jumping to the end.
    setColumns((prev) => [...prev, column].sort((a, b) => a.sortOrder - b.sortOrder));
    setRows((prev) =>
      prev.map((r) => {
        const match = removed.find((x) => x.rowId === r.id);
        return match ? { ...r, data: withCell(r.data, column.id, match.value) } : r;
      })
    );
  }

  async function handleAddRow() {
    const result = await withRetry(() => createTableRow(visual.id, pillarId, areaId, rows.length));
    if (!result.ok) {
      notifyError(result.error);
      return;
    }
    setRows((prev) => [...prev, toRowState(result.row)]);
  }

  async function handleRemoveRow(row: TableRowState) {
    setRows((prev) => prev.filter((r) => r.id !== row.id));
    const result = await withRetry(() => deleteTableRow(visual.id, pillarId, areaId, row.id));
    if (!result.ok) {
      setRows((prev) => [...prev, row]);
      notifyError(result.error);
      return;
    }
    setRowUndo(row);
    if (rowUndoTimer.current) clearTimeout(rowUndoTimer.current);
    rowUndoTimer.current = setTimeout(() => setRowUndo(null), UNDO_WINDOW_MS);
  }

  async function handleUndoRow() {
    if (!rowUndo) return;
    if (rowUndoTimer.current) clearTimeout(rowUndoTimer.current);
    const row = rowUndo;
    setRowUndo(null);
    const result = await withRetry(() => restoreTableRow(row, pillarId, areaId));
    if (!result.ok) {
      notifyError(result.error);
      return;
    }
    // Same reasoning as handleUndoColumn — restored to its original
    // position, not appended to the end.
    setRows((prev) => [...prev, row].sort((a, b) => a.sortOrder - b.sortOrder));
  }

  // A bound row's id can start as resolve-table-binding.ts's synthetic
  // `bound-row-*` placeholder and become a real cuid the first time
  // updateTableCell lazily creates its backing TableRow — boundEntityId
  // stays stable across that swap (a freeform row has none, so its own
  // real id is the stable key instead), so matching by it here means the
  // id swap doesn't need special-casing.
  function rowKey(row: TableRowState) {
    return row.boundEntityId ?? row.id;
  }

  async function handleCellChange(row: TableRowState, columnId: string, value: unknown) {
    const key = rowKey(row);
    const prevData = row.data;
    setRows((prev) => prev.map((r) => (rowKey(r) === key ? { ...r, data: withCell(r.data, columnId, value) } : r)));
    const result = await withRetry(() =>
      updateTableCell(row.id, row.boundEntityId, visual.id, pillarId, areaId, columnId, value)
    );
    if (!result.ok) {
      setRows((prev) => (prev.some((r) => rowKey(r) === key) ? prev.map((r) => (rowKey(r) === key ? { ...r, data: prevData } : r)) : prev));
      notifyError(result.error);
      return;
    }
    setRows((prev) => prev.map((r) => (rowKey(r) === key ? { ...r, id: result.row.id } : r)));
  }

  return (
    <VisualCard title={visual.title} onRemove={onRemove}>
      {columns.length === 0 ? (
        <p className={cardStyles.empty}>No columns yet.</p>
      ) : (
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={column.id} className={styles.th}>
                    <span>{column.name}</span>
                    {!isBuiltInColumnId(column.id) && (
                      <button
                        type="button"
                        className={styles.removeColumnBtn}
                        onClick={() => handleRemoveColumn(column)}
                        aria-label={`Remove column ${column.name}`}
                      >
                        ×
                      </button>
                    )}
                  </th>
                ))}
                {!bound && <th className={styles.th} />}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyRowsCell} colSpan={columns.length + (bound ? 0 : 1)}>
                    No rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cells = readCells(row.data);
                  return (
                    <tr key={rowKey(row)}>
                      {columns.map((column) =>
                        isBuiltInColumnId(column.id) ? (
                          <td key={`${rowKey(row)}:${column.id}`} className={styles.td}>
                            <span className={styles.builtInCell}>{formatBuiltInValue(column.type, cells[column.id])}</span>
                          </td>
                        ) : (
                          <td
                            key={
                              // CHECKBOX has no draft-buffer state to keep in
                              // sync with an outside value change (it commits
                              // immediately, see table-cell.tsx) — no need to
                              // force a remount on every toggle for it.
                              column.type === "CHECKBOX"
                                ? `${rowKey(row)}:${column.id}`
                                : `${rowKey(row)}:${column.id}:${String(cells[column.id])}`
                            }
                            className={styles.td}
                          >
                            <TableCell
                              type={column.type}
                              value={cells[column.id]}
                              onChange={(value) => handleCellChange(row, column.id, value)}
                            />
                          </td>
                        )
                      )}
                      {!bound && (
                        <td className={styles.td}>
                          <button
                            type="button"
                            className={styles.removeColumnBtn}
                            onClick={() => handleRemoveRow(row)}
                            aria-label="Remove row"
                          >
                            ×
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className={styles.tableActions}>
        <AddTableColumnForm onAdd={handleAddColumn} />
        {!bound && columns.length > 0 && (
          <button type="button" className={styles.trigger} onClick={handleAddRow}>
            + Row
          </button>
        )}
      </div>

      {columnUndo && (
        <div className={styles.undoToast}>
          <span>Removed column &ldquo;{columnUndo.column.name}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={handleUndoColumn}>
            Undo
          </button>
        </div>
      )}
      {rowUndo && (
        <div className={styles.undoToast}>
          <span>Removed row.</span>
          <button type="button" className={styles.undoBtn} onClick={handleUndoRow}>
            Undo
          </button>
        </div>
      )}
    </VisualCard>
  );
}
