"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGoal,
  deleteGoal,
  restoreGoal,
  updateGoal,
  type GoalInput,
} from "@/lib/finance/actions";
import { goalProgressPercent, projectedCompletionDate, totalMonthlyContributions, isOvercommitted } from "@/lib/finance/goal-math";
import styles from "./goals-manager.module.css";

type Goal = GoalInput & { id: string };

const UNDO_WINDOW_MS = 5000;
const EMPTY_FORM: GoalInput = { name: "", target: 0, saved: 0, monthlyContribution: 0 };

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function GoalsManager({ initialGoals, surplus }: { initialGoals: Goal[]; surplus: number }) {
  const [goals, setGoals] = useState(initialGoals);
  const [form, setForm] = useState<GoalInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [undo, setUndo] = useState<Goal | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimer.current) clearTimeout(undoTimer.current);
    };
  }, []);

  const overcommitted = isOvercommitted(totalMonthlyContributions(goals), surplus);

  async function handleAdd() {
    if (!form.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const result = await createGoal(form);
    setAdding(false);
    if (!result.ok) {
      setAddError(result.error);
      return;
    }
    setGoals((prev) => [...prev, result.goal]);
    setForm(EMPTY_FORM);
  }

  async function handleDelete(goal: Goal) {
    setListError(null);
    setGoals((prev) => prev.filter((g) => g.id !== goal.id));
    const result = await deleteGoal(goal.id);
    if (!result.ok) {
      setGoals((prev) => [...prev, goal]);
      setListError(result.error);
      return;
    }
    setUndo(goal);
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_WINDOW_MS);
  }

  async function handleUndo() {
    if (!undo) return;
    if (undoTimer.current) clearTimeout(undoTimer.current);
    const goal = undo;
    setUndo(null);
    const result = await restoreGoal(goal);
    if (!result.ok) {
      setListError(result.error);
      return;
    }
    setGoals((prev) => [...prev, goal]);
  }

  return (
    <div>
      {overcommitted && (
        <p className={styles.warning}>
          Committed monthly contributions ({formatGBP(totalMonthlyContributions(goals))}) exceed your
          Baseline surplus ({formatGBP(surplus)}).
        </p>
      )}

      <ul className={styles.list}>
        {goals.map((goal) =>
          editingId === goal.id ? (
            <GoalEditRow
              key={goal.id}
              goal={goal}
              onCancel={() => setEditingId(null)}
              onSaved={(updated) => {
                setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
                setEditingId(null);
              }}
            />
          ) : (
            <li key={goal.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.name}>{goal.name}</div>
                <div className={styles.bar}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${goalProgressPercent(goal.saved, goal.target)}%` }}
                  />
                </div>
                <div className={styles.meta}>
                  {formatGBP(goal.saved)} / {formatGBP(goal.target)} ·{" "}
                  {(() => {
                    const completion = projectedCompletionDate(
                      goal.saved,
                      goal.target,
                      goal.monthlyContribution,
                      new Date()
                    );
                    return completion ? `projected ${formatDate(completion)}` : "no projection yet";
                  })()}
                </div>
              </div>
              <div className={styles.rowActions}>
                <button type="button" className={styles.link} onClick={() => setEditingId(goal.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => handleDelete(goal)}>
                  Delete
                </button>
              </div>
            </li>
          )
        )}
        {goals.length === 0 && <li className={styles.empty}>No goals yet.</li>}
      </ul>
      {listError && <p className={styles.error}>{listError}</p>}

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
          <button type="button" className={styles.undoBtn} onClick={handleUndo}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}

function GoalFields({ form, onChange }: { form: GoalInput; onChange: (update: GoalInput) => void }) {
  return (
    <>
      <input
        className={styles.input}
        placeholder="Name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Target"
        value={form.target}
        onChange={(e) => onChange({ ...form, target: Number(e.target.value) })}
      />
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Saved"
        value={form.saved}
        onChange={(e) => onChange({ ...form, saved: Number(e.target.value) })}
      />
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Monthly contribution"
        value={form.monthlyContribution}
        onChange={(e) => onChange({ ...form, monthlyContribution: Number(e.target.value) })}
      />
    </>
  );
}

function GoalEditRow({
  goal,
  onCancel,
  onSaved,
}: {
  goal: Goal;
  onCancel: () => void;
  onSaved: (goal: Goal) => void;
}) {
  const [form, setForm] = useState<GoalInput>(goal);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await updateGoal(goal.id, form);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved({ ...form, id: goal.id });
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
