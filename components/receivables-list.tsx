"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { settleReceivable } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { EmptyState } from "@/components/empty-state";
import { RowActions } from "@/components/row-actions";
import styles from "./receivables-list.module.css";

type Receivable = {
  id: string;
  amount: number;
  status: "OPEN" | "SETTLED";
  note: string | null;
  openedAt: Date;
};

type RepaymentCandidate = { id: string; date: Date; amount: number; category: string };

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/** Money owed to the user (e.g. a loan to a friend) — flagged from a
 * Transaction via "Flag as receivable" (#114, ADR-0010). Settling is its
 * own action, independent of finding a matching incoming transaction, but
 * one can optionally be linked as the repayment record. Either way,
 * settling causes no net-worth change. */
export function ReceivablesList({
  initialReceivables,
  repaymentCandidates,
}: {
  initialReceivables: Receivable[];
  repaymentCandidates: RepaymentCandidate[];
}) {
  const [receivables, setReceivables] = useState(initialReceivables);
  const [linkedTxn, setLinkedTxn] = useState<Record<string, string>>({});
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSettle(id: string) {
    setSettlingId(id);
    setError(null);
    const result = await withRetry(() => settleReceivable(id, linkedTxn[id] ?? null));
    setSettlingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReceivables((prev) => prev.map((r) => (r.id === id ? { ...r, status: "SETTLED" } : r)));
  }

  return (
    <div>
      <ul className={styles.list}>
        {receivables.map((r) => (
          <li key={r.id} className={styles.row}>
            <div>
              <div className={styles.category}>
                {formatGBP(r.amount)}
                {r.note && <span className={styles.source}> · {r.note}</span>}
              </div>
              <div className={styles.date}>Opened {formatDate(r.openedAt)}</div>
            </div>
            <RowActions value={r.status === "SETTLED" && <span className={styles.badge}>Settled</span>}>
              {r.status !== "SETTLED" && (
                <>
                  {/* Stops the click from bubbling to RowActions'
                      close-on-select handler, so opening the dropdown
                      doesn't dismiss the menu before a value is picked. */}
                  <span onClick={(e) => e.stopPropagation()}>
                    <select
                      className={styles.select}
                      aria-label="Link repayment transaction (optional)"
                      value={linkedTxn[r.id] ?? ""}
                      onChange={(e) => setLinkedTxn((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    >
                      <option value="">No linked repayment</option>
                      {repaymentCandidates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {formatDate(t.date)} · {t.category} · {formatGBP(t.amount)}
                        </option>
                      ))}
                    </select>
                  </span>
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => handleSettle(r.id)}
                    disabled={settlingId === r.id}
                  >
                    {settlingId === r.id ? "Settling…" : "Settle"}
                  </button>
                </>
              )}
            </RowActions>
          </li>
        ))}
      </ul>
      {receivables.length === 0 && <EmptyState icon={HandCoins} message="No receivables yet." />}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
