import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { TransactionFilters } from "@/components/transaction-filters";
import { TransactionBulkList } from "@/components/transaction-bulk-list";
import { getAccounts, getCategories, getTransactionsPage } from "@/lib/finance/data";
import styles from "./transactions.module.css";

/** A bounded window of page numbers around `current` — first, last,
 * current ±1, with an ellipsis gap where numbers are skipped. Keeps the
 * pagination bar a fixed, scannable width regardless of how many pages
 * a filtered view has. */
function pageNumbers(current: number, totalPages: number): (number | "…")[] {
  const pages = new Set([1, totalPages, current - 1, current, current + 1].filter((p) => p >= 1 && p <= totalPages));
  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let previous = 0;
  for (const p of sorted) {
    if (previous && p - previous > 1) result.push("…");
    result.push(p);
    previous = p;
  }
  return result;
}

function buildPageHref(params: Record<string, string | undefined>, page: number): string {
  const next = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) next.set(key, value);
  }
  if (page > 1) next.set("page", String(page));
  const qs = next.toString();
  return qs ? `/finances/transactions?${qs}` : "/finances/transactions";
}

type SearchParams = {
  categoryId?: string;
  accountId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: string;
  groupByStatement?: string;
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const groupByStatement = params.groupByStatement === "1";
  const page = Math.max(1, Number(params.page) || 1);

  const filters = {
    categoryId: params.categoryId,
    accountId: params.accountId,
    dateFrom: params.dateFrom,
    dateTo: params.dateTo,
    search: params.search,
    page,
    groupByStatement,
  };

  const [result, categories, accounts] = await Promise.all([
    getTransactionsPage(filters),
    getCategories(),
    getAccounts(),
  ]);

  return (
    <>
      <PageHeader title="Transactions" backHref="/finances" />
      <div className={pageStyles.content}>
        <Suspense fallback={null}>
          <TransactionFilters categories={categories} accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
        </Suspense>

        <Card>
          {/* Keyed on every param that changes which rows are shown —
              forces a full remount (fresh selection/hidden-rows state)
              on a page/filter change instead of carrying stale selected
              ids across to a completely different set of rows. */}
          <TransactionBulkList key={JSON.stringify(params)} result={result} filters={filters} />
          {result.mode === "flat" && result.total > result.pageSize && (
            <nav className={styles.pagination} aria-label="Transaction pages">
              {result.page > 1 && (
                <Link className={styles.pageLink} href={buildPageHref(params, result.page - 1)}>
                  ← Previous
                </Link>
              )}
              <span className={styles.pageNumbers}>
                {pageNumbers(result.page, Math.ceil(result.total / result.pageSize)).map((p, i) =>
                  p === "…" ? (
                    <span key={`ellipsis-${i}`} className={styles.pageEllipsis}>
                      …
                    </span>
                  ) : p === result.page ? (
                    <span key={p} className={styles.pageCurrent} aria-current="page">
                      {p}
                    </span>
                  ) : (
                    <Link key={p} className={styles.pageNumber} href={buildPageHref(params, p)}>
                      {p}
                    </Link>
                  )
                )}
              </span>
              {result.page * result.pageSize < result.total && (
                <Link className={styles.pageLink} href={buildPageHref(params, result.page + 1)}>
                  Next →
                </Link>
              )}
            </nav>
          )}
        </Card>
      </div>
    </>
  );
}
