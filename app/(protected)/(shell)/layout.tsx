import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast/toast-provider";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { getPaletteItems } from "@/lib/palette/data";
import { PALETTE_PAGES } from "@/lib/palette/pages";
import { getUnreadNudgeCount } from "@/lib/nudges/data";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const [habits, paletteEntities, nudgesUnreadCount] = await Promise.all([
    getHabitOccurrencesForDate(new Date()),
    getPaletteItems(),
    getUnreadNudgeCount(),
  ]);
  const dailyFocusHabits = habits.map((h) => ({
    id: h.id,
    name: h.name,
    todayLevel: h.todayLevel,
    pillarColor: resolveColorHex(h.pillarColor as ColorKey | null),
  }));
  const paletteItems = [...PALETTE_PAGES, ...paletteEntities];

  return (
    <ToastProvider>
      <AppShell dailyFocusHabits={dailyFocusHabits} nudgesUnreadCount={nudgesUnreadCount} paletteItems={paletteItems}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
