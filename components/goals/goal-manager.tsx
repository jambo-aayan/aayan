"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Flag } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { createGoal, setGoalStatus } from "@/lib/goals/actions";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import type { LifeGoalWithRelations, LifeGoalStatus } from "@/lib/goals/data";
import styles from "./goal-manager.module.css";

const STATUS_LABEL: Record<LifeGoalStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", COMPLETED: "Completed", ARCHIVED: "Archived" };
const STATUS_ORDER: LifeGoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];

function groupGoals(goals: LifeGoalWithRelations[]) {
  const byPillar = new Map<string, { pillarName: string; pillarColor: string | null; byArea: Map<string, { areaName: string; goals: LifeGoalWithRelations[] }> }>();
  for (const goal of goals) {
    if (!byPillar.has(goal.pillarId)) {
      byPillar.set(goal.pillarId, { pillarName: goal.pillarName, pillarColor: goal.pillarColor, byArea: new Map() });
    }
    const pillarGroup = byPillar.get(goal.pillarId)!;
    const areaKey = goal.areaId ?? "__none__";
    if (!pillarGroup.byArea.has(areaKey)) {
      pillarGroup.byArea.set(areaKey, { areaName: goal.areaName ?? "No area", goals: [] });
    }
    pillarGroup.byArea.get(areaKey)!.goals.push(goal);
  }
  return byPillar;
}

export function GoalManager({
  goals: initialGoals,
  pillars,
  areas,
  emptyMessage,
}: {
  goals: LifeGoalWithRelations[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  emptyMessage: string;
}) {
  const [goals, setGoals] = useState(initialGoals);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [pillarId, setPillarId] = useState(pillars[0]?.id ?? "");
  const [areaId, setAreaId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the goal a name first.");
      return;
    }
    if (!pillarId) {
      setError("Choose a Pillar first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => createGoal({ name: trimmed, pillarId, areaId: areaId || null }));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setGoals((prev) => [
      ...prev,
      {
        id: result.id,
        name: trimmed,
        status: "ACTIVE",
        pillarId,
        pillarName: pillars.find((p) => p.id === pillarId)?.name ?? "",
        pillarColor: pillars.find((p) => p.id === pillarId)?.color ?? null,
        areaId: areaId || null,
        areaName: areas.find((a) => a.id === areaId)?.name ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    setName("");
    setAreaId("");
    setCreating(false);
  }

  async function handleStatus(goal: LifeGoalWithRelations, status: LifeGoalStatus) {
    if (goal.status === status) return;
    const prev = goal.status;
    setGoals((p) => p.map((g) => (g.id === goal.id ? { ...g, status } : g)));
    const result = await withRetry(() => setGoalStatus(goal.id, status));
    if (!result.ok) {
      setGoals((p) => p.map((g) => (g.id === goal.id ? { ...g, status: prev } : g)));
      notifyError(result.error, { onRetry: () => handleStatus(goal, status) });
    }
  }

  const grouped = groupGoals(goals);

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <PrimaryButton onClick={() => setCreating((v) => !v)}>
          <Plus size={14} strokeWidth={2.5} /> New goal
        </PrimaryButton>
      </div>

      {creating && (
        <div className={styles.createForm}>
          <input
            type="text"
            className={styles.input}
            placeholder="Goal name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <select
            className={styles.input}
            value={pillarId}
            onChange={(e) => {
              setPillarId(e.target.value);
              if (areaId && areas.find((a) => a.id === areaId)?.pillarId !== e.target.value) setAreaId("");
            }}
          >
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select className={styles.input} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">No area</option>
            {areas.filter((a) => a.pillarId === pillarId).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <div className={styles.createActions}>
            <PrimaryButton onClick={handleCreate} disabled={saving}>
              {saving ? "Adding…" : "Add goal"}
            </PrimaryButton>
            <button type="button" className={styles.cancelBtn} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </div>
      )}

      {grouped.size === 0 ? (
        <div className={styles.empty}>
          <Flag size={22} strokeWidth={1.6} />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        Array.from(grouped.entries()).map(([pillarId, pillarGroup]) => {
          const hex = resolveColorHex(pillarGroup.pillarColor as ColorKey | null);
          return (
            <div key={pillarId} className={styles.pillarGroup}>
              <div className={styles.pillarHead} style={hex ? { color: hex } : undefined}>
                {pillarGroup.pillarName}
              </div>
              {Array.from(pillarGroup.byArea.entries()).map(([areaKey, areaGroup]) => (
                <div key={areaKey} className={styles.areaGroup}>
                  <div className={styles.areaHead}>{areaGroup.areaName}</div>
                  <ul className={styles.list}>
                    {areaGroup.goals.map((goal) => (
                      <li key={goal.id} className={`${styles.row} ${goal.status !== "ACTIVE" ? styles.inactive : ""}`}>
                        <Link href={`/goals/${goal.id}`} className={styles.name}>
                          {goal.name}
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
                </div>
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}
