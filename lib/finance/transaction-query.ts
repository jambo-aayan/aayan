import type { CategoryOption } from "./categories";

export type TransactionFilters = {
  categoryId?: string;
  accountId?: string;
  dateFrom?: string; // YYYY-MM-DD
  dateTo?: string; // YYYY-MM-DD
  search?: string;
  page?: number;
  groupByStatement?: boolean;
};

export type TransactionWhere = {
  categoryId?: string | { in: string[] };
  accountId?: string;
  date?: { gte?: Date; lte?: Date };
  source?: { contains: string; mode: "insensitive" };
};

export const TRANSACTIONS_PAGE_SIZE = 50;

export type TransactionQuery =
  | { mode: "flat"; where: TransactionWhere; orderBy: { date: "desc" }; skip: number; take: number }
  | { mode: "byStatement"; where: TransactionWhere; orderBy: { date: "desc" } };

/** The filters-to-Prisma-where translation, exported on its own so a
 * caller that needs every matching id (not a paginated/grouped fetch of
 * the full rows — the transaction list's own "Select all N matching"
 * button, lib/finance/actions.ts's getMatchingTransactionIds) can reuse
 * the exact same filter logic without going through buildTransactionQuery's
 * two-mode split.
 *
 * `categories` (default `[]`, so every existing caller/test that doesn't
 * pass it keeps working unchanged) is only needed to resolve `categoryId`
 * when it names a top-level category (#176) — a Transaction only ever
 * carries a leaf categoryId (see ADR-0015's #173 addendum), so filtering
 * by a parent means "any of its children," expressed as an `in` filter
 * over their ids. When `categoryId` already names a leaf (or `categories`
 * wasn't given, e.g. because the caller already knows it's a leaf), it's
 * used as an exact match, same as before #176. */
export function buildWhere(filters: TransactionFilters, categories: CategoryOption[] = []): TransactionWhere {
  const where: TransactionWhere = {};
  if (filters.categoryId) {
    const childIds = categories.filter((c) => c.parentId === filters.categoryId).map((c) => c.id);
    where.categoryId = childIds.length > 0 ? { in: childIds } : filters.categoryId;
  }
  if (filters.accountId) where.accountId = filters.accountId;
  if (filters.dateFrom || filters.dateTo) {
    where.date = {};
    if (filters.dateFrom) where.date.gte = new Date(`${filters.dateFrom}T00:00:00.000Z`);
    if (filters.dateTo) where.date.lte = new Date(`${filters.dateTo}T00:00:00.000Z`);
  }
  const search = filters.search?.trim();
  if (search) where.source = { contains: search, mode: "insensitive" };
  return where;
}

/** Maps the transaction list's URL-driven filter state to a Prisma-ready
 * query shape (#150, ADR-0015) — the searchParams-to-query translation
 * kept testable without touching the DB, matching the same
 * searchParams-prop-plus-client-filter-component pattern already used by
 * Goals/Habits/Tasks. Two modes rather than one shape, because pagination
 * and statement-grouping don't mix cleanly: a flat page-by-page list
 * (skip/take over Transactions) vs. every matching Transaction grouped by
 * its Statement (no transaction-level pagination — there are far fewer
 * Statements than Transactions, so fetching every filtered row and
 * grouping it is the simpler, still-bounded option). Filters apply
 * identically in both modes. */
export function buildTransactionQuery(filters: TransactionFilters, categories: CategoryOption[] = []): TransactionQuery {
  const where = buildWhere(filters, categories);
  const orderBy = { date: "desc" as const };
  if (filters.groupByStatement) return { mode: "byStatement", where, orderBy };
  const page = Math.max(1, filters.page ?? 1);
  return { mode: "flat", where, orderBy, skip: (page - 1) * TRANSACTIONS_PAGE_SIZE, take: TRANSACTIONS_PAGE_SIZE };
}
