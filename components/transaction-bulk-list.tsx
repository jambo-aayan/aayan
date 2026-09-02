"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  deleteTransactions,
  getMatchingTransactionIds,
  restoreDeletedTransactions,
  type BulkDeleteTransactionsResult,
} from "@/lib/finance/actions";
import type { TransactionFilters } from "@/lib/finance/transaction-query";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { formatGBP } from "@/lib/finance/format";
import styles from "@/app/(protected)/(shell)/finances/transactions/transactions.module.css";

export type TransactionListRow = {
  id: string;
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  source: string | null;
  category: string;
  accountName: string | null;
};

export type StatementGroup = { id: string; name: string; accountName: string; transactions: TransactionListRow[] };

type Result =
  | { mode: "flat"; transactions: TransactionListRow[]; total: number }
  | { mode: "byStatement"; statements: StatementGroup[] };

const UNDO_WINDOW_MS = 5000;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

// Module-level, not a closure inside TransactionBulkList — keeping it
// there would redefine the component type on every render, discarding
// React's reconciliation identity for every row each time selection
// state changes.
function Row({ t, checked, onToggle }: { t: TransactionListRow; checked: boolean; onToggle: () => void }) {
  return (
    <li className={styles.row}>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          aria-label={`Select ${t.category}${t.source ? ` · ${t.source}` : ""}`}
          checked={checked}
          onChange={onToggle}
        />
      </label>
      <div className={styles.info}>
        <div className={styles.category}>
          {t.category}
          {t.source && <span className={styles.source}> · {t.source}</span>}
        </div>
        <div className={styles.date}>
          {formatDate(t.date)}
          {t.accountName && ` · ${t.accountName}`}
        </div>
      </div>
      <span className={t.direction === "IN" ? styles.amtPos : styles.amtNeutral}>
        {t.direction === "IN" ? "+" : "−"}
        {formatGBP(t.amount)}
      </span>
    </li>
  );
}

/** The full transaction browser's list body, with checkbox multi-select
 * and a per-statement "select all" shortcut (#151, ADR-0015). Both feed
 * the same "Delete selected" action — one underlying bulk delete, two
 * ways to populate the selection. Deleted rows disappear immediately;
 * "Delete selected" is itself the destructive click (no extra confirm
 * step, matching this app's existing single-row delete-with-undo
 * pattern rather than a modal), with a real undo available for 5s.
 *
 * Deliberately doesn't reuse lib/hooks/use-undoable-crud-list.ts — that
 * hook's `undo` state holds exactly one item (`T | null`), matching every
 * other Finance CRUD list's one-row-at-a-time delete; this needs to hold
 * an array (every deleted transaction plus any cascaded snapshot from
 * one bulk action), which doesn't fit its generic without changing the
 * hook's shape for every other caller. Same visual pattern regardless
 * (a 5s toast, an Undo button) — a small, purpose-built equivalent
 * rather than a forced generalization of the shared hook. */
