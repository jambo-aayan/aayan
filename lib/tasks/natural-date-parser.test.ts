import { describe, expect, it } from "vitest";
import { parseTaskInput } from "./natural-date-parser";

// A fixed Monday reference so relative phrases ("tomorrow", "Friday", ...) resolve deterministically.
const MONDAY = new Date("2026-08-17T10:00:00");

describe("parseTaskInput", () => {
  it("leaves a title with no date language untouched", () => {
    expect(parseTaskInput("Read 20 pages", MONDAY)).toEqual({
      title: "Read 20 pages",
      dueDate: null,
      dueTime: null,
    });
  });

  it("extracts a same-day due date", () => {
    const result = parseTaskInput("Call Mum today", MONDAY);
    expect(result.title).toBe("Call Mum");
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-17");
    expect(result.dueTime).toBeNull();
  });

  it("extracts tomorrow", () => {
    const result = parseTaskInput("Gym tomorrow", MONDAY);
    expect(result.title).toBe("Gym");
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-18");
    expect(result.dueTime).toBeNull();
  });

  it("resolves a bare weekday to the next occurrence", () => {
    const result = parseTaskInput("Dentist Friday", MONDAY);
    expect(result.title).toBe("Dentist");
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-21");
  });

  it("extracts an explicit time alongside a same-day due date", () => {
    const result = parseTaskInput("Call Sarah today at 6pm", MONDAY);
    expect(result.title).toBe("Call Sarah");
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-17");
    expect(result.dueTime).toBe("18:00");
  });

  it("extracts a due time written without 'at'", () => {
    const result = parseTaskInput("Submit report tomorrow 9am", MONDAY);
    expect(result.title).toBe("Submit report");
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-18");
    expect(result.dueTime).toBe("09:00");
  });

  it("recognizes 'this weekend'", () => {
    const result = parseTaskInput("Buy groceries this weekend", MONDAY);
    expect(result.title).toBe("Buy groceries");
    expect(result.dueDate).not.toBeNull();
    // Saturday the 22nd, the next weekend day from a Monday reference.
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-22");
  });

  it("does not set a due time for vague times of day like 'tomorrow evening'", () => {
    const result = parseTaskInput("Pack bags tomorrow evening", MONDAY);
    expect(result.title).toBe("Pack bags");
    expect(result.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-18");
    expect(result.dueTime).toBeNull();
  });

  it("falls back to the raw text when the whole title is just date language", () => {
    const result = parseTaskInput("tomorrow", MONDAY);
    expect(result.title).toBe("tomorrow");
    expect(result.dueDate).toBeNull();
  });
});
