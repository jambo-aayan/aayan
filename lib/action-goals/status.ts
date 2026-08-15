export type GoalStatus = "NOT_STARTED" | "IN_PROGRESS" | "DONE";

export const STATUS_LABEL: Record<GoalStatus, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  DONE: "Done",
};
