import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import styles from "./page-header.module.css";

/**
 * backHref only renders on mobile (hidden ≥900px) — the sidebar already
 * covers navigation at that width, and without it mobile has no way back
 * off a pillar dashboard.
 */
export function PageHeader({
  title,
  backHref,
  accentColor,
}: {
  title: string;
  backHref?: string;
  /** A Pillar's chosen color (resolved hex), when this page belongs to one
   * — tints the title, one of the color system's subtle propagation
   * points (see lib/colors.ts). */
  accentColor?: string | null;
}) {
  return (
    <div className={styles.topbar}>
      {backHref && (
        <Link href={backHref} className={styles.back} aria-label="Back">
          <ArrowLeft size={17} strokeWidth={2} />
        </Link>
      )}
      <h2 className={styles.title} style={accentColor ? { color: accentColor } : undefined}>
        {title}
      </h2>
    </div>
  );
}
