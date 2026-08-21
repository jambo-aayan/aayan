"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Plus, Flag, ChevronLeft, ChevronRight } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { createGoal, setGoalStatus } from "@/lib/goals/actions";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import type { LifeGoalWithRelations, LifeGoalStatus } from "@/lib/goals/data";
import styles from "./goal-manager.module.css";
import titleStyles from "@/components/page-title.module.css";

const STATUS_LABEL: Record<LifeGoalStatus, string> = { ACTIVE: "Active", PAUSED: "Paused", COMPLETED: "Completed", ARCHIVED: "Archived" };
const STATUS_ORDER: LifeGoalStatus[] = ["ACTIVE", "PAUSED", "COMPLETED", "ARCHIVED"];
const NO_AREA_KEY = "__none__";

/**
 * Pillar → Area → Goal drill-down (tap through tiles) alongside the
 * dropdown filters in GoalsFilters, which jump straight to a level (see
 * spec: "both drill-down and global filtering supported" — they share the
 * same pillarId/areaId query params, so a filter select and a tile tap are
 * two ways to reach the same place). `goals` always arrives pre-filtered
 * by whatever level the URL currently points at.
 */
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [goals, setGoals] = useState(initialGoals);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  const pillarId = searchParams.get("pillarId") ?? "";
  const areaId = searchParams.get("areaId") ?? "";
  const [formPillarId, setFormPillarId] = useState(pillarId || pillars[0]?.id || "");
  const [formAreaId, setFormAreaId] = useState(areaId);

  function navigate(nextPillarId: string, nextAreaId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextPillarId) next.set("pillarId", nextPillarId);
    else next.delete("pillarId");
    if (nextAreaId) next.set("areaId", nextAreaId);
    else next.delete("areaId");
    router.push(`${pathname}?${next.toString()}`);
  }

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the goal a name first.");
      return;
    }
    if (!formPillarId) {
      setError("Choose a Pillar first.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await withRetry(() => createGoal({ name: trimmed, pillarId: formPillarId, areaId: formAreaId || null }));
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
        pillarId: formPillarId,
        pillarName: pillars.find((p) => p.id === formPillarId)?.name ?? "",
        pillarColor: pillars.find((p) => p.id === formPillarId)?.color ?? null,
        areaId: formAreaId || null,
        areaName: areas.find((a) => a.id === formAreaId)?.name ?? null,
        habitCount: 0,
        openTaskCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    setName("");
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

  const createForm = (
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
        value={formPillarId}
        onChange={(e) => {
          setFormPillarId(e.target.value);
          if (formAreaId && areas.find((a) => a.id === formAreaId)?.pillarId !== e.target.value) setFormAreaId("");
        }}
      >
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <select className={styles.input} value={formAreaId} onChange={(e) => setFormAreaId(e.target.value)}>
        <option value="">No area</option>
        {areas.filter((a) => a.pillarId === formPillarId).map((a) => (
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
  );

  const crumbPillar = pillarId ? pillars.find((p) => p.id === pillarId)?.name : undefined;
  const crumbArea = areaId ? (areaId === NO_AREA_KEY ? "No area" : areas.find((a) => a.id === areaId)?.name) : undefined;
  const breadcrumb = ["Goals", crumbPillar, crumbArea].filter(Boolean).join(" · ");

  const title = (
    <div className={titleStyles.wrap}>
      <div className={titleStyles.eyebrow}>{breadcrumb}</div>
      <h1 className={titleStyles.title}>{areaId ? crumbArea : pillarId ? crumbPillar : "Goals"}</h1>
    </div>
  );

  const header = (
    <div className={styles.header}>
      <PrimaryButton onClick={() => setCreating((v) => !v)}>
        <Plus size={14} strokeWidth={2.5} /> New goal
      </PrimaryButton>
    </div>
  );

  // Level 2: a specific Pillar + Area (or "no area") — the Goal list itself.
  if (pillarId && areaId) {
    const pillar = pillars.find((p) => p.id === pillarId);
    const hex = resolveColorHex(pillar?.color as ColorKey | null);
    return (
      <div className={styles.wrap}>
        {title}
        {header}
        {creating && createForm}
        <button type="button" className={styles.back} onClick={() => navigate(pillarId, "")}>
          <ChevronLeft size={14} strokeWidth={2.5} /> {pillar?.name ?? "Pillar"}
        </button>
        {goals.length === 0 ? (
          <div className={styles.empty}>
            <Flag size={22} strokeWidth={1.6} />
            <p>{emptyMessage}</p>
          </div>
        ) : (
          <ul className={styles.list}>
            {goals.map((goal) => (
              <li
                key={goal.id}
                className={`${styles.row} ${goal.status !== "ACTIVE" ? styles.inactive : ""}`}
                style={hex ? { borderLeft: `3px solid ${hex}55` } : undefined}
              >
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
      </div>
    );
  }

  // Level 1: a specific Pillar — its Area tiles (+ "No area").
  if (pillarId) {
    const pillar = pillars.find((p) => p.id === pillarId);
    const hex = resolveColorHex(pillar?.color as ColorKey | null);
    const pillarAreas = areas.filter((a) => a.pillarId === pillarId);
    const countFor = (key: string) => goals.filter((g) => (key === NO_AREA_KEY ? !g.areaId : g.areaId === key)).length;
    const noAreaCount = countFor(NO_AREA_KEY);

    return (
      <div className={styles.wrap}>
        {title}
        {header}
        {creating && createForm}
        <button type="button" className={styles.back} onClick={() => navigate("", "")}>
          <ChevronLeft size={14} strokeWidth={2.5} /> All pillars
        </button>
        <div className={styles.tileList}>
          {pillarAreas.map((area) => (
            <button
              key={area.id}
              type="button"
              className={styles.tile}
              style={hex ? { borderLeftColor: `${hex}55` } : undefined}
              onClick={() => navigate(pillarId, area.id)}
            >
              <span className={styles.tileName}>{area.name}</span>
              <span className={styles.tileMeta}>
                {countFor(area.id)} goal{countFor(area.id) === 1 ? "" : "s"}
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            </button>
          ))}
          {noAreaCount > 0 && (
            <button
              key={NO_AREA_KEY}
              type="button"
              className={styles.tile}
              style={hex ? { borderLeftColor: `${hex}55` } : undefined}
              onClick={() => navigate(pillarId, NO_AREA_KEY)}
            >
              <span className={styles.tileName}>No area</span>
              <span className={styles.tileMeta}>
                {noAreaCount} goal{noAreaCount === 1 ? "" : "s"}
                <ChevronRight size={14} strokeWidth={2} />
              </span>
            </button>
          )}
          {pillarAreas.length === 0 && noAreaCount === 0 && (
            <div className={styles.empty}>
              <Flag size={22} strokeWidth={1.6} />
              <p>{emptyMessage}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Level 0: every Pillar as a tile.
  const countForPillar = (id: string) => goals.filter((g) => g.pillarId === id).length;

  return (
    <div className={styles.wrap}>
      {title}
      {header}
      {creating && createForm}
      {pillars.length === 0 ? (
        <div className={styles.empty}>
          <Flag size={22} strokeWidth={1.6} />
          <p>{emptyMessage}</p>
        </div>
      ) : (
        <div className={styles.tileList}>
          {pillars.map((pillar) => {
            const hex = resolveColorHex(pillar.color as ColorKey | null);
            const count = countForPillar(pillar.id);
            return (
              <button
                key={pillar.id}
                type="button"
                className={styles.tile}
                style={hex ? { borderLeftColor: `${hex}55` } : undefined}
                onClick={() => navigate(pillar.id, "")}
              >
                <span className={styles.tileName} style={hex ? { color: hex } : undefined}>
                  {pillar.name}
                </span>
                <span className={styles.tileMeta}>
                  {count} goal{count === 1 ? "" : "s"}
                  <ChevronRight size={14} strokeWidth={2} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
