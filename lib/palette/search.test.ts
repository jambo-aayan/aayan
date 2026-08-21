import { describe, expect, it } from "vitest";
import { searchPalette, topHit } from "./search";
import type { PaletteItem } from "./types";

const ITEMS: PaletteItem[] = [
  { id: "page-health", type: "page", label: "Health", hint: null, href: "/health", color: null },
  { id: "page-habits", type: "page", label: "Habits", hint: null, href: "/habits", color: null },
  { id: "task-1", type: "task", label: "Book health check-up", hint: null, href: "/all-tasks", color: "#C97B5F" },
  { id: "task-2", type: "task", label: "Buy groceries", hint: null, href: "/all-tasks", color: "#C97B5F" },
  { id: "habit-1", type: "habit", label: "Morning stretch", hint: null, href: "/habits", color: "#6F8F6A" },
  { id: "goal-1", type: "goal", label: "Run a 10k", hint: null, href: "/goals/g1", color: "#6F8F6A" },
  { id: "thought-1", type: "thought", label: "Feeling healthier this week", hint: null, href: "/thoughts", color: "#8E85B0" },
];

describe("searchPalette", () => {
  it("returns nothing for an empty query", () => {
    expect(searchPalette("", ITEMS)).toEqual([]);
    expect(searchPalette("   ", ITEMS)).toEqual([]);
  });

  it("matches case-insensitively across groups, in Jump to / Tasks / Habits / Goals / Thoughts order", () => {
    const groups = searchPalette("health", ITEMS);
    expect(groups.map((g) => g.type)).toEqual(["page", "task", "thought"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["page-health"]);
    expect(groups[1].items.map((i) => i.id)).toEqual(["task-1"]);
    expect(groups[2].items.map((i) => i.id)).toEqual(["thought-1"]);
  });

  it("omits groups with no matches", () => {
    const groups = searchPalette("10k", ITEMS);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("goal");
  });

  it("matches a hint as well as the label", () => {
    const items: PaletteItem[] = [
      { id: "task-3", type: "task", label: "Call the vet", hint: "Due Friday", href: "/all-tasks", color: null },
    ];
    expect(searchPalette("friday", items)[0].items).toHaveLength(1);
  });

  it("caps each group at 5 items", () => {
    const manyTasks: PaletteItem[] = Array.from({ length: 8 }, (_, i) => ({
      id: `task-${i}`,
      type: "task" as const,
      label: `Task ${i}`,
      hint: null,
      href: "/all-tasks",
      color: null,
    }));
    const groups = searchPalette("task", manyTasks);
    expect(groups[0].items).toHaveLength(5);
  });

  it("returns no groups when nothing matches", () => {
    expect(searchPalette("xyzzy", ITEMS)).toEqual([]);
  });
});

describe("topHit", () => {
  it("returns the first item of the first group", () => {
    const groups = searchPalette("health", ITEMS);
    expect(topHit(groups)?.id).toBe("page-health");
  });

  it("returns null when there are no groups", () => {
    expect(topHit([])).toBeNull();
  });
});
