"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "@/components/tasks/task-filters.module.css";

const STATUSES = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "ARCHIVED", label: "Archived" },
];

export function HabitsFilters({
  pillars,
  areas,
  goals,
}: {
  pillars: { id: string; name: string }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.push(`${pathname}?${next.toString()}`);
  }

  const pillarId = searchParams.get("pillarId") ?? "";
  const visibleAreas = pillarId ? areas.filter((a) => a.pillarId === pillarId) : areas;

  return (
    <div className={styles.bar}>
      <select
        className={styles.select}
        value={pillarId}
        onChange={(e) => setParam("pillarId", e.target.value)}
        aria-label="Pillar"
      >
        <option value="">All pillars</option>
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      {visibleAreas.length > 0 && (
        <select
          className={styles.select}
          value={searchParams.get("areaId") ?? ""}
          onChange={(e) => setParam("areaId", e.target.value)}
          aria-label="Area"
        >
          <option value="">All areas</option>
          {visibleAreas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}
      {goals.length > 0 && (
        <select
          className={styles.select}
          value={searchParams.get("goalId") ?? ""}
          onChange={(e) => setParam("goalId", e.target.value)}
          aria-label="Goal"
        >
          <option value="">All goals</option>
          {goals.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      )}
      <select
        className={styles.select}
        value={searchParams.get("status") ?? ""}
        onChange={(e) => setParam("status", e.target.value)}
        aria-label="Status"
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
