"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resetFinanceData } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./finance-reset.module.css";

// A "use server" file (lib/finance/actions.ts) can only export async
// functions — a plain string constant there breaks the production build
// — so this lives here instead. resetFinanceData() doesn't re-verify the
// phrase itself; the confirmation is a UI-level gate, not a data-
// integrity one, so keeping the single source of truth client-side is
// fine.
const RESET_FINANCE_DATA_CONFIRMATION = "DELETE";

/** Wipes all transaction data — Transactions, Snapshots, Transfers,
 * Receivables, GoalContributions, and Statements — keeping Accounts,
 * Goals, Habits, and Categories intact (#154, ADR-0015). The first
 * genuinely destructive, irreversible action in this app, so it's gated
 * by typing a confirmation phrase rather than a click-through "Are you
 * sure?" dialog — cheap insurance against a stray click deleting your
 * entire financial history, for an action rare enough that the extra
 * friction doesn't matter. */
export function FinanceReset() {
  const router = useRouter();
  const { notifyError } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canReset = confirmText === RESET_FINANCE_DATA_CONFIRMATION;

  async function handleReset() {
    if (!canReset) return;
    setResetting(true);
    setError(null);
    const result = await withRetry(() => resetFinanceData());
    setResetting(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleReset });
      return;
    }
    setConfirmText("");
    setDone(true);
    router.refresh();
  }

  return (
    <div className={styles.zone}>
      <p className={styles.warning}>
        Permanently deletes every Transaction, balance Snapshot, Transfer, Receivable, and Goal
        contribution, and every uploaded Statement. Accounts, Goals, Habits, and Categories are kept —
        you&rsquo;ll re-upload your statements into the same structure. This can&rsquo;t be undone.
      </p>
      <label className={styles.confirmLabel}>
        Type <strong>{RESET_FINANCE_DATA_CONFIRMATION}</strong> to confirm
        <input
          className={styles.confirmInput}
          value={confirmText}
          onChange={(e) => {
            setConfirmText(e.target.value);
            setDone(false);
            setError(null);
          }}
          aria-label={`Type ${RESET_FINANCE_DATA_CONFIRMATION} to confirm`}
          autoComplete="off"
        />
      </label>
      <button type="button" className={styles.resetButton} onClick={handleReset} disabled={!canReset || resetting}>
        {resetting ? "Resetting…" : "Reset all transaction data"}
      </button>
      {done && <p className={styles.done}>Done — every account is now transaction-free, ready for a fresh upload.</p>}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
