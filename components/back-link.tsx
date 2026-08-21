import Link from "next/link";
import styles from "./back-link.module.css";

/** The coral "← Parent" text link used on drill-down pages (Area detail,
 * Goal detail, ...) per the handoff — distinct from PageHeader's mobile-only
 * round icon button. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={styles.link}>
      ← {label}
    </Link>
  );
}
