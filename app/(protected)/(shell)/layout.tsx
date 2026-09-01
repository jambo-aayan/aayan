import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast/toast-provider";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { getPaletteItems } from "@/lib/palette/data";
import { PALETTE_PAGES } from "@/lib/palette/pages";
import { getUnreadNudgeCount } from "@/lib/nudges/data";
import { getAppSettings } from "@/lib/settings/data";
import { getPillarsWithStats } from "@/lib/pillars/data";
import { pillarHref } from "@/lib/pillars/nav";
import type { PillarNavItem } from "@/components/nav-config";
import type { PaletteItem } from "@/lib/palette/types";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const [habits, paletteEntities, nudgesUnreadCount, appSettings, pillars] = await Promise.all([
    getHabitOccurrencesForDate(new Date()),
    getPaletteItems(),
    getUnreadNudgeCount(),
    getAppSettings(),
    getPillarsWithStats(),
  ]);
  // Every Pillar gets a nav entry (#157/ADR-0016) — Finances' entry still
  // points at its existing literal /finances route via pillarHref, its page
  // stays bespoke, but it's not hidden from the nav.
  const pillarNavItems: PillarNavItem[] = pillars.map((p) => ({
    id: p.id,
    label: p.name,
    href: pillarHref(p.id),
    color: resolveColorHex(p.color as ColorKey | null),
  }));
  // Empty-app mode forces every count/badge/list to read zero (see
  // Settings) — the sidebar's Daily Focus widget and the Nudges badge are
  // both global chrome visible on every page, so they're zeroed here
  // rather than in each page that happens to render them.
  const dailyFocusHabits = appSettings.emptyAppMode
    ? []
    : habits.map((h) => ({
        id: h.id,
        name: h.name,
        todayLevel: h.todayLevel,
        pillarColor: resolveColorHex(h.pillarColor as ColorKey | null),
      }));
  // Pillar "Jump to page" entries — data-driven for the same reason
  // pillarNavItems is (#157/ADR-0016); no colored dot, matching every
  // other static page fixture in PALETTE_PAGES.
  const pillarPaletteItems: PaletteItem[] = pillars.map((p) => ({
    id: `page-pillar-${p.id}`,
    type: "page",
    label: p.name,
    hint: null,
    href: pillarHref(p.id),
    color: null,
  }));
  const paletteItems = [...PALETTE_PAGES, ...pillarPaletteItems, ...paletteEntities];

  return (
    <ToastProvider>
      <AppShell
        dailyFocusHabits={dailyFocusHabits}
        nudgesUnreadCount={appSettings.emptyAppMode ? 0 : nudgesUnreadCount}
        paletteItems={paletteItems}
        pillarNavItems={pillarNavItems}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
