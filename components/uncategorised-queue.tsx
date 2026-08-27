"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { resolveHeldTransaction, type TransactionInput } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import { FlagReceivableForm } from "@/components/flag-receivable-form";
import { FlagGoalContributionForm, type GoalOption } from "@/components/flag-goal-contribution-form";
import styles from "./uncategorised-queue.module.css";

type HeldTransaction = TransactionInput & { id: string; accountName: string | null };

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The low-confidence transactions statement parsing held back (#115),
 * made actionable: correct their fields (which clears confidence and
 * drops them from this list) or flag them as a receivable/goal
 * contribution, reusing #114/#120's actions unchanged (#117, ADR-0010). */
export function UncategorisedQueue({
  initialTransactions,
  goals,
}: {
  initialTransactions: HeldTransaction[];
  goals: GoalOption[];
}) {
  const [transactions, setTransactions] = useState(initialTransactions);

  function handleResolved(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <ul className={styles.list}>
        {transactions.map((t) => (
          <QueueRow key={t.id} transaction={t} goals={goals} onResolved={() => handleResolved(t.id)} />
        ))}
      </ul>
      {transactions.length === 0 && (
        <EmptyState icon={CheckCircle2} message="Nothing held for review." />
      )}
    </div>
  );
}

function QueueRow({
  transaction,
  goals,
  onResolved,
}: {
  transaction: HeldTransaction;
  goals: GoalOption[];
  onResolved: () => void;
}) {
  const [form, setForm] = useState<TransactionInput>(transaction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState<"receivable" | "goal" | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await withRetry(() => resolveHeldTransaction(transaction.id, form));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onResolved();
  }

  return (
    <li className={styles.row}>
      <div className={styles.form}>
        <input
          className={styles.input}
          type="date"
          aria-label="Date"
          value={toDateInputValue(form.date)}
          onChange={(e) => setForm({ ...form, date: new Date(`${e.target.value}T00:00:00.000Z`) })}
        />
        <input
          className={styles.input}
          type="number"
          step="0.01"
          aria-label="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
        />
        <input
          className={styles.input}
          list="finance-categories"
          placeholder="Category"
          aria-label="Category"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <datalist id="finance-categories">
          {DEFAULT_CATEGORIES.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <span className={styles.meta}>
          {transaction.accountName ?? "No account"}
          {transaction.source && ` · ${transaction.source}`}
        </span>
        <PrimaryButton onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Confirm"}
        </PrimaryButton>
        {!flagging && transaction.direction === "OUT" && (
          <>
            <button type="button" className={styles.link} onClick={() => setFlagging("receivable")}>
              Flag as receivable
            </button>
            {goals.length > 0 && (
              <button type="button" className={styles.link} onClick={() => setFlagging("goal")}>
                Flag as goal contribution
              </button>
            )}
          </>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}

      {flagging === "receivable" && (
        <FlagReceivableForm
          transactionId={transaction.id}
          initialAmount={transaction.amount}
          onCancel={() => setFlagging(null)}
          onConfirmed={onResolved}
        />
      )}
      {flagging === "goal" && (
        <FlagGoalContributionForm
          transactionId={transaction.id}
          initialAmount={transaction.amount}
          goals={goals}
          onCancel={() => setFlagging(null)}
          onConfirmed={onResolved}
        />
      )}
    </li>
  );
}
