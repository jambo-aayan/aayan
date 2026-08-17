import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { IconBadge } from "./icon-badge";
import styles from "./dashboard-card.module.css";

type Accent = "health" | "finance" | "thoughts" | "neutral";

export function DashboardCard({
  href,
  icon,
  accent = "neutral",
  title,
  status,
}: {
  href: string;
  icon: LucideIcon;
  accent?: Accent;
  title: string;
  status: string;
}) {
  return (
    <Link href={href} className={styles.card}>
      <IconBadge icon={icon} accent={accent} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.status}>{status}</span>
      </span>
      <ChevronRight size={17} strokeWidth={2} className={styles.chevron} />
    </Link>
  );
}