export function TransactionBulkList({ result, filters }: { result: Result; filters: TransactionFilters }) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [selectingAll, setSelectingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<(BulkDeleteTransactionsResult & { ok: true }) | undefined>(undefined);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const allRows = result.mode === "flat" ? result.transactions : result.statements.flatMap((s) => s.transactions);
  const visibleRows = allRows.filter((t) => !hiddenIds.has(t.id));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleStatement(group: StatementGroup) {
    const ids = group.transactions.map((t) => t.id).filter((id) => !hiddenIds.has(id));
    const allSelected = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }

  // The count "Select all N matching filters" promises: byStatement mode
  // already has every matching row loaded client-side (no new fetch
  // needed), while flat mode is paginated — its count/fetch both go
  // through the server, since only one page of rows is ever on the page.
  const matchingCount = result.mode === "flat" ? result.total : visibleRows.length;
  const allMatchingSelected = matchingCount > 0 && selected.size >= matchingCount;

  async function handleSelectAllMatching() {
    if (result.mode === "byStatement") {
      setSelected(new Set(visibleRows.map((t) => t.id)));
      return;
    }
    setSelectingAll(true);
    const ids = await getMatchingTransactionIds(filters);
    setSelectingAll(false);
    setSelected(new Set(ids));
  }

  async function handleDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setDeleting(true);
    setError(null);
    const deleteResult = await withRetry(() => deleteTransactions(ids));
    setDeleting(false);
    if (!deleteResult.ok) {
      setError(deleteResult.error);
      notifyError(deleteResult.error, { onRetry: handleDelete });
      return;
    }
    setHiddenIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    setSelected(new Set());
    if (undoTimer.current) clearTimeout(undoTimer.current);
    setUndoState(deleteResult);
    undoTimer.current = setTimeout(() => setUndoState(undefined), UNDO_WINDOW_MS);
  }

  async function handleUndo() {
    if (!undoState) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const { deleted, deletedSnapshots } = undoState;
    setUndoState(undefined);
    const restoreResult = await withRetry(() => restoreDeletedTransactions(deleted, deletedSnapshots));
    if (!restoreResult.ok) {
      notifyError(restoreResult.error, { onRetry: handleUndo });
      return;
    }
    // hiddenIds is local state that outlives the router.refresh() below —
    // the server re-supplies the restored rows in `result`, but without
    // this they'd stay filtered out of `visibleRows` until a full reload.
    const restoredIds = new Set(deleted.map((t) => t.id));
    setHiddenIds((prev) => new Set([...prev].filter((id) => !restoredIds.has(id))));
    router.refresh();
  }

  return (
    <div>
      {visibleRows.length > 0 && (
        <div className={styles.bulkBar}>
          {selected.size > 0 && <span>{selected.size} selected</span>}
          {!allMatchingSelected && (
            <button type="button" className={styles.bulkClear} onClick={handleSelectAllMatching} disabled={selectingAll}>
              {selectingAll ? "Selecting…" : `Select all ${matchingCount} matching filters`}
            </button>
          )}
          {selected.size > 0 && (
            <>
              <button type="button" className={styles.bulkDelete} onClick={handleDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete selected"}
              </button>
              <button type="button" className={styles.bulkClear} onClick={() => setSelected(new Set())}>
                Clear
              </button>
            </>
          )}
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}

      {result.mode === "byStatement" ? (
        <div className={styles.statementGroups}>
          {result.statements.map((s) => {
            const visible = s.transactions.filter((t) => !hiddenIds.has(t.id));
            if (visible.length === 0) return null;
            const allSelected = visible.every((t) => selected.has(t.id));
            return (
              <details key={s.id} className={styles.statementGroup} open>
                <summary className={styles.statementHead}>
                  <span className={styles.selectAllStatement}>
                    <input
                      type="checkbox"
                      aria-label={`Select all transactions in ${s.name}`}
                      checked={allSelected}
                      // stopPropagation, not preventDefault: this must stop
                      // the click from reaching <summary> (which would
                      // toggle the details open/closed) without also
                      // suppressing the checkbox's own native check/uncheck
                      // — preventDefault here would do both, since a
                      // checkbox's default action IS toggling .checked,
                      // and React's onChange never fires without it.
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => toggleStatement(s)}
                    />
                  </span>
                  {s.name} <span className={styles.statementMeta}>· {s.accountName} · {visible.length} transactions</span>
                </summary>
                <ul className={styles.list}>
                  {visible.map((t) => (
                    <Row key={t.id} t={t} checked={selected.has(t.id)} onToggle={() => toggle(t.id)} />
                  ))}
                </ul>
              </details>
            );
          })}
          {visibleRows.length === 0 && <p className={styles.muted}>No transactions match these filters.</p>}
        </div>
      ) : (
        <ul className={styles.list}>
          {visibleRows.map((t) => (
            <Row key={t.id} t={t} checked={selected.has(t.id)} onToggle={() => toggle(t.id)} />
          ))}
          {visibleRows.length === 0 && <li className={styles.muted}>No transactions match these filters.</li>}
        </ul>
      )}

      {undoState && (
        <div className={styles.undoToast}>
          <span>
            Deleted {undoState.deleted.length} transaction{undoState.deleted.length === 1 ? "" : "s"}
            {undoState.deletedSnapshots.length > 0 ? " and its balance snapshot" : ""}.
          </span>
          <button type="button" className={styles.undoBtn} onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
