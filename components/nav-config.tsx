import { House, HeartPulse, Wallet } from "lucide-react";

/** Shared between the desktop Sidebar and the mobile nav drawer so both stay in sync. */
export const NAV_ITEMS = [
  { href: "/today", label: "Home", icon: House, accent: null },
  { href: "/health", label: "Health", icon: HeartPulse, accent: "var(--health)" },
  { href: "/finances", label: "Finances", icon: Wallet, accent: "var(--coral)" },
] as const;
