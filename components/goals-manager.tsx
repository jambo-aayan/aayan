"use client";

import { useState } from "react";
import { createGoal, deleteGoal, restoreGoal, updateGoal, type GoalInput } from "@/lib/finance/actions";
import { useUndoableCrudList } from "@/lib/hooks/use-undoable-crud-list";
import { goalProgressPercent, projectedCompletionDate, totalMonthlyContributions, isOvercommitted } from "@/lib/finance/goal-math";
import styles from "./goals-manager.module.css";

type Goal = GoalInput & { id: string };

const EMPTY_FORM: GoalInput = { name: "", target: 0, saved: 0, monthlyContribution: 0 };

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function GoalsManager({ initialGoals, surplus }: { initialGoals: Goal[]; surplus: number }) {
  const { items: goals, error, undo, add, update, remove, undoDelete } = useUndoableCrudList<Goal, GoalInput>(
    initialGoals,
    {
      create: async (input) => {
        const result = await createGoal(input);
        return result.ok ? { ok: true, item: result.goal } : result;
      },
      update: updateGoal,
      remove: deleteGoal,
      restore: restoreGoal,
    }
  );
  const [form, setForm] = useState<GoalInput>(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const overcommitted = isOvercommitted(totalMonthlyContributions(goals), surplus);

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
              onSaved={async (input) => {
                const ok = await update(goal.id, input, { ...input, id: goal.id });
                if (ok) setEditingId(null);
                return ok;
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

function GoalFields({ form, onChange }: { form: GoalInput; onChange: (update: GoalInput) => void }) {
  return (
    <>
      <input
        className={styles.input}
        placeholder="Name"
        aria-label="Goal name"
        value={form.name}
        onChange={(e) => onChange({ ...form, name: e.target.value })}
      />
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Target"
        aria-label="Target amount"
        value={form.target}
        onChange={(e) => onChange({ ...form, target: Number(e.target.value) })}
      />
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Saved"
        aria-label="Amount saved so far"
        value={form.saved}
        onChange={(e) => onChange({ ...form, saved: Number(e.target.value) })}
      />
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Monthly contribution"
        aria-label="Monthly contribution"
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
  onSaved: (input: GoalInput) => Promise<boolean>;
}) {
  const [form, setForm] = useState<GoalInput>(goal);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSaved(form);
    setSaving(false);
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
    </li>
  );
}
