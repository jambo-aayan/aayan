"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./sidebar.module.css";

const NAV_ITEMS = [
  { href: "/today", label: "Home", swatch: null },
  { href: "/health", label: "Health", swatch: "var(--health)" },
  { href: "/finances", label: "Finances", swatch: "var(--coral)" },
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className={styles.sidebar} aria-label="Main">
      <div className={styles.brand}>
        <span className={styles.brandMark}>L</span> Life
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.item} ${active ? styles.active : ""}`}
          >
            {item.swatch && (
              <span className={styles.swatch} style={{ background: item.swatch }} />
            )}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
