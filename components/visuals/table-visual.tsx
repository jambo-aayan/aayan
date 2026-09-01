"use client";

import { useEffect, useRef, useState } from "react";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { VisualCard } from "./visual-card";
import { AddTableColumnForm } from "./add-table-column-form";
import { TableCell } from "./table-cell";
import { readCells, stripCell, withCell } from "@/lib/visuals/table-data";
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

/** Renders one freeform Table Visual (#168, ADR-0017) — its own
 * columns/rows CRUD, kept as plain local state rather than two separate
 * useUndoableCrudList instances, since deleting/restoring a column also
 * mutates every row's `data` (lib/visuals/table-data.ts's stripCell/
 * withCell) and the shared hook has no way to carry that extra
 * per-row-value payload through its own generic remove/restore shape.
 * Columns and rows each get their own 5s undo toast, same window as
 * useUndoableCrudList's. */
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

  async function handleCellChange(row: TableRowState, columnId: string, value: unknown) {
    const prevData = row.data;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, data: withCell(r.data, columnId, value) } : r)));
    const result = await withRetry(() => updateTableCell(row.id, pillarId, areaId, columnId, value));
    if (!result.ok) {
      setRows((prev) => (prev.some((r) => r.id === row.id) ? prev.map((r) => (r.id === row.id ? { ...r, data: prevData } : r)) : prev));
      notifyError(result.error);
    }
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
                    <button
                      type="button"
                      className={styles.removeColumnBtn}
                      onClick={() => handleRemoveColumn(column)}
                      aria-label={`Remove column ${column.name}`}
                    >
                      ×
                    </button>
                  </th>
                ))}
                <th className={styles.th} />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className={styles.emptyRowsCell} colSpan={columns.length + 1}>
                    No rows yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const cells = readCells(row.data);
                  return (
                    <tr key={row.id}>
                      {columns.map((column) => (
                        <td
                          key={
                            // CHECKBOX has no draft-buffer state to keep in
                            // sync with an outside value change (it commits
                            // immediately, see table-cell.tsx) — no need to
                            // force a remount on every toggle for it.
                            column.type === "CHECKBOX"
                              ? `${row.id}:${column.id}`
                              : `${row.id}:${column.id}:${String(cells[column.id])}`
                          }
                          className={styles.td}
                        >
                          <TableCell
                            type={column.type}
                            value={cells[column.id]}
                            onChange={(value) => handleCellChange(row, column.id, value)}
                          />
                        </td>
                      ))}
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
        {columns.length > 0 && (
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
