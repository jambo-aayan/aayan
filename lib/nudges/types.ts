export type NudgeType =
  | "HABIT_DUE"
  | "TASK_OVERDUE"
  | "STREAK_AT_RISK"
  | "WEEKLY_REVIEW_READY"
  | "METRIC_OFF_TARGET"
  | "MORNING_BRIEF"
  | "SYSTEM_REVIEW_DUE"
  | "CATEGORY_SPEND_ANOMALY"
  | "METRIC_LOG_DUE";

export type NudgeTargetType = "HABIT" | "TASK" | "SYSTEM" | "NONE";

/** Fixed per-type severity, used only for the "same dedup key, highest
 * severity wins" rule (ADR-0002) — not a general priority ranking across
 * unrelated types. SYSTEM_REVIEW_DUE sits at the same tier as
 * TASK_OVERDUE (#109/#111, docs/adr/0009) — an Experiment sitting past
 * its review date, undecided, is the same kind of "actively going stale"
 * as an overdue task. */
export const NUDGE_SEVERITY: Record<NudgeType, number> = {
  STREAK_AT_RISK: 3,
  TASK_OVERDUE: 3,
  SYSTEM_REVIEW_DUE: 3,
  METRIC_OFF_TARGET: 2,
  CATEGORY_SPEND_ANOMALY: 2,
  HABIT_DUE: 1,
  WEEKLY_REVIEW_READY: 1,
  MORNING_BRIEF: 1,
  METRIC_LOG_DUE: 1,
};

/** Semantic accent per the design_handoff_aayan README's Nudges type
 * table — pillar accent for Habit due is resolved by the caller (it needs
 * the habit's own color), so it's not listed here. SYSTEM_REVIEW_DUE
 * reuses "coral", matching the Systems tab's own Experiment=coral
 * convention (#109/#111). */
export const NUDGE_ACCENT: Record<Exclude<NudgeType, "HABIT_DUE">, "danger" | "coral" | "lavender" | "gold" | "ink"> = {
  TASK_OVERDUE: "danger",
  STREAK_AT_RISK: "coral",
  WEEKLY_REVIEW_READY: "lavender",
  METRIC_OFF_TARGET: "gold",
  MORNING_BRIEF: "ink",
  SYSTEM_REVIEW_DUE: "coral",
  // Same "gold" as METRIC_OFF_TARGET — both are a Finance figure trending
  // the wrong way, not an urgent/danger-level event.
  CATEGORY_SPEND_ANOMALY: "gold",
  // Same tier as HABIT_DUE — a gentle end-of-period reminder, not an
  // urgent/danger-level event.
  METRIC_LOG_DUE: "gold",
};

/** SYSTEM_REVIEW_DUE's primary action is the first that actually
 * navigates (deep-links to the System's card) rather than only marking
 * the Nudge read — see docs/adr/0009-systems-review-nudges.md. */
export const NUDGE_PRIMARY_ACTION_LABEL: Record<NudgeType, string> = {
  HABIT_DUE: "Log now",
  TASK_OVERDUE: "Reschedule",
  STREAK_AT_RISK: "Check in",
  WEEKLY_REVIEW_READY: "Open review",
  METRIC_OFF_TARGET: "See finances",
  MORNING_BRIEF: "Open My Day",
  SYSTEM_REVIEW_DUE: "Set verdict",
  CATEGORY_SPEND_ANOMALY: "See finances",
  METRIC_LOG_DUE: "Log now",
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
