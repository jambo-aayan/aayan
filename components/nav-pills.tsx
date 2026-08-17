"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { House, LayoutGrid, Calendar, List, CalendarDays, Lightbulb, ListChecks } from "lucide-react";
import styles from "./nav-pills.module.css";

type NavPillItem = { href: string; label: string; icon: LucideIcon };

const TODAY_PILLS: NavPillItem[] = [
  { href: "/pillars", label: "Pillars", icon: LayoutGrid },
  { href: "/my-day", label: "My Day", icon: Calendar },
  { href: "/all-actions", label: "All Actions", icon: List },
  { href: "/all-tasks", label: "All Tasks", icon: ListChecks },
  { href: "/by-date", label: "By Date", icon: CalendarDays },
  { href: "/thoughts", label: "Thoughts", icon: Lightbulb },
];

const PILLARS_PILLS: NavPillItem[] = [
  { href: "/today", label: "Today", icon: House },
  { href: "/my-day", label: "My Day", icon: Calendar },
  { href: "/all-actions", label: "All Actions", icon: List },
  { href: "/all-tasks", label: "All Tasks", icon: ListChecks },
  { href: "/thoughts", label: "Thoughts", icon: Lightbulb },
];

/**
 * Icon components can't be passed as plain prop data across the server/client
 * boundary (RSC serialization forbids it), so each page's pill set is a named
 * preset defined entirely inside this client module — pages render the
 * preset component directly rather than constructing/passing an items array.
 */
function NavPills({ items }: { items: NavPillItem[] }) {
  const pathname = usePathname();

  return (
    <nav className={styles.pills} aria-label="Sections">
      {items.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} className={`${styles.pill} ${active ? styles.active : ""}`}>
            <Icon size={15} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function TodaySectionPills() {
  return <NavPills items={TODAY_PILLS} />;
}

export function PillarsSectionPills() {
  return <NavPills items={PILLARS_PILLS} />;
}
