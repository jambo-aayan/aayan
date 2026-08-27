"use client";

import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { resolveHeldTransaction, type TransactionInput } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import { FlagReceivableForm } from "@/components/flag-receivable-form";
import styles from "./uncategorised-queue.module.css";

type HeldTransaction = TransactionInput & { id: string; accountName: string | null };

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The low-confidence transactions statement parsing held back (#115),
 * made actionable: correct their fields (which clears confidence and
 * drops them from this list) or flag them as a receivable, reusing #114's
 * action unchanged (#117, ADR-0010). */
export function UncategorisedQueue({ initialTransactions }: { initialTransactions: HeldTransaction[] }) {
  const [transactions, setTransactions] = useState(initialTransactions);

  function handleResolved(id: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div>
      <ul className={styles.list}>
        {transactions.map((t) => (
          <QueueRow key={t.id} transaction={t} onResolved={() => handleResolved(t.id)} />
        ))}
      </ul>
      {transactions.length === 0 && (
        <EmptyState icon={CheckCircle2} message="Nothing held for review." />
      )}
    </div>
  );
}

function QueueRow({ transaction, onResolved }: { transaction: HeldTransaction; onResolved: () => void }) {
  const [form, setForm] = useState<TransactionInput>(transaction);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flagging, setFlagging] = useState(false);

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
          <button type="button" className={styles.link} onClick={() => setFlagging(true)}>
            Flag as receivable
          </button>
        )}
      </div>
      {error && <p className={styles.error}>{error}</p>}

      {flagging && (
        <FlagReceivableForm
          transactionId={transaction.id}
          initialAmount={transaction.amount}
          onCancel={() => setFlagging(false)}
          onConfirmed={onResolved}
        />
      )}
    </li>
  );
}
