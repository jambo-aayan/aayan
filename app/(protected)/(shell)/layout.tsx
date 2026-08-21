import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast/toast-provider";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { getPaletteItems } from "@/lib/palette/data";
import { PALETTE_PAGES } from "@/lib/palette/pages";
import { getUnreadNudgeCount } from "@/lib/nudges/data";
import { getAppSettings } from "@/lib/settings/data";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const [habits, paletteEntities, nudgesUnreadCount, appSettings] = await Promise.all([
    getHabitOccurrencesForDate(new Date()),
    getPaletteItems(),
    getUnreadNudgeCount(),
    getAppSettings(),
  ]);
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
  const paletteItems = [...PALETTE_PAGES, ...paletteEntities];

  return (
    <ToastProvider>
      <AppShell
        dailyFocusHabits={dailyFocusHabits}
        nudgesUnreadCount={appSettings.emptyAppMode ? 0 : nudgesUnreadCount}
        paletteItems={paletteItems}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
