"use client";

import { useState } from "react";
import {
  createActionGoal,
  deleteActionGoal,
  restoreActionGoal,
  updateActionGoal,
  type ActionGoalInput,
} from "@/lib/action-goals/actions";
import { useUndoableCrudList, type ActionResult } from "@/lib/hooks/use-undoable-crud-list";
import styles from "./action-goals-list.module.css";

type ActionGoal = ActionGoalInput & { id: string; areaId: string };

const STATUS_LABEL: Record<ActionGoalInput["status"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};

const EMPTY_FORM: ActionGoalInput = { name: "", status: "NOT_STARTED", dueDate: null, myday: false };

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function ActionGoalsList({ areaId, initialGoals }: { areaId: string; initialGoals: ActionGoal[] }) {
  const { items: goals, error, undo, add, update, remove, undoDelete } = useUndoableCrudList<
    ActionGoal,
    ActionGoalInput
  >(initialGoals, {
    create: (input) => createActionGoal(areaId, input),
    update: updateActionGoal,
    remove: deleteActionGoal,
    restore: restoreActionGoal,
  });
  const [form, setForm] = useState<ActionGoalInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function handleAdd() {
    if (!form.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const ok = await add(form);
    setAdding(false);
    if (ok) setForm(EMPTY_FORM);
  }

  return (
    <div>
      <ul className={styles.list}>
        {goals.map((goal) =>
          editingId === goal.id ? (
            <GoalEditRow
              key={goal.id}
              goal={goal}
              onCancel={() => setEditingId(null)}
              onSaved={async (input) => {
                const result = await update(goal.id, input, { ...input, id: goal.id, areaId: goal.areaId });
                if (result.ok) setEditingId(null);
                return result;
              }}
            />
          ) : (
            <li key={goal.id} className={styles.row}>
              <div>
                <div className={styles.name}>{goal.name}</div>
                <div className={styles.meta}>
                  {STATUS_LABEL[goal.status]}
                  {goal.dueDate && ` · due ${formatDate(goal.dueDate)}`}
                  {goal.myday && <span className={styles.mydayBadge}>My Day</span>}
                </div>
              </div>
              <div className={styles.rowActions}>
                <button type="button" className={styles.link} onClick={() => setEditingId(goal.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => remove(goal)}>
                  Delete
                </button>
              </div>
            </li>
          )
        )}
        {goals.length === 0 && <li className={styles.empty}>No goals yet.</li>}
      </ul>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.addForm}>
        <GoalFields form={form} onChange={setForm} />
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add goal"}
        </button>
      </div>
      {addError && <p className={styles.error}>{addError}</p>}

      {undo && (
        <div className={styles.toast}>
          <span>Deleted &ldquo;{undo.name}&rdquo;.</span>
          <button type="button" className={styles.undoBtn} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function GoalFields({
  form,
  onChange,
}: {
  form: ActionGoalInput;
  onChange: (update: ActionGoalInput) => void;
}) {
  return (
    <>
      <input
        className={styles.input}
        placeholder="Name"
        aria-label="Goal name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <select
        className={styles.input}
        aria-label="Status"
        value={form.status}
        onChange={(e) => onChange({ ...form, status: e.target.value as ActionGoalInput["status"] })}
      >
        <option value="NOT_STARTED">Not started</option>
        <option value="IN_PROGRESS">In progress</option>
        <option value="DONE">Done</option>
      </select>
      <input
        className={styles.input}
        type="date"
        aria-label="Due date"
        value={toDateInputValue(form.dueDate)}
        onChange={(e) =>
          onChange({ ...form, dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00.000Z`) : null })
        }
      />
      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={form.myday}
          onChange={(e) => onChange({ ...form, myday: e.target.checked })}
        />
        My Day
      </label>
    </>
  );
}

function GoalEditRow({
  goal,
  onCancel,
  onSaved,
}: {
  goal: ActionGoal;
  onCancel: () => void;
  onSaved: (input: ActionGoalInput) => Promise<ActionResult>;
}) {
  const [form, setForm] = useState<ActionGoalInput>(goal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await onSaved(form);
    setSaving(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <li className={styles.addForm}>
      <GoalFields form={form} onChange={setForm} />
      <button type="button" className={styles.add} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}
