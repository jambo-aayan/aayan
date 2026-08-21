import { describe, expect, it } from "vitest";
import { computeTrajectory, type TrajectoryPoint } from "./trajectory";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("computeTrajectory", () => {
  it("reports already-at-target when current value meets or exceeds it", () => {
    const actuals: TrajectoryPoint[] = [{ date: "2026-08-01", value: 10000 }];
    const result = computeTrajectory(actuals, 9000, d("2026-12-01"), d("2026-08-01"));
    expect(result.writtenRead).toBe("Already at target.");
    expect(result.projectedDate).toBe("2026-08-01");
  });

  it("computes pace from the first-to-last actuals and projects a future date", () => {
    const actuals: TrajectoryPoint[] = [
      { date: "2026-08-01", value: 1000 },
      { date: "2026-08-11", value: 1100 }, // +10/day over 10 days
    ];
    // 900 more needed at 10/day = 90 days from 08-11.
    const result = computeTrajectory(actuals, 2000, null, d("2026-08-11"));
    expect(result.projectedDate).toBe("2026-11-09");
  });

  it("reports no projected date when the pace is flat or negative", () => {
    const flat: TrajectoryPoint[] = [
      { date: "2026-08-01", value: 1000 },
      { date: "2026-08-11", value: 1000 },
    ];
    const result = computeTrajectory(flat, 2000, null, d("2026-08-11"));
    expect(result.projectedDate).toBeNull();
    expect(result.writtenRead).toContain("won't reach target");

    const declining: TrajectoryPoint[] = [
      { date: "2026-08-01", value: 1000 },
      { date: "2026-08-11", value: 900 },
    ];
    expect(computeTrajectory(declining, 2000, null, d("2026-08-11")).projectedDate).toBeNull();
  });

  it("computes delta vs. deadline as negative when arriving early", () => {
    const actuals: TrajectoryPoint[] = [
      { date: "2026-08-01", value: 1000 },
      { date: "2026-08-11", value: 1100 },
    ];
    // Projected 2026-11-09; deadline far in the future -> early.
    const result = computeTrajectory(actuals, 2000, d("2027-01-01"), d("2026-08-11"));
    expect(result.deltaVsDeadlineDays).toBeLessThan(0);
    expect(result.writtenRead).toContain("early");
  });

  it("computes delta vs. deadline as positive when arriving late", () => {
    const actuals: TrajectoryPoint[] = [
      { date: "2026-08-01", value: 1000 },
      { date: "2026-08-11", value: 1010 }, // slow pace
    ];
    const result = computeTrajectory(actuals, 2000, d("2026-09-01"), d("2026-08-11"));
    expect(result.deltaVsDeadlineDays).toBeGreaterThan(0);
    expect(result.writtenRead).toContain("late");
  });

  it("has no deadline comparison when no deadline is given", () => {
    const actuals: TrajectoryPoint[] = [
      { date: "2026-08-01", value: 1000 },
      { date: "2026-08-11", value: 1100 },
    ];
    const result = computeTrajectory(actuals, 2000, null, d("2026-08-11"));
    expect(result.deltaVsDeadlineDays).toBeNull();
    expect(result.writtenRead).toContain("No deadline set");
  });
});
