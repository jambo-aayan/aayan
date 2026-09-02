import { House, BarChart3, ClipboardList, Bell, Settings } from "lucide-react";

/** Shared between the desktop Sidebar and the mobile nav drawer so both stay
 * in sync. Per the design_handoff_aayan README's Global chrome spec, active/
 * inactive nav icon color is uniform (coral / muted-2) — not per-item, so
 * there's no per-item accent here.
 *
 * As of #157/ADR-0016, Pillar entries (Health, Finances, and every
 * user-created Pillar) are no longer hardcoded here — they're data-driven,
 * fetched alongside everything else in the shell layout and rendered
 * between these two groups (see components/sidebar.tsx and
 * components/mobile-nav-drawer.tsx). */
export const NAV_BEFORE_PILLARS = [
  { href: "/today", label: "Home", icon: House },
  { href: "/log", label: "Log", icon: ClipboardList },
  { href: "/insights", label: "Insights", icon: BarChart3 },
] as const;

export const NAV_AFTER_PILLARS = [
  { href: "/nudges", label: "Nudges", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export type PillarNavItem = { id: string; label: string; href: string; color: string | null };
