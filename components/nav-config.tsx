import { House, BarChart3, HeartPulse, Wallet, Bell, Settings } from "lucide-react";

/** Shared between the desktop Sidebar and the mobile nav drawer so both stay
 * in sync. Per the design_handoff_aayan README's Global chrome spec, active/
 * inactive nav icon color is uniform (coral / muted-2) — not per-item, so
 * there's no per-item accent here. */
export const NAV_ITEMS = [
  { href: "/today", label: "Home", icon: House },
  { href: "/insights", label: "Insights", icon: BarChart3 },
  { href: "/health", label: "Health", icon: HeartPulse },
  { href: "/finances", label: "Finances", icon: Wallet },
  { href: "/nudges", label: "Nudges", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;
