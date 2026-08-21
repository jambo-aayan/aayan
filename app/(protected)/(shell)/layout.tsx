import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast/toast-provider";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { getPaletteItems } from "@/lib/palette/data";
import { PALETTE_PAGES } from "@/lib/palette/pages";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const [habits, paletteEntities] = await Promise.all([getHabitOccurrencesForDate(new Date()), getPaletteItems()]);
  const dailyFocusHabits = habits.map((h) => ({
    id: h.id,
    name: h.name,
    todayLevel: h.todayLevel,
    pillarColor: resolveColorHex(h.pillarColor as ColorKey | null),
  }));
  const paletteItems = [...PALETTE_PAGES, ...paletteEntities];

  return (
    <ToastProvider>
      {/* Nudges' eligibility engine + real unread count land in #69 — 0 is
       * this ticket's spec'd stub value until then. */}
      <AppShell dailyFocusHabits={dailyFocusHabits} nudgesUnreadCount={0} paletteItems={paletteItems}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
