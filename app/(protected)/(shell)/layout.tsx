import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast/toast-provider";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { dailyFocusPercent } from "@/lib/home/daily-focus";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const habits = await getHabitOccurrencesForDate(new Date());

  return (
    <ToastProvider>
      <AppShell dailyFocusPercent={dailyFocusPercent(habits)}>{children}</AppShell>
    </ToastProvider>
  );
}
