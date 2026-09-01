import { describe, expect, it } from "vitest";
import { readCells, stripCell, withCell } from "./table-data";

describe("readCells", () => {
  it("returns the object as-is when data is a plain object", () => {
    expect(readCells({ col1: "hi" })).toEqual({ col1: "hi" });
  });

  it("returns an empty object for null/non-object data", () => {
    expect(readCells(null)).toEqual({});
    expect(readCells(undefined)).toEqual({});
    expect(readCells("not an object")).toEqual({});
    expect(readCells(42)).toEqual({});
  });
});

describe("stripCell", () => {
  it("removes the given column's key, leaving the rest untouched", () => {
    expect(stripCell({ col1: "a", col2: "b" }, "col1")).toEqual({ col2: "b" });
  });

  it("is a no-op when the key isn't present", () => {
    expect(stripCell({ col2: "b" }, "col1")).toEqual({ col2: "b" });
  });

  it("returns an empty object for null/non-object data", () => {
    expect(stripCell(null, "col1")).toEqual({});
  });
});

describe("withCell", () => {
  it("sets a new key without disturbing existing ones", () => {
    expect(withCell({ col1: "a" }, "col2", "b")).toEqual({ col1: "a", col2: "b" });
  });

  it("overwrites an existing key", () => {
    expect(withCell({ col1: "a" }, "col1", "z")).toEqual({ col1: "z" });
  });

  it("starts from an empty object for null/non-object data", () => {
    expect(withCell(null, "col1", "a")).toEqual({ col1: "a" });
  });
});
