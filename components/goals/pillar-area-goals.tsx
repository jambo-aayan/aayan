"use client";

import { useState } from "react";
import Link from "next/link";
import { Flag } from "lucide-react";
import { createGoal, setGoalStatus } from "@/lib/goals/actions";
import type { LifeGoalStatus, LifeGoalWithRelations } from "@/lib/goals/data";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { EmptyState } from "@/components/empty-state";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./pillar-area-goals.module.css";

const STATUS_LABEL: Record<LifeGoalStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", COMPLETED: "Completed", ARCHIVED: "Archived" };
const STATUS_ORDER: LifeGoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

/** The Goals section on a generic Pillar/Area page (#158/ADR-0016) —
 * scoped read-and-status-toggle, not the full drilldown browser
 * components/goals/goal-manager.tsx is (that component reads its own
 * pillarId/areaId from URL searchParams to drive breadcrumb navigation
 * across the flat /goals page, which doesn't fit embedding inside this
 * page's own /[pillarId]/[areaId] URL). pillarId/areaId are already known
 * from the page this renders on, so — unlike GoalManager's create form —
 * there's no picker, matching the same "just its row + a name" minimalism
 * as Pillar/Area creation. Full editing (name, moving Pillar/Area) still
 * happens on the goal's own /goals/[id] detail page, linked from each row. */
export function PillarAreaGoals({
  pillarId,
  areaId,
  initialGoals,
}: {
  pillarId: string;
  areaId: string | null;
  initialGoals: LifeGoalWithRelations[];
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the goal a name first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => createGoal({ name: trimmed, pillarId, areaId }));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleAdd });
      return;
    }
    setGoals((prev) => [
      ...prev,
      { id: result.id, name: trimmed, pillarId, areaId, status: "ACTIVE", habitCount: 0, openTaskCount: 0, pillarName: "", pillarColor: null, areaName: null, createdAt: new Date(), updatedAt: new Date() },
    ]);
    setName("");
    setAdding(false);
  }

  async function handleStatus(goal: LifeGoalWithRelations, status: LifeGoalStatus) {
    if (goal.status === status) return;
    const previous = goal.status;
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status } : g)));
    const result = await withRetry(() => setGoalStatus(goal.id, status));
    if (!result.ok) {
      setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, status: previous } : g)));
      notifyError(result.error, { onRetry: () => handleStatus(goal, status) });
    }
  }

  return (
    <div>
      {goals.length === 0 ? (
        <EmptyState icon={Flag} message="No goals yet." />
      ) : (
        <ul className={styles.list}>
          {goals.map((goal) => (
            <li key={goal.id} className={`${styles.row} ${goal.status !== "ACTIVE" ? styles.inactive : ""}`}>
              <Link href={`/goals/${goal.id}`} className={styles.rowMain}>
                <span className={styles.name}>{goal.name}</span>
                <span className={styles.rowMeta}>
                  {goal.habitCount} habit{goal.habitCount === 1 ? "" : "s"} · {goal.openTaskCount} open task
                  {goal.openTaskCount === 1 ? "" : "s"}
                </span>
              </Link>
              <div className={styles.statusGroup} role="group" aria-label="Status">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`${styles.statusBtn} ${goal.status === s ? styles.statusBtnActive : ""}`}
                    onClick={() => handleStatus(goal, s)}
                  >
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      {adding ? (
        <div className={styles.addForm}>
          <input
            type="text"
            className={styles.addInput}
            placeholder="Goal name"
            value={name}
            autoFocus
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAdd();
              }
              if (e.key === "Escape") {
                setAdding(false);
                setName("");
                setError(null);
              }
            }}
          />
          <PrimaryButton onClick={handleAdd} disabled={saving}>
            {saving ? "Adding…" : "Add"}
          </PrimaryButton>
        </div>
      ) : (
        <button type="button" className={styles.addTrigger} onClick={() => setAdding(true)}>
          + New goal
        </button>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
