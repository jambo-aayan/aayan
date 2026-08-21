export type CheckInLevel = "FULL" | "MINIMUM" | null;

/** Cycles a check-in level per the handoff's tri-state dot spec: no row -> FULL -> MINIMUM -> no row. */
export function nextCheckInLevel(level: CheckInLevel): CheckInLevel {
  if (level === null) return "FULL";
  if (level === "FULL") return "MINIMUM";
  return null;
}
