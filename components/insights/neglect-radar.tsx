import Link from "next/link";
import type { NeglectRow } from "@/lib/insights/neglect";
import styles from "./neglect-radar.module.css";

const KIND_ACTION: Record<NeglectRow["kind"], string> = {
  area: "Add habit",
  goal: "Add task",
  list: "Prune",
  thoughts: "Write",
};

function actionHref(row: NeglectRow): string {
  switch (row.kind) {
    case "area":
      return `/health/${row.id}`;
    case "goal":
      return `/goals/${row.id}`;
    case "list":
      return `/tasks?listId=${row.id}`;
    case "thoughts":
      return "/thoughts";
  }
}

function daysLabel(daysSince: number | null): string {
  if (daysSince === null) return "Never";
  if (daysSince === 0) return "Today";
  if (daysSince === 1) return "1 day";
  return `${daysSince} days`;
}

export function NeglectRadar({ rows }: { rows: NeglectRow[] }) {
  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Neglect radar</div>

      {rows.length === 0 ? (
        <p className={styles.empty}>Nothing to show yet.</p>
      ) : (
        <ul className={styles.list}>
          {rows.map((row) => (
            <li key={`${row.kind}:${row.id}`} className={styles.row}>
              <span className={`${styles.dot} ${styles[row.severity]}`} aria-hidden />
              <span className={styles.label}>{row.label}</span>
              <span className={styles.days}>{daysLabel(row.daysSince)}</span>
              <Link href={actionHref(row)} className={styles.action}>
                {KIND_ACTION[row.kind]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
