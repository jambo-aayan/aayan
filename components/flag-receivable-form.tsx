"use client";

import { useState } from "react";
import { flagAsReceivable } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./flag-receivable-form.module.css";

/** "Flag as receivable"'s amount/note/confirm form — shared by
 * TransactionsManager and UncategorisedQueue (#114/#117, ADR-0010) so the
 * two call sites of flagAsReceivable can't drift out of sync with its
 * signature. */
export function FlagReceivableForm({
  transactionId,
  initialAmount,
  onCancel,
  onConfirmed,
}: {
  transactionId: string;
  initialAmount: number;
  onCancel: () => void;
  onConfirmed: (receivableId: string) => void;
}) {
  const [amount, setAmount] = useState(initialAmount);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const result = await withRetry(() => flagAsReceivable(transactionId, amount, note || null));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirmed(result.receivableId);
  }

  return (
    <div className={styles.form}>
      <input
        className={styles.input}
        type="number"
        step="0.01"
        placeholder="Amount"
        aria-label="Receivable amount"
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
      />
      <input
        className={styles.input}
        placeholder="Note (optional)"
        aria-label="Receivable note"
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
