import "server-only";
import { prisma } from "@/lib/prisma";
import { isSameUtcDay, utcMidnight } from "./date-utils";
import { mondayOf } from "./streak";
import { habitOccursOn, type HabitScheduleType } from "./schedule";

const HABIT_INCLUDE = {
  area: { select: { id: true, name: true } },
  pillar: { select: { id: true, name: true, color: true } },
  checkIns: true,
  goals: { include: { goal: { select: { id: true, name: true, status: true } } } },
} as const;

type HabitRow = {
  id: string;
  name: string;
  pillarId: string;
  pillar: { id: string; name: string; color: string | null };
  areaId: string | null;
  area: { id: string; name: string } | null;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  scheduleType: HabitScheduleType;
  scheduleWeekdays: number[];
  scheduleIntervalN: number | null;
  scheduleAnchorDate: Date | null;
  scheduleCustomText: string | null;
  createdAt: Date;
  updatedAt: Date;
  checkIns: { date: Date; level: "FULL" | "MINIMUM" }[];
  goals: { goal: { id: string; name: string; status: string }; isPrimary: boolean }[];
};

function mapHabit(row: HabitRow) {
  const { checkIns, area, pillar, goals, ...habit } = row;
  return {
    ...habit,
    areaName: area?.name ?? null,
    pillarName: pillar.name,
    pillarColor: pillar.color,
    checkInDates: checkIns.map((c) => c.date),
    todayLevel: checkIns.find((c) => isSameUtcDay(c.date, new Date()))?.level ?? null,
    goals: goals.map((g) => ({ id: g.goal.id, name: g.goal.name, status: g.goal.status, isPrimary: g.isPrimary })),
    primaryGoal: goals.find((g) => g.isPrimary)?.goal ?? null,
  };
}

export type HabitWithRelations = ReturnType<typeof mapHabit>;

export async function getHabitsForArea(areaId: string) {
  const habits = await prisma.habit.findMany({
    where: { areaId },
    include: HABIT_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return habits.map(mapHabit);
}

export type HabitFilter = {
  pillarId?: string;
  areaId?: string;
  goalId?: string;
  status?: "ACTIVE" | "PAUSED" | "ARCHIVED";
};

export async function getAllHabits(filter: HabitFilter = {}): Promise<HabitWithRelations[]> {
  const where: Record<string, unknown> = {};
  if (filter.pillarId) where.pillarId = filter.pillarId;
  if (filter.areaId) where.areaId = filter.areaId;
  if (filter.status) where.status = filter.status;
  if (filter.goalId) where.goals = { some: { goalId: filter.goalId } };

  const habits = await prisma.habit.findMany({
    where,
    include: HABIT_INCLUDE,
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return habits.map(mapHabit);
}

export async function getHabitById(id: string): Promise<HabitWithRelations | null> {
  const habit = await prisma.habit.findUnique({ where: { id }, include: HABIT_INCLUDE });
  return habit ? mapHabit(habit) : null;
}

/** Whether a habit already has a check-in somewhere in the Mon-Sun week
 * containing `date` — the fact WEEKLY/EVERY_N_WEEKS schedules need (see
 * lib/habits/schedule.ts's habitOccursOn). */
function doneInWeekOf(checkInDates: Date[], date: Date): boolean {
  const weekStart = mondayOf(date).getTime();
  return checkInDates.some((d) => mondayOf(d).getTime() === weekStart);
}

/** Active habits scheduled to occur on `date` — the "My Day habit
 * occurrences" from Habit's schema comment: computed, not stored. */
export async function getHabitOccurrencesForDate(date: Date) {
  const habits = await prisma.habit.findMany({
    where: { status: "ACTIVE" },
    include: HABIT_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return habits
    .map(mapHabit)
    .filter((habit) =>
      habitOccursOn(habit, date, doneInWeekOf(habit.checkInDates, date))
    );
}

/** Every ACTIVE habit currently due today (todayLevel === null) — the
 * subset that actually needs action, for a compact "N left" style summary. */
export function habitsNotCheckedInToday<T extends { todayLevel: string | null }>(habits: T[]): T[] {
  return habits.filter((h) => h.todayLevel === null);
}

export { utcMidnight };
