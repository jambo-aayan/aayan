import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { IconBadge } from "./icon-badge";
import styles from "./stat-card.module.css";

type Accent = "health" | "finance" | "thoughts" | "neutral";

/**
 * The Home page's stat-card pattern per the design_handoff_aayan README:
 * "icon badge (22px, accent at .16) + uppercase label, then a Fraunces 30px
 * number and a supporting clause." Distinct from DashboardCard (Finances'
 * icon-row-with-chevron pattern) — Finances gets this treatment properly in
 * its own reskin ticket (#63), not preempted here.
 */
export function StatCard({
  href,
  icon,
  accent = "neutral",
  label,
  value,
  clause,
}: {
  href: string;
  icon: LucideIcon;
  accent?: Accent;
  label: string;
  value: string | number;
  clause: string;
}) {
  return (
    <Link href={href} className={styles.card}>
      <div className={styles.top}>
        <IconBadge icon={icon} accent={accent} size={22} />
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.value}>{value}</div>
      <div className={styles.clause}>{clause}</div>
    </Link>
  );
}
