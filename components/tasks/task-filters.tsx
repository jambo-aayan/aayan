"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import styles from "./task-filters.module.css";

const VIEWS: { value: string; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "today", label: "Today" },
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
  { value: "important", label: "Important" },
  { value: "noDueDate", label: "No due date" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

export function TaskFilters({
  lists,
  pillars,
  tags,
}: {
  lists: { id: string; name: string }[];
  pillars: { id: string; name: string }[];
  tags: { id: string; name: string }[];
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

  return (
    <div className={styles.bar}>
      <select
        className={styles.select}
        value={searchParams.get("view") ?? "active"}
        onChange={(e) => setParam("view", e.target.value)}
        aria-label="View"
      >
        {VIEWS.map((v) => (
          <option key={v.value} value={v.value}>
            {v.label}
          </option>
        ))}
      </select>
      {lists.length > 0 && (
        <select
          className={styles.select}
          value={searchParams.get("listId") ?? ""}
          onChange={(e) => setParam("listId", e.target.value)}
          aria-label="List"
        >
          <option value="">All lists</option>
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      )}
      <select
        className={styles.select}
        value={searchParams.get("pillarId") ?? ""}
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
      {tags.length > 0 && (
        <select
          className={styles.select}
          value={searchParams.get("tagId") ?? ""}
          onChange={(e) => setParam("tagId", e.target.value)}
          aria-label="Tag"
        >
          <option value="">All tags</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              #{t.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
