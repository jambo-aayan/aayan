"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import styles from "./mobile-header.module.css";

export function MobileHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.iconButton} onClick={onMenuClick} aria-label="Open menu">
        <Menu size={20} strokeWidth={2} />
      </button>
      <span className={styles.brand}>aayan</span>
      <Link href="/settings" className={styles.avatar} aria-label="Settings">
        A
      </Link>
    </header>
  );
}
