"use client";

import { useState } from "react";
import { flagAsGoalContribution } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./flag-receivable-form.module.css";

export type GoalOption = { id: string; name: string };

/** "This went toward Goal X"'s goal-picker/amount/note/confirm form —
 * mirrors FlagReceivableForm exactly, sharing its styles, with a goal
 * `<select>` in place of a note-only form since flagAsGoalContribution
 * needs a target goal (#120, ADR-0010). */
export function FlagGoalContributionForm({
  transactionId,
  initialAmount,
  goals,
  onCancel,
  onConfirmed,
}: {
  transactionId: string;
  initialAmount: number;
  goals: GoalOption[];
  onCancel: () => void;
  onConfirmed: (contributionId: string) => void;
}) {
  const [goalId, setGoalId] = useState(goals[0]?.id ?? "");
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    if (!goalId) {
      setError("Choose a goal.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => flagAsGoalContribution(transactionId, goalId, amount, note || null));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirmed(result.contributionId);
  }

  return (
    <div className={styles.form}>
      <select className={styles.input} aria-label="Goal" value={goalId} onChange={(e) => setGoalId(e.target.value)}>
        {goals.map((g) => (
          <option key={g.id} value={g.id}>
            {g.name}
          </option>
        ))}
      </select>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Amount"
        aria-label="Contribution amount"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <input
        className={styles.input}
        placeholder="Note (optional)"
        aria-label="Contribution note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <PrimaryButton onClick={handleConfirm} disabled={saving}>
        {saving ? "Flagging…" : "Confirm"}
      </PrimaryButton>
      <button type="button" className={styles.link} onClick={onCancel}>
        Cancel
      </button>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
