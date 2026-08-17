import { isSameUtcDay, utcMidnight } from "../habits/date-utils";

export type TaskWithDueDate = { id: string; dueDate: Date | null };

export type TaskDateGroups<T> = {
  overdue: T[];
  today: T[];
  tomorrow: T[];
  thisWeek: T[];
  later: T[];
  noDueDate: T[];
};

/** Groups active tasks for the By Date view. Callers pass only tasks already
 * filtered to active/non-archived/non-deleted — this has no opinion on status. */
export function groupTasksByDate<T extends TaskWithDueDate>(tasks: T[], today: Date): TaskDateGroups<T> {
  const todayMid = utcMidnight(today);
  const tomorrowMid = new Date(todayMid);
  tomorrowMid.setUTCDate(tomorrowMid.getUTCDate() + 1);
  const weekEnd = new Date(todayMid);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const groups: TaskDateGroups<T> = { overdue: [], today: [], tomorrow: [], thisWeek: [], later: [], noDueDate: [] };

  for (const task of tasks) {
    if (task.dueDate === null) {
      groups.noDueDate.push(task);
      continue;
    }
    const due = utcMidnight(task.dueDate);
    if (due.getTime() < todayMid.getTime()) {
      groups.overdue.push(task);
    } else if (isSameUtcDay(due, todayMid)) {
      groups.today.push(task);
    } else if (isSameUtcDay(due, tomorrowMid)) {
      groups.tomorrow.push(task);
    } else if (due.getTime() < weekEnd.getTime()) {
      groups.thisWeek.push(task);
    } else {
      groups.later.push(task);
    }
  }

  return groups;
}
