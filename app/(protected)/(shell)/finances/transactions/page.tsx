import { Suspense } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { TransactionFilters } from "@/components/transaction-filters";
import { getAccounts, getCategories, getTransactionsPage } from "@/lib/finance/data";
import { formatGBP } from "@/lib/finance/format";
import styles from "./transactions.module.css";

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

type TransactionRow = {
  id: string;
  date: Date;
  amount: number;
  direction: "IN" | "OUT";
  source: string | null;
  category: string;
  accountName: string | null;
};

function Row({ t }: { t: TransactionRow }) {
  return (
    <li className={styles.row}>
      <div className={styles.info}>
        <div className={styles.category}>
          {t.category}
          {t.source && <span className={styles.source}> · {t.source}</span>}
        </div>
        <div className={styles.date}>
          {formatDate(t.date)}
          {t.accountName && ` · ${t.accountName}`}
        </div>
      </div>
      <span className={t.direction === "IN" ? styles.amtPos : styles.amtNeutral}>
        {t.direction === "IN" ? "+" : "−"}
        {formatGBP(t.amount)}
      </span>
    </li>
  );
}

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

  const [result, categories, accounts] = await Promise.all([
    getTransactionsPage({
      categoryId: params.categoryId,
      accountId: params.accountId,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      search: params.search,
      page,
      groupByStatement,
    }),
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
          {result.mode === "byStatement" ? (
            <div className={styles.statementGroups}>
              {result.statements.map((s) => (
                <details key={s.id} className={styles.statementGroup} open>
                  <summary className={styles.statementHead}>
                    {s.name} <span className={styles.statementMeta}>· {s.accountName} · {s.transactions.length} transactions</span>
                  </summary>
                  <ul className={styles.list}>
                    {s.transactions.map((t) => (
                      <Row key={t.id} t={t} />
                    ))}
                  </ul>
                </details>
              ))}
              {result.statements.length === 0 && <p className={styles.muted}>No transactions match these filters.</p>}
            </div>
          ) : (
            <>
              <ul className={styles.list}>
                {result.transactions.map((t) => (
                  <Row key={t.id} t={t} />
                ))}
                {result.transactions.length === 0 && <li className={styles.muted}>No transactions match these filters.</li>}
              </ul>
              {result.total > result.pageSize && (
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
            </>
          )}
        </Card>
      </div>
    </>
  );
}
