import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast/toast-provider";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const habits = await getHabitOccurrencesForDate(new Date());
  const dailyFocusHabits = habits.map((h) => ({
    id: h.id,
    name: h.name,
    todayLevel: h.todayLevel,
    pillarColor: h.pillarColor,
  }));

  return (
    <ToastProvider>
      {/* Nudges' eligibility engine + real unread count land in #69 — 0 is
       * this ticket's spec'd stub value until then. */}
      <AppShell dailyFocusHabits={dailyFocusHabits} nudgesUnreadCount={0}>
        {children}
      </AppShell>
    </ToastProvider>
  );
}
