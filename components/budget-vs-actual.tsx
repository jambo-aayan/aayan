"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setBudget, deleteBudget } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { formatGBP } from "@/lib/finance/format";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import { RowActions } from "@/components/row-actions";
import { PiggyBank } from "lucide-react";
import styles from "./budget-vs-actual.module.css";

type BudgetStatus = {
  category: string;
  limit: number;
  spent: number;
  remaining: number;
  projected: number | null;
};

/** Budget vs. actual for the current month, surfaced on the main
 * Finances dashboard alongside the category breakdown (#123, ADR-0010).
 * Passive — no Nudge, no cron. No rollover: a category's `limit` is set
 * once and read fresh each month, never carrying an under-spent
 * leftover forward. */
export function BudgetVsActual({ initialStatuses }: { initialStatuses: BudgetStatus[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [category, setCategory] = useState("");
  const [limit, setLimit] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingCategory, setRemovingCategory] = useState<string | null>(null);

  async function handleAdd() {
    const parsedLimit = Number(limit);
    if (!category.trim() || !Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError("Enter a category and a limit above £0.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => setBudget(category.trim(), parsedLimit));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAdding(false);
    setCategory("");
    setLimit("");
    router.refresh();
  }

  async function handleRemove(cat: string) {
    setRemovingCategory(cat);
    const result = await withRetry(() => deleteBudget(cat));
    setRemovingCategory(null);
    if (result.ok) router.refresh();
  }

  return (
    <div>
      <ul className={styles.list}>
        {initialStatuses.map((s) => {
          const over = s.remaining < 0;
          const projectedOver = s.projected !== null && s.projected > s.limit;
          return (
            <li key={s.category} className={styles.row}>
              <div>
                <div className={styles.category}>{s.category}</div>
                <div className={`${styles.meta} ${over ? styles.over : ""}`}>
                  {formatGBP(s.spent)} / {formatGBP(s.limit)}
                  {over ? ` · ${formatGBP(Math.abs(s.remaining))} over` : ` · ${formatGBP(s.remaining)} left`}
                </div>
                {s.projected !== null && (
                  <div className={`${styles.meta} ${projectedOver ? styles.over : ""}`}>
                    Projected: {formatGBP(s.projected)} by month-end
                  </div>
                )}
              </div>
              <RowActions gap={8}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => handleRemove(s.category)}
                  disabled={removingCategory === s.category}
                >
                  {removingCategory === s.category ? "Removing…" : "Remove"}
                </button>
              </RowActions>
            </li>
          );
        })}
      </ul>
      {initialStatuses.length === 0 && !adding && (
        <EmptyState icon={PiggyBank} message="No budgets set yet." />
      )}

      {adding ? (
        <div className={styles.addForm}>
          <input
            className={styles.input}
            list="budget-categories"
            placeholder="Category"
            aria-label="Category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <datalist id="budget-categories">
            {DEFAULT_CATEGORIES.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          <input
            className={styles.input}
            type="number"
            step="0.01"
            placeholder="Monthly limit"
            aria-label="Monthly limit"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
          />
          <PrimaryButton onClick={handleAdd} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </PrimaryButton>
          <button type="button" className={styles.link} onClick={() => setAdding(false)}>
            Cancel
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      ) : (
        <button type="button" className={styles.link} onClick={() => setAdding(true)}>
          Set a budget
        </button>
      )}
    </div>
  );
}
