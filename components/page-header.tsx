import Link from "next/link";
import styles from "./page-header.module.css";

/**
 * backHref only renders on mobile (hidden ≥860px) — the sidebar already
 * covers navigation at that width, and without it mobile has no way back
 * off a pillar dashboard.
 */
export function PageHeader({ title, backHref }: { title: string; backHref?: string }) {
  return (
    <div className={styles.topbar}>
      {backHref && (
        <Link href={backHref} className={styles.back} aria-label="Back">
          ←
        </Link>
      )}
      <h2 className={styles.title}>{title}</h2>
    </div>
  );
}
