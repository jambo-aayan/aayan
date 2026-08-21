export type NudgeType = "HABIT_DUE" | "TASK_OVERDUE" | "STREAK_AT_RISK" | "WEEKLY_REVIEW_READY" | "METRIC_OFF_TARGET" | "MORNING_BRIEF";

export type NudgeTargetType = "HABIT" | "TASK" | "NONE";

/** Fixed per-type severity, used only for the "same dedup key, highest
 * severity wins" rule (ADR-0002) — not a general priority ranking across
 * unrelated types. */
export const NUDGE_SEVERITY: Record<NudgeType, number> = {
  STREAK_AT_RISK: 3,
  TASK_OVERDUE: 3,
  METRIC_OFF_TARGET: 2,
  HABIT_DUE: 1,
  WEEKLY_REVIEW_READY: 1,
  MORNING_BRIEF: 1,
};

/** Semantic accent per the design_handoff_aayan README's Nudges type
 * table — pillar accent for Habit due is resolved by the caller (it needs
 * the habit's own color), so it's not listed here. */
export const NUDGE_ACCENT: Record<Exclude<NudgeType, "HABIT_DUE">, "danger" | "coral" | "lavender" | "gold" | "ink"> = {
  TASK_OVERDUE: "danger",
  STREAK_AT_RISK: "coral",
  WEEKLY_REVIEW_READY: "lavender",
  METRIC_OFF_TARGET: "gold",
  MORNING_BRIEF: "ink",
};

export const NUDGE_PRIMARY_ACTION_LABEL: Record<NudgeType, string> = {
  HABIT_DUE: "Log now",
  TASK_OVERDUE: "Reschedule",
  STREAK_AT_RISK: "Check in",
  WEEKLY_REVIEW_READY: "Open review",
  METRIC_OFF_TARGET: "See finances",
  MORNING_BRIEF: "Open My Day",
};

export type NudgeCandidate = {
  dedupKey: string;
  type: NudgeType;
  severity: number;
  targetType: NudgeTargetType;
  targetId: string | null;
  title: string;
  body: string;
};
