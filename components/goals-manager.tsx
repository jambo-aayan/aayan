"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag } from "lucide-react";
import {
  createGoal,
  deleteGoal,
  logGoalContribution,
  restoreGoal,
  updateGoal,
  type GoalInput,
} from "@/lib/finance/actions";
import { useUndoableCrudList, type ActionResult } from "@/lib/hooks/use-undoable-crud-list";
import { goalProgressPercent, projectedCompletionDate, totalMonthlyContributions, isOvercommitted } from "@/lib/finance/goal-math";
import { sortGoalsByPriority } from "@/lib/finance/logic";
import { withRetry } from "@/lib/with-retry";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import styles from "./goals-manager.module.css";

type ContributionCandidate = { id: string; date: Date; amount: number; category: string };

type Goal = GoalInput & { id: string };

const VEHICLE_LABEL: Record<GoalInput["vehicle"], string> = {
  EMERGENCY_FUND: "Emergency Fund",
  LISA: "LISA",
  PENSION: "Pension",
  STOCKS_ISA: "Stocks & Shares ISA",
  CASH_ISA: "Cash ISA",
  GENERIC: "Generic",
};

const EMPTY_FORM: GoalInput = { name: "", target: 0, saved: 0, monthlyContribution: 0, vehicle: "GENERIC", priority: 0 };

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export function GoalsManager({
  initialGoals,
  surplus,
  contributionCandidates,
}: {
  initialGoals: Goal[];
  surplus: number;
  contributionCandidates: ContributionCandidate[];
}) {
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
  const sortedGoals = sortGoalsByPriority(goals);

  async function handleAdd() {
    if (!form.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError(null);
    const ok = await add({ ...form, priority: goals.length });
    setAdding(false);
    if (ok) setForm(EMPTY_FORM);
  }

  /** Moves a goal up/down in the priority order and renumbers the whole
   * sorted list sequentially (0, 1, 2, …) rather than just swapping two
   * values — pre-existing goals can share the same default priority, and
   * swapping equal values would be a no-op, so the move would silently
   * do nothing. Renumbering the full list makes every move deterministic
   * regardless of the starting values. Priority is an explicit,
   * user-editable rank, not implied by vehicle type (ADR-0010). */
  async function handleMove(goal: Goal, direction: -1 | 1) {
    const index = sortedGoals.findIndex((g) => g.id === goal.id);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= sortedGoals.length) return;
    const reordered = [...sortedGoals];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    // Sequential, not Promise.all: stops at the first failure rather than
    // racing several in-flight writes with no rollback if one fails
    // partway — update() already retries and surfaces a toast on error,
    // so stopping early keeps the blast radius to "reorder didn't finish"
    // rather than an unpredictable partial renumbering.
    for (const [i, g] of reordered.entries()) {
      const result = await update(g.id, { ...g, priority: i }, { ...g, priority: i });
      if (!result.ok) break;
    }
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
        {sortedGoals.map((goal, index) =>
          editingId === goal.id ? (
            <GoalEditRow
              key={goal.id}
              goal={goal}
              onCancel={() => setEditingId(null)}
              onSaved={async (input) => {
                const result = await update(goal.id, input, { ...input, id: goal.id });
                if (result.ok) setEditingId(null);
                return result;
              }}
            />
          ) : (
            <li key={goal.id} className={styles.row}>
              <div className={styles.info}>
                <div className={styles.name}>
                  {index + 1}. {goal.name} <span className={styles.meta}>({VEHICLE_LABEL[goal.vehicle]})</span>
                </div>
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
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => handleMove(goal, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${goal.name} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => handleMove(goal, 1)}
                  disabled={index === sortedGoals.length - 1}
                  aria-label={`Move ${goal.name} down`}
                >
                  ↓
                </button>
                <LogContributionControl goalId={goal.id} candidates={contributionCandidates} />
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
      </ul>
      {goals.length === 0 && <EmptyState icon={Flag} message="No goals yet." />}
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.addForm}>
        <GoalFields form={form} onChange={setForm} />
        <PrimaryButton onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add goal"}
        </PrimaryButton>
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
  showSaved = true,
}: {
  form: GoalInput;
  onChange: (update: GoalInput) => void;
  /** "Starting saved" only applies at creation — an existing goal's saved
   * total comes from its contribution log (via "Log contribution"
   * below), so editing the goal's own fields never shows it (matching
   * AccountFields' showValue). */
  showSaved?: boolean;
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
        aria-label="Vehicle"
        value={form.vehicle}
        onChange={(e) => onChange({ ...form, vehicle: e.target.value as GoalInput["vehicle"] })}
      >
        {Object.entries(VEHICLE_LABEL).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Target"
        aria-label="Target amount"
        value={form.target}
        onChange={(e) => onChange({ ...form, target: Number(e.target.value) })}
      />
      {showSaved && (
        <input
          className={styles.input}
          type="number"
          step="0.01"
          placeholder="Starting saved"
          aria-label="Starting saved amount"
          value={form.saved}
          onChange={(e) => onChange({ ...form, saved: Number(e.target.value) })}
        />
      )}
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
  onSaved: (input: GoalInput) => Promise<ActionResult>;
}) {
  const [form, setForm] = useState<GoalInput>(goal);
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
      <GoalFields form={form} onChange={setForm} showSaved={false} />
      <PrimaryButton onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </PrimaryButton>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </li>
  );
}

/** A Goal's saved total comes from its own dated contribution log, not a
 * field on the goal itself — this logs a new one rather than editing the
 * goal's own row (#120, ADR-0010), same shape as AddSnapshotControl.
 * Optionally links an existing transaction as the funding record. */
function LogContributionControl({
  goalId,
  candidates,
}: {
  goalId: string;
  candidates: { id: string; date: Date; amount: number; category: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [transactionId, setTransactionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount)) {
      setError("Enter a number.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() =>
      logGoalContribution(goalId, new Date(), parsedAmount, note || null, transactionId || null)
    );
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setAmount("");
    setNote("");
    setTransactionId("");
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className={styles.link} onClick={() => setOpen(true)}>
        Log contribution
      </button>
    );
  }

  return (
    <span className={styles.snapshotForm}>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Amount"
        aria-label="Contribution amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      <input
        className={styles.input}
        placeholder="Note (optional)"
        aria-label="Contribution note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <select
        className={styles.input}
        aria-label="Link a transaction (optional)"
        value={transactionId}
        onChange={(e) => setTransactionId(e.target.value)}
      >
        <option value="">No linked transaction</option>
        {candidates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.category} · {formatGBP(t.amount)}
          </option>
        ))}
      </select>
      <button type="button" className={styles.link} onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
      <button type="button" className={styles.link} onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </span>
  );
}
