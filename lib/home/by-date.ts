export type ActionWithDueDate = { id: string; dueDate: Date | null };

export type DueDateGroup<T> = { date: Date; goals: T[] };

/** Groups Actions with a due date by that date, earliest first. Actions with no
 * due date are dropped — By Date only surfaces existing Actions, never invents one. */
export function groupActionsByDueDate<T extends ActionWithDueDate>(actions: T[]): DueDateGroup<T>[] {
  const byDate = new Map<number, T[]>();
  for (const action of actions) {
    if (action.dueDate === null) continue;
    const key = action.dueDate.getTime();
    byDate.set(key, [...(byDate.get(key) ?? []), action]);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([time, goals]) => ({ date: new Date(time), goals }));
}
