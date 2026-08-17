import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import styles from "./empty-state.module.css";

export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon;
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className={styles.empty}>
      <Icon size={18} strokeWidth={1.75} className={styles.icon} />
      <p className={styles.message}>{message}</p>
      {actionLabel && actionHref && (
        <Link href={actionHref} className={styles.action}>
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
