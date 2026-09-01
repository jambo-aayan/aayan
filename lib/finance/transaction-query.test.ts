import { describe, expect, it } from "vitest";
import { buildTransactionQuery, TRANSACTIONS_PAGE_SIZE } from "./transaction-query";

describe("buildTransactionQuery", () => {
  it("returns an unfiltered flat query by default", () => {
    const query = buildTransactionQuery({});
    expect(query.mode).toBe("flat");
    expect(query.where).toEqual({});
    expect(query.orderBy).toEqual({ date: "desc" });
    if (query.mode === "flat") {
      expect(query.skip).toBe(0);
      expect(query.take).toBe(TRANSACTIONS_PAGE_SIZE);
    }
  });

  it("filters by category alone", () => {
    const query = buildTransactionQuery({ categoryId: "cat-1" });
    expect(query.where).toEqual({ categoryId: "cat-1" });
  });

  it("filters by account alone", () => {
    const query = buildTransactionQuery({ accountId: "acc-1" });
    expect(query.where).toEqual({ accountId: "acc-1" });
  });

  it("filters by date range alone", () => {
    const query = buildTransactionQuery({ dateFrom: "2026-08-01", dateTo: "2026-08-31" });
    expect(query.where).toEqual({
      date: { gte: new Date("2026-08-01T00:00:00.000Z"), lte: new Date("2026-08-31T00:00:00.000Z") },
    });
  });

  it("filters by an open-ended date range (from only)", () => {
    const query = buildTransactionQuery({ dateFrom: "2026-08-01" });
    expect(query.where).toEqual({ date: { gte: new Date("2026-08-01T00:00:00.000Z") } });
  });

  it("filters by an open-ended date range (to only)", () => {
    const query = buildTransactionQuery({ dateTo: "2026-08-31" });
    expect(query.where).toEqual({ date: { lte: new Date("2026-08-31T00:00:00.000Z") } });
  });

  it("filters by free-text search on the description alone", () => {
    const query = buildTransactionQuery({ search: "coffee" });
    expect(query.where).toEqual({ source: { contains: "coffee", mode: "insensitive" } });
  });

  it("trims and ignores a blank search string", () => {
    const query = buildTransactionQuery({ search: "   " });
    expect(query.where).toEqual({});
  });

  it("combines every filter dimension at once", () => {
    const query = buildTransactionQuery({
      categoryId: "cat-1",
      accountId: "acc-1",
      dateFrom: "2026-08-01",
      dateTo: "2026-08-31",
      search: "coffee",
    });
    expect(query.where).toEqual({
      categoryId: "cat-1",
      accountId: "acc-1",
      date: { gte: new Date("2026-08-01T00:00:00.000Z"), lte: new Date("2026-08-31T00:00:00.000Z") },
      source: { contains: "coffee", mode: "insensitive" },
    });
  });

  it("paginates: page 2 skips one page's worth of rows", () => {
    const query = buildTransactionQuery({ page: 2 });
    if (query.mode === "flat") {
      expect(query.skip).toBe(TRANSACTIONS_PAGE_SIZE);
      expect(query.take).toBe(TRANSACTIONS_PAGE_SIZE);
    }
  });

  it("clamps a page below 1 to page 1", () => {
    const query = buildTransactionQuery({ page: 0 });
    if (query.mode === "flat") expect(query.skip).toBe(0);
    const negative = buildTransactionQuery({ page: -5 });
    if (negative.mode === "flat") expect(negative.skip).toBe(0);
  });

  it("switches to statement-grouped mode with no pagination, filters still applied", () => {
    const query = buildTransactionQuery({ groupByStatement: true, categoryId: "cat-1" });
    expect(query.mode).toBe("byStatement");
    expect(query.where).toEqual({ categoryId: "cat-1" });
    expect(query).not.toHaveProperty("skip");
    expect(query).not.toHaveProperty("take");
  });
});
