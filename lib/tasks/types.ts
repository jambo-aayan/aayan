export type TaskStatus = "ACTIVE" | "COMPLETED";

export type TaskReminderOffset = "AT_DUE" | "MIN_15_BEFORE" | "HOUR_1_BEFORE" | "DAY_1_BEFORE" | "CUSTOM";

export type TaskRepeatRule = "DAILY" | "WEEKDAYS" | "WEEKLY" | "MONTHLY" | "CUSTOM";

export const REMINDER_LABEL: Record<TaskReminderOffset, string> = {
  AT_DUE: "At due time",
  MIN_15_BEFORE: "15 minutes before",
  HOUR_1_BEFORE: "1 hour before",
  DAY_1_BEFORE: "1 day before",
  CUSTOM: "Custom",
};

export const REPEAT_LABEL: Record<TaskRepeatRule, string> = {
  DAILY: "Daily",
  WEEKDAYS: "Weekdays",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  CUSTOM: "Custom",
};

export type TaskStep = {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
};

export type Task = {
  id: string;
  title: string;
  notes: string | null;
  status: TaskStatus;
  important: boolean;
  sortOrder: number;
  listId: string | null;
  listName: string | null;
  listColor: string | null;
  pillarId: string | null;
  pillarName: string | null;
  pillarColor: string | null;
  areaId: string | null;
  areaName: string | null;
  goalId: string | null;
  goalName: string | null;
  dueDate: Date | null;
  dueTime: string | null;
  reminderOffset: TaskReminderOffset | null;
  repeatRule: TaskRepeatRule | null;
  completedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  tags: { id: string; name: string }[];
  steps: TaskStep[];
};
