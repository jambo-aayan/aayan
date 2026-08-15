import { describe, expect, it } from "vitest";
import { mapLegacyExport, type LegacyExport } from "./map-legacy-export";

function baseLegacy(overrides: Partial<LegacyExport["data"]> = {}): LegacyExport {
  return {
    exportedAt: "2026-01-01T00:00:00.000Z",
    data: {
      actions: {},
      myDayOrder: [],
      finance: null,
      ...overrides,
    },
  };
}

describe("mapLegacyExport", () => {
  it("maps a mapped bucket's habit action, including check-in history, to a Habit + CheckIns", () => {
    const legacy = baseLegacy({
      actions: {
        spine: [
          {
            id: "h1",
            text: "Stretch",
            type: "habit",
            frequency: "daily",
            history: { "2026-01-01": 2, "2026-01-02": 1, "2026-01-03": true },
          },
        ],
      },
    });
    const result = mapLegacyExport(legacy);
    expect(result.habits).toEqual([
      {
        id: "legacy-spine-h1",
        areaId: "ankylosing-spondylitis",
        name: "Stretch",
        frequency: "DAILY",
        active: true,
        checkIns: [
          { date: "2026-01-01", level: "FULL" },
          { date: "2026-01-02", level: "MINIMUM" },
          { date: "2026-01-03", level: "FULL" },
        ],
      },
    ]);
  });

  it("defaults a habit with no frequency to DAILY and no history to an empty check-in list", () => {
    const legacy = baseLegacy({ actions: { sleep: [{ id: "h2", text: "Sleep by 11", type: "habit" }] } });
    const result = mapLegacyExport(legacy);
    expect(result.habits[0]).toMatchObject({ frequency: "DAILY", checkIns: [] });
  });

  it("maps a goal action item's status and dueDate, and sets myday from myDayOrder", () => {
    const legacy = baseLegacy({
      actions: {
        diet: [
          { id: "g1", text: "Meal plan", type: "goal", status: "in-progress", dueDate: "2026-03-01" },
          { id: "g2", text: "No sugar week", type: "goal", status: "done" },
        ],
      },
      myDayOrder: ["diet:g1"],
    });
    const result = mapLegacyExport(legacy);
    expect(result.actionGoals).toEqual([
      {
        id: "legacy-diet-g1",
        areaId: "diet",
        name: "Meal plan",
        status: "IN_PROGRESS",
        dueDate: "2026-03-01",
        myday: true,
      },
      {
        id: "legacy-diet-g2",
        areaId: "diet",
        name: "No sugar week",
        status: "DONE",
        dueDate: null,
        myday: false,
      },
    ]);
  });

  it("maps a not-started goal status", () => {
    const legacy = baseLegacy({
      actions: { bodycomp: [{ id: "g3", text: "Track weight", type: "goal", status: "not-started" }] },
    });
    const result = mapLegacyExport(legacy);
    expect(result.actionGoals[0].status).toBe("NOT_STARTED");
  });

  it("skips buckets with no destination Area and reports them", () => {
    const legacy = baseLegacy({
      actions: {
        productivity: [{ id: "p1", text: "Inbox zero", type: "goal", status: "not-started" }],
        money: [{ id: "m1", text: "Budget review", type: "goal", status: "not-started" }],
        religion: [{ id: "r1", text: "Read Quran", type: "habit", frequency: "daily" }],
      },
    });
    const result = mapLegacyExport(legacy);
    expect(result.habits).toEqual([]);
    expect(result.actionGoals).toEqual([]);
    expect(result.skipped).toEqual(
      expect.arrayContaining([
        { bucketId: "productivity", count: 1 },
        { bucketId: "money", count: 1 },
        { bucketId: "religion", count: 1 },
      ])
    );
  });

  it("maps every mapped bucket id to its new Area id", () => {
    const legacy = baseLegacy({
      actions: {
        spine: [{ id: "a1", text: "x", type: "goal", status: "not-started" }],
        sleep: [{ id: "a2", text: "x", type: "goal", status: "not-started" }],
        diet: [{ id: "a3", text: "x", type: "goal", status: "not-started" }],
        bodycomp: [{ id: "a4", text: "x", type: "goal", status: "not-started" }],
        bp: [{ id: "a5", text: "x", type: "goal", status: "not-started" }],
        dental: [{ id: "a6", text: "x", type: "goal", status: "not-started" }],
        healthcare: [{ id: "a7", text: "x", type: "goal", status: "not-started" }],
      },
    });
    const result = mapLegacyExport(legacy);
    expect(result.actionGoals.map((g) => g.areaId)).toEqual([
      "ankylosing-spondylitis",
      "sleep",
      "diet",
      "body-composition",
      "blood-pressure",
      "looks",
      "healthcare-navigation",
    ]);
  });

  it("maps Finance items, goals, and expenses-as-transactions", () => {
    const legacy = baseLegacy({
      finance: {
        items: [
          { id: "fi-cash", name: "Cash", amount: 3000, kind: "asset", liquid: true },
          { id: "fi-cc", name: "Credit card", amount: 500, kind: "liability" },
        ],
        goals: [{ id: "fg-1", name: "Emergency fund", target: 6000, saved: 4200, monthly: 300 }],
        expenses: [{ id: "fe-1", name: "Rent", amount: 900, date: "2026-01-02" }],
        fixed: [
          { id: "fx-1", name: "Rent", amount: 900 },
          { id: "fx-2", name: "Phone", amount: 30 },
        ],
        income: 3000,
      },
    });
    const result = mapLegacyExport(legacy);
    expect(result.items).toEqual([
      { id: "legacy-fi-cash", name: "Cash", type: "ASSET", value: 3000, liquid: true, excluded: false },
      { id: "legacy-fi-cc", name: "Credit card", type: "LIABILITY", value: 500, liquid: false, excluded: false },
    ]);
    expect(result.goals).toEqual([
      { id: "legacy-fg-1", name: "Emergency fund", target: 6000, saved: 4200, monthlyContribution: 300 },
    ]);
    expect(result.transactions).toEqual([
      { id: "legacy-fe-1", date: "2026-01-02", amount: 900, direction: "OUT", category: "Rent" },
    ]);
    expect(result.baseline).toEqual({ monthlyIncome: 3000, fixedOutgoings: 930 });
  });

  it("returns a null baseline and empty finance arrays when data.finance is null", () => {
    const result = mapLegacyExport(baseLegacy());
    expect(result.items).toEqual([]);
    expect(result.goals).toEqual([]);
    expect(result.transactions).toEqual([]);
    expect(result.baseline).toBeNull();
  });

  it("treats an unset item liquid/excluded as false", () => {
    const legacy = baseLegacy({
      finance: {
        items: [{ id: "fi-x", name: "House", amount: 200000, kind: "asset" }],
        goals: [],
        expenses: [],
        fixed: [],
        income: 0,
      },
    });
    const result = mapLegacyExport(legacy);
    expect(result.items[0]).toMatchObject({ liquid: false, excluded: false });
  });

  it("drops history entries whose value isn't a recognized check-in level", () => {
    const legacy = baseLegacy({
      actions: {
        spine: [
          {
            id: "h1",
            text: "Stretch",
            type: "habit",
            history: { "2026-01-01": 2, "2026-01-02": 0, "2026-01-03": false, "2026-01-04": 3 },
          },
        ],
      },
    });
    const result = mapLegacyExport(legacy);
    expect(result.habits[0].checkIns).toEqual([{ date: "2026-01-01", level: "FULL" }]);
  });

  it("falls back to NOT_STARTED for a goal status it doesn't recognize", () => {
    const legacy = baseLegacy({
      // @ts-expect-error deliberately hostile input — real JSON isn't type-checked
      actions: { diet: [{ id: "g1", text: "Odd status", type: "goal", status: "archived" }] },
    });
    const result = mapLegacyExport(legacy);
    expect(result.actionGoals[0].status).toBe("NOT_STARTED");
  });

  it("treats a missing finance.fixed as no fixed outgoings rather than throwing", () => {
    const legacy = baseLegacy({
      // @ts-expect-error deliberately hostile input — an old/partial export shape
      finance: { items: [], goals: [], expenses: [], income: 3000 },
    });
    expect(() => mapLegacyExport(legacy)).not.toThrow();
    const result = mapLegacyExport(legacy);
    expect(result.baseline).toEqual({ monthlyIncome: 3000, fixedOutgoings: 0 });
  });

  it("qualifies ids by bucket, so the same raw item id in two buckets doesn't collide", () => {
    const legacy = baseLegacy({
      actions: {
        spine: [{ id: "1", text: "Spine goal", type: "goal", status: "not-started" }],
        sleep: [{ id: "1", text: "Sleep goal", type: "goal", status: "not-started" }],
      },
    });
    const result = mapLegacyExport(legacy);
    const ids = result.actionGoals.map((g) => g.id);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toEqual(["legacy-spine-1", "legacy-sleep-1"]);
  });
});
