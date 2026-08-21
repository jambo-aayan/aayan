import { describe, expect, it } from "vitest";
import { computeNeglectRadar, neglectSeverity, type NeglectFixture } from "./neglect";

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

const ASOF = d("2026-08-21");

describe("neglectSeverity", () => {
  it("buckets by the handoff's exact thresholds", () => {
    expect(neglectSeverity(15)).toBe("red");
    expect(neglectSeverity(8)).toBe("coral");
    expect(neglectSeverity(6)).toBe("gold");
    expect(neglectSeverity(5)).toBe("muted");
    expect(neglectSeverity(0)).toBe("muted");
  });

  it("treats never-active (null) as red — worse than any finite count", () => {
    expect(neglectSeverity(null)).toBe("red");
  });

  it("is exclusive at each boundary (14, 7, 5 themselves don't cross)", () => {
    expect(neglectSeverity(14)).toBe("coral");
    expect(neglectSeverity(7)).toBe("gold");
  });
});

describe("computeNeglectRadar", () => {
  it("covers all four kinds and computes days-since correctly", () => {
    const fixtures: NeglectFixture[] = [
      { kind: "area", id: "a1", label: "Fitness", lastActivityAt: d("2026-08-01") },
      { kind: "goal", id: "g1", label: "Run a 10k", lastActivityAt: d("2026-08-14") },
      { kind: "list", id: "l1", label: "Work", lastActivityAt: d("2026-08-20") },
      { kind: "thoughts", id: "thoughts", label: "Thoughts", lastActivityAt: d("2026-08-19") },
    ];
    const rows = computeNeglectRadar(fixtures, ASOF);
    const byKind = Object.fromEntries(rows.map((r) => [r.kind, r]));
    expect(byKind.area.daysSince).toBe(20);
    expect(byKind.goal.daysSince).toBe(7);
    expect(byKind.list.daysSince).toBe(1);
    expect(byKind.thoughts.daysSince).toBe(2);
  });

  it("sorts most neglected first", () => {
    const fixtures: NeglectFixture[] = [
      { kind: "list", id: "l1", label: "Fresh", lastActivityAt: d("2026-08-20") },
      { kind: "area", id: "a1", label: "Stale", lastActivityAt: d("2026-07-01") },
      { kind: "goal", id: "g1", label: "Mid", lastActivityAt: d("2026-08-10") },
    ];
    const rows = computeNeglectRadar(fixtures, ASOF);
    expect(rows.map((r) => r.label)).toEqual(["Stale", "Mid", "Fresh"]);
  });

  it("sorts never-active rows to the very top, ahead of any finite count", () => {
    const fixtures: NeglectFixture[] = [
      { kind: "area", id: "a1", label: "Old", lastActivityAt: d("2026-01-01") },
      { kind: "goal", id: "g1", label: "Never", lastActivityAt: null },
    ];
    const rows = computeNeglectRadar(fixtures, ASOF);
    expect(rows[0].label).toBe("Never");
    expect(rows[0].daysSince).toBeNull();
    expect(rows[0].severity).toBe("red");
  });
});
