import { useEffect, useRef, useState } from "react";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";

export type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult<T> = { ok: true; item: T } | { ok: false; error: string };

export type CrudActions<T, Input> = {
  create: (input: Input) => Promise<CreateResult<T>>;
  /** Optional — a caller with no edit UI (e.g. a chart/table Visual, which
   * has nothing to rename yet) can omit this; `update` below then rejects
   * rather than silently no-opping, so a caller can't accidentally call it. */
  update?: (id: string, input: Input) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
  restore: (item: T) => Promise<ActionResult>;
};

const UNDO_WINDOW_MS = 5000;

/**
 * The add/edit/delete-with-undo-toast shape shared by every Finance CRUD
 * list (Items, Goals, Transactions) — extracted once a third occurrence
 * showed up (a prior code review recommended waiting for exactly this).
 * Each caller still owns its own form fields; this only owns list state,
 * the optimistic-update-with-rollback logic, and the undo timer.
 */
export function useUndoableCrudList<T extends { id: string }, Input>(
  initialItems: T[],
  actions: CrudActions<T, Input>
) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [undo, setUndo] = useState<T | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { notifyError } = useToast();

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  async function add(input: Input): Promise<boolean> {
    setError(null);
    const result = await withRetry(() => actions.create(input));
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: () => add(input) });
      return false;
    }
    setItems((prev) => [...prev, result.item]);
    return true;
  }

  // Returns the full result (not just a boolean) so a caller mid-edit can
  // show the error next to the row being edited, not just in the shared
  // list-level `error` below — a save failure on row 8 of 20 shouldn't
  // only be visible scrolled away from the row still open in edit mode.
  async function update(id: string, input: Input, merged: T): Promise<ActionResult> {
    if (!actions.update) return { ok: false, error: "This list doesn't support editing." };
    const result = await withRetry(() => actions.update!(id, input));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => update(id, input, merged) });
      return result;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? merged : i)));
    return result;
  }

  async function remove(item: T) {
    setError(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const result = await withRetry(() => actions.remove(item.id));
    if (!result.ok) {
      setItems((prev) => [...prev, item]);
      setError(result.error);
      notifyError(result.error, { onRetry: () => remove(item) });
      return;
    }
    setUndo(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
  }

  // Shared by the initial undo click and by the toast's manual "Retry" once
  // the undo window has already closed — both need the same restore +
  // setItems behavior, not just the bare action call.
  async function restore(item: T) {
    const result = await withRetry(() => actions.restore(item));
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: () => restore(item) });
      return;
    }
    setItems((prev) => [...prev, item]);
  }

  async function undoDelete() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const item = undo;
    setUndo(null);
    await restore(item);
  }

  // Exposed for a caller that needs to reflect a change to one item's own
  // nested data (e.g. a chart Visual gaining a new ad-hoc record) whose
  // server call already happened separately, outside this hook's
  // create/update/remove actions — setItems avoids a redundant second
  // server round-trip through `update` just to sync local state.
  return { items, setItems, error, undo, add, update, remove, undoDelete };
}
