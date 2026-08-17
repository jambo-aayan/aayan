import { describe, expect, it } from "vitest";
import { formatDueBadge } from "./format";

const TODAY = new Date("2026-08-17T00:00:00.000Z"); // Monday

function d(iso: string): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

describe("formatDueBadge", () => {
  it("is null with no due date", () => {
    expect(formatDueBadge(null, null, TODAY)).toBeNull();
  });

  it("labels today", () => {
    expect(formatDueBadge(d("2026-08-17"), null, TODAY)).toEqual({ label: "Today", variant: "today" });
  });

  it("labels today with a time", () => {
    expect(formatDueBadge(d("2026-08-17"), "18:00", TODAY)).toEqual({ label: "Today · 6pm", variant: "today" });
  });

  it("labels tomorrow", () => {
    expect(formatDueBadge(d("2026-08-18"), "09:00", TODAY)).toEqual({ label: "Tomorrow · 9am", variant: "normal" });
  });

  it("labels a past date as overdue", () => {
    const result = formatDueBadge(d("2026-08-15"), null, TODAY);
    expect(result?.variant).toBe("overdue");
    expect(result?.label).toContain("Overdue");
  });

  it("labels a further-out date with weekday and date", () => {
    const result = formatDueBadge(d("2026-08-21"), null, TODAY);
    expect(result?.variant).toBe("normal");
    expect(result?.label).toBe("Fri 21 Aug");
  });
});
