import { describe, expect, it } from "vitest";
import { computeAttentionBalance, attentionGapLabel, type ActivityFixture, type PillarFixture } from "./attention-balance";

describe("computeAttentionBalance", () => {
  const pillars: PillarFixture[] = [
    { id: "work", name: "Work", intendedSharePct: 40 },
    { id: "health", name: "Health", intendedSharePct: 30 },
  ];

  it("computes actual share as a percentage of total activity, bucketed by pillar", () => {
    const activities: ActivityFixture[] = [
      { pillarId: "work", isThought: false },
      { pillarId: "work", isThought: false },
      { pillarId: "health", isThought: false },
      { pillarId: null, isThought: false },
    ];
    const rows = computeAttentionBalance(pillars, activities);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.work.actualSharePct).toBe(50);
    expect(byId.health.actualSharePct).toBe(25);
    expect(byId.unsorted.actualSharePct).toBe(25);
  });

  it("buckets thoughts into Thoughts regardless of any pillar tag", () => {
    const activities: ActivityFixture[] = [
      { pillarId: "work", isThought: true },
      { pillarId: "work", isThought: false },
    ];
    const rows = computeAttentionBalance(pillars, activities);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
    expect(byId.thoughts.actualSharePct).toBe(50);
    expect(byId.work.actualSharePct).toBe(50);
  });

  it("computes the gap against intended share and flags danger past 8 points", () => {
    const activities: ActivityFixture[] = Array.from({ length: 10 }, () => ({ pillarId: "work", isThought: false }));
    // work: 100% actual vs 40% intended -> gap +60, danger.
    const rows = computeAttentionBalance(pillars, activities);
    const work = rows.find((r) => r.id === "work")!;
    expect(work.gap).toBe(60);
    expect(work.gapIsDanger).toBe(true);
  });

  it("does not flag danger within the 8-point threshold", () => {
    const activities: ActivityFixture[] = [
      ...Array.from({ length: 45 }, () => ({ pillarId: "work", isThought: false })),
      ...Array.from({ length: 55 }, () => ({ pillarId: "health", isThought: false })),
    ];
    const rows = computeAttentionBalance(pillars, activities);
    const work = rows.find((r) => r.id === "work")!;
    expect(work.actualSharePct).toBe(45);
    expect(work.gap).toBe(5);
    expect(work.gapIsDanger).toBe(false);
  });

  it("always includes Unsorted/Inbox and Thoughts rows with a null intended share, even with zero activity", () => {
    const rows = computeAttentionBalance(pillars, []);
    const unsorted = rows.find((r) => r.id === "unsorted")!;
    const thoughts = rows.find((r) => r.id === "thoughts")!;
    expect(unsorted.intendedSharePct).toBeNull();
    expect(unsorted.gap).toBeNull();
    expect(thoughts.intendedSharePct).toBeNull();
  });
});

describe("attentionGapLabel", () => {
  it("reads as over/under/right-on based on the gap's sign", () => {
    expect(attentionGapLabel({ id: "x", label: "X", actualSharePct: 52, intendedSharePct: 40, gap: 12, gapIsDanger: true })).toBe(
      "12 points over your intent."
    );
    expect(attentionGapLabel({ id: "x", label: "X", actualSharePct: 28, intendedSharePct: 40, gap: -12, gapIsDanger: true })).toBe(
      "12 points under your intent."
    );
    expect(attentionGapLabel({ id: "x", label: "X", actualSharePct: 40, intendedSharePct: 40, gap: 0, gapIsDanger: false })).toBe(
      "Right on your intent."
    );
  });

  it("reads as a neutral note when no intent was set", () => {
    expect(attentionGapLabel({ id: "x", label: "X", actualSharePct: 20, intendedSharePct: null, gap: null, gapIsDanger: false })).toBe(
      "No intent set yet."
    );
  });
});
