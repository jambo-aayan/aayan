import { habitOccursOn, type HabitSchedule } from "../habits/schedule";
import { mondayOf } from "../habits/streak";

const DAY_MS = 24 * 60 * 60 * 1000;
export const CONSISTENCY_GRID_MAX_DAYS = 28;

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type ConsistencyCellState = "full" | "partial" | "none";

export type ConsistencyCheckIn = { date: Date; level: "FULL" | "MINIMUM" };

export type ConsistencyHabitFixture = {
  id: string;
  name: string;
  schedule: HabitSchedule;
  checkIns: ConsistencyCheckIn[];
};

export type ConsistencyRow = {
  habitId: string;
  habitName: string;
  cells: ConsistencyCellState[];
  pct: number;
};

export type ConsistencyGrid = {
  days: string[];
  rows: ConsistencyRow[];
  longestStreak: { habitName: string; days: number } | null;
  habitsAbove60: number;
  weakestWeekday: { weekday: number; label: string; pct: number } | null;
};

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  for (let t = start.getTime(); t <= end.getTime(); t += DAY_MS) days.push(new Date(t));
  return days;
}

/** Longest run of consecutive calendar days with any check-in, within the
 * grid's own window only — not the habit's all-time streak (see
 * lib/habits/streak.ts's dailyStreak, which is unbounded history; this is
 * deliberately scoped to what the grid actually shows, so the footer stat
 * never claims a streak longer than what's on screen). */
function longestRunInWindow(loggedDays: Set<string>, days: Date[]): number {
  let best = 0;
  let current = 0;
  for (const day of days) {
    if (loggedDays.has(dateKey(day))) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  }
  return best;
}

/**
 * The 28-day (or fewer, for a shorter selected range — see
 * CONSISTENCY_GRID_MAX_DAYS and this function's caller) × habit grid:
 * per-habit cell states, adherence %, and the three footer stats. Days
 * not scheduled for a habit render identically to a missed day ("none")
 * — the handoff only specifies three visual cell states — but are
 * excluded from that habit's percentage, matching adherence's definition
 * everywhere else in the app (logged ÷ scheduled, not logged ÷ all days).
 */
export function computeConsistencyGrid(habits: ConsistencyHabitFixture[], start: Date, end: Date): ConsistencyGrid {
  const days = eachDay(start, end);
  const dayKeys = days.map(dateKey);

  const weekdayScheduled = new Array(7).fill(0);
  const weekdayLogged = new Array(7).fill(0);

  const rows: ConsistencyRow[] = habits.map((habit) => {
    const checkInByDay = new Map(habit.checkIns.map((c) => [dateKey(c.date), c.level]));

    let scheduled = 0;
    let logged = 0;
    const cells: ConsistencyCellState[] = days.map((day) => {
      const weekStart = mondayOf(day);
      const doneThisWeek = habit.checkIns.some(
        (c) => mondayOf(c.date).getTime() === weekStart.getTime() && c.date.getTime() <= day.getTime()
      );
      const isScheduled = habitOccursOn(habit.schedule, day, doneThisWeek);
      const level = checkInByDay.get(dateKey(day));

      if (isScheduled) {
        scheduled += 1;
        weekdayScheduled[day.getUTCDay()] += 1;
        if (level === "FULL") {
          logged += 1;
          weekdayLogged[day.getUTCDay()] += 1;
        } else if (level === "MINIMUM") {
          logged += 0.5;
          weekdayLogged[day.getUTCDay()] += 0.5;
        }
      }

      if (level === "FULL") return "full";
      if (level === "MINIMUM") return "partial";
      return "none";
    });

    return {
      habitId: habit.id,
      habitName: habit.name,
      cells,
      pct: scheduled === 0 ? 0 : Math.round((logged / scheduled) * 100),
    };
  });

  let longestStreak: ConsistencyGrid["longestStreak"] = null;
  for (const habit of habits) {
    const loggedDays = new Set(habit.checkIns.map((c) => dateKey(c.date)).filter((k) => dayKeys.includes(k)));
    const run = longestRunInWindow(loggedDays, days);
    if (run > 0 && (!longestStreak || run > longestStreak.days)) {
      longestStreak = { habitName: habit.name, days: run };
    }
  }

  const habitsAbove60 = rows.filter((r) => r.pct > 60).length;

  let weakestWeekday: ConsistencyGrid["weakestWeekday"] = null;
  for (let wd = 0; wd < 7; wd++) {
    if (weekdayScheduled[wd] === 0) continue;
    const pct = Math.round((weekdayLogged[wd] / weekdayScheduled[wd]) * 100);
    if (!weakestWeekday || pct < weakestWeekday.pct) {
      weakestWeekday = { weekday: wd, label: WEEKDAY_NAMES[wd], pct };
    }
  }

  return { days: dayKeys, rows, longestStreak, habitsAbove60, weakestWeekday };
}
