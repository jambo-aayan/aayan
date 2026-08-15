import { useEffect, useRef, useState } from "react";

export type ActionResult = { ok: true } | { ok: false; error: string };
type CreateResult<T> = { ok: true; item: T } | { ok: false; error: string };

export type CrudActions<T, Input> = {
  create: (input: Input) => Promise<CreateResult<T>>;
  update: (id: string, input: Input) => Promise<ActionResult>;
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

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  async function add(input: Input): Promise<boolean> {
    setError(null);
    const result = await actions.create(input);
    if (!result.ok) {
      setError(result.error);
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
    const result = await actions.update(id, input);
    if (!result.ok) return result;
    setItems((prev) => prev.map((i) => (i.id === id ? merged : i)));
    return result;
  }

  async function remove(item: T) {
    setError(null);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    const result = await actions.remove(item.id);
    if (!result.ok) {
      setItems((prev) => [...prev, item]);
      setError(result.error);
      return;
    }
    setUndo(item);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
  }

  async function undoDelete() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const item = undo;
    setUndo(null);
    const result = await actions.restore(item);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setItems((prev) => [...prev, item]);
  }

  return { items, error, undo, add, update, remove, undoDelete };
}
