"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ring } from "@/components/finance-dashboard/ring";
import { logGoalContribution } from "@/lib/finance/actions";
import { goalProgressPercent } from "@/lib/finance/goal-math";
import { VEHICLE_LABEL } from "@/lib/finance/goal-vehicle-label";
import { formatGBP } from "@/lib/finance/format";
import { withRetry } from "@/lib/with-retry";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./financial-plan-section.module.css";

type PlanGoal = {
  id: string;
  name: string;
  saved: number;
  target: number;
  vehicle: keyof typeof VEHICLE_LABEL;
};

/** Goals sorted by priority, one Ring each — no 3-goal cap, unlike the
 * dashboard's own small GoalRingsCard preview (#121, ADR-0010). Goals are
 * expected already priority-sorted (getGoals() sorts server-side), not
 * re-sorted here. */
export function GoalProgressRings({ goals }: { goals: PlanGoal[] }) {
  if (goals.length === 0) {
    return <p className={styles.muted}>No goals yet.</p>;
  }

  return (
    <div className={styles.ringGrid}>
      {goals.map((goal, index) => (
        <div key={goal.id} className={styles.ringItem}>
          <Ring
            percent={goalProgressPercent(goal.saved, goal.target)}
            size={72}
            centerLabel={`${goalProgressPercent(goal.saved, goal.target)}%`}
          />
          <div className={styles.ringName}>
            {index + 1}. {goal.name}
          </div>
          <div className={styles.ringMeta}>{VEHICLE_LABEL[goal.vehicle]}</div>
          <div className={styles.ringMeta}>
            {formatGBP(goal.saved, true)} / {formatGBP(goal.target, true)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Allocates the current Baseline surplus across goals in one pass — each
 * non-zero input logs that amount as the goal's contribution via #120,
 * not a new allocation mechanism of its own. Passive: no Nudge, no cron
 * (#121, ADR-0010) — the user opens this and acts, or doesn't. */
export function SurplusSplitCard({ goals, surplus }: { goals: PlanGoal[]; surplus: number }) {
  const router = useRouter();
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allocated = Object.values(amounts).reduce((sum, v) => sum + (Number(v) || 0), 0);

  async function handleAllocate() {
    const toAllocate = goals
      .map((g) => ({ goal: g, amount: Number(amounts[g.id] ?? 0) }))
      .filter((a) => a.amount > 0);
    if (toAllocate.length === 0) return;

    setSaving(true);
    setError(null);
    // Sequential, not Promise.all — avoids racing several in-flight
    // writes. Unlike goals-manager's handleMove (an idempotent priority
    // *set*), logGoalContribution is an additive log entry — retrying an
    // already-succeeded goal would double-log its contribution. So each
    // goal's amount is cleared from state the moment its own write
    // succeeds, not only once the whole batch finishes: a retry after a
    // partial failure only resubmits what hasn't actually landed yet.
    for (const { goal, amount } of toAllocate) {
      const result = await withRetry(() =>
        logGoalContribution(goal.id, new Date(), amount, "Surplus split", null)
      );
      if (!result.ok) {
        setError(result.error);
        setSaving(false);
        return;
      }
      setAmounts((prev) => {
        const rest = { ...prev };
        delete rest[goal.id];
        return rest;
      });
    }
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <div className={styles.surplusHead}>
        <span>Monthly surplus</span>
        <span className={styles.surplusValue}>{formatGBP(surplus)}</span>
      </div>
      <ul className={styles.list}>
        {goals.map((goal) => (
          <li key={goal.id} className={styles.row}>
            <span>{goal.name}</span>
            <input
              className={styles.input}
              type="number"
              step="0.01"
              placeholder="£0"
              aria-label={`Allocate to ${goal.name}`}
              value={amounts[goal.id] ?? ""}
              onChange={(e) => setAmounts((prev) => ({ ...prev, [goal.id]: e.target.value }))}
            />
          </li>
        ))}
      </ul>
      {goals.length === 0 && <p className={styles.muted}>No goals to allocate to yet.</p>}
      <div className={styles.surplusFoot}>
        <span className={allocated > surplus ? styles.over : styles.muted}>
          {formatGBP(allocated)} allocated of {formatGBP(surplus)}
        </span>
        <PrimaryButton onClick={handleAllocate} disabled={saving || allocated === 0}>
          {saving ? "Allocating…" : "Allocate"}
        </PrimaryButton>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
