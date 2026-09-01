import { describe, expect, it } from "vitest";
import { parseRecordsText } from "./parse-records";

describe("parseRecordsText", () => {
  it("parses well-formed comma-separated rows", () => {
    const { rows, errors } = parseRecordsText("2026-01-01, 10\n2026-01-02, 20");
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { line: 1, date: "2026-01-01", value: 10, note: undefined },
      { line: 2, date: "2026-01-02", value: 20, note: undefined },
    ]);
  });

  it("parses tab-separated rows the same way", () => {
    const { rows, errors } = parseRecordsText("2026-01-01\t10\n2026-01-02\t20");
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.value)).toEqual([10, 20]);
  });

  it("parses an optional note as the third field", () => {
    const { rows } = parseRecordsText("2026-01-01, 10, felt great");
    expect(rows[0].note).toBe("felt great");
  });

  it("keeps commas inside a note intact, only splitting the first two fields", () => {
    const { rows } = parseRecordsText("2026-01-01, 10, ran 5k, felt great");
    expect(rows[0]).toMatchObject({ date: "2026-01-01", value: 10, note: "ran 5k, felt great" });
  });

  it("ignores blank lines, including a trailing one", () => {
    const { rows, errors } = parseRecordsText("2026-01-01, 10\n\n2026-01-02, 20\n");
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it("collects a mix of valid and invalid rows, with the right line numbers", () => {
    const { rows, errors } = parseRecordsText(
      ["2026-01-01, 10", "not a real row", "2026-01-03, 30"].join("\n")
    );
    expect(rows.map((r) => r.line)).toEqual([1, 3]);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(2);
  });

  it("flags a malformed date", () => {
    const { rows, errors } = parseRecordsText("15/01/2026, 10");
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain("isn't a real date");
  });

  it("flags a date that would silently roll over into a different real date (e.g. Feb 30th)", () => {
    const { rows, errors } = parseRecordsText("2026-02-30, 10");
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain("isn't a real date");
  });

  it("flags a non-numeric value", () => {
    const { rows, errors } = parseRecordsText("2026-01-01, not-a-number");
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain("isn't a number");
  });

  it("flags a line with no separator at all", () => {
    const { errors } = parseRecordsText("just one field");
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });

  it("returns empty rows/errors for empty input", () => {
    expect(parseRecordsText("")).toEqual({ rows: [], errors: [] });
    expect(parseRecordsText("   \n  \n")).toEqual({ rows: [], errors: [] });
  });
});
