import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { CompareView } from "@/components/statements/compare-view";
import { StatementList } from "@/components/statement-list";
import styles from "./statements.module.css";
import { getAccounts, getBaseline, getReceivables, getStatements, getTransactions } from "@/lib/finance/data";
import { categoryBreakdown } from "@/lib/finance/category-breakdown";
import {
  accountFreshness,
  categoryTimeSeries,
  detectAnomalies,
  detectRecurringCharges,
  monthOverMonthDiff,
  savingsRate,
  topMerchants,
} from "@/lib/finance/statements";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function formatMonth(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

const STALE_DAYS = 45;
const TIME_SERIES_MONTHS = 6;

function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);
}

/** The last `count` calendar months, oldest first, ending with `from`'s
 * own month — a plain date-arithmetic loop, not business logic, so it's
 * inlined here rather than in the pure-logic module. */
function lastMonths(from: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - (count - 1 - i), 1))
  );
}

export default async function StatementsPage() {
  const today = new Date();
  const thisMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));

  const [accounts, baseline, transactions, receivables, statements] = await Promise.all([
    getAccounts(),
    getBaseline(),
    getTransactions(),
    getReceivables(),
    getStatements(),
  ]);
  const statementItems = statements.map((s) => ({
    id: s.id,
    name: s.name,
    accountName: s.account.name,
    uploadedAt: s.uploadedAt,
  }));

  // Overview
  const diff = monthOverMonthDiff(transactions, thisMonth, lastMonth);
  const composition = categoryBreakdown(transactions, thisMonth);
  const compositionTotal = composition.reduce((sum, c) => sum + c.total, 0);
  const rate = savingsRate(baseline.monthlyIncome, diff.currentTotal);

  // Detail
  const timeSeriesMonths = lastMonths(thisMonth, TIME_SERIES_MONTHS);
  const timeSeries = categoryTimeSeries(transactions, timeSeriesMonths);
  const merchants = topMerchants(transactions, 8);
  const recurring = detectRecurringCharges(transactions);
  const anomalyIds = new Set(detectAnomalies(transactions));
  const anomalies = transactions.filter((t) => anomalyIds.has(t.id));

  // Uploads
  const freshness = accountFreshness(
    accounts.map((a) => ({ id: a.id, name: a.name, lastUpdated: a.lastSnapshotDate })),
    today,
    STALE_DAYS
  );

  // Receivables
  const openReceivables = receivables.filter((r) => r.status === "OPEN");
  const settledReceivables = receivables.filter((r) => r.status === "SETTLED");

  return (
    <>
      <PageHeader title="Statements" backHref="/finances" />
      <div className={pageStyles.content}>
        <Card title="Overview">
          <div className={styles.calloutRow}>
            <div className={styles.callout}>
              <div className={styles.calloutLabel}>{formatMonth(thisMonth)} spend</div>
              <div className={styles.calloutValue}>{formatGBP(diff.currentTotal)}</div>
              <div className={styles.calloutMeta}>
                {diff.diffPercent === null
                  ? `${formatGBP(diff.diffAmount)} vs last month`
                  : `${diff.diffPercent > 0 ? "+" : ""}${diff.diffPercent.toFixed(1)}% vs last month`}
              </div>
            </div>
            <div className={styles.callout}>
              <div className={styles.calloutLabel}>Savings rate</div>
              <div className={styles.calloutValue}>{rate === null ? "—" : `${rate.toFixed(1)}%`}</div>
              <div className={styles.calloutMeta}>{rate === null ? "No income set" : "of monthly income"}</div>
            </div>
          </div>
          <div className={styles.sectionLabel}>Category composition</div>
          <ul className={styles.list}>
            {composition.map((c) => (
              <li key={c.category} className={styles.row}>
                <span>{c.category}</span>
                <span className={styles.muted}>
                  {formatGBP(c.total)} ({compositionTotal === 0 ? 0 : Math.round((c.total / compositionTotal) * 100)}%)
                </span>
              </li>
            ))}
            {composition.length === 0 && <li className={styles.muted}>No spend this month.</li>}
          </ul>
        </Card>

        <Card title="Detail">
          <div className={styles.sectionLabel}>Per-category time series</div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Category</th>
                  {timeSeriesMonths.map((m) => (
                    <th key={m.toISOString()}>{formatMonthShort(m)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSeries.map((row) => (
                  <tr key={row.category}>
                    <td>{row.category}</td>
                    {row.totals.map((total, i) => (
                      <td key={timeSeriesMonths[i].toISOString()}>{formatGBP(total)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {timeSeries.length === 0 && <p className={styles.muted}>No spend in this window.</p>}
          </div>

          <div className={styles.sectionLabel}>Per-account balances</div>
          <ul className={styles.list}>
            {accounts.map((a) => (
              <li key={a.id} className={styles.row}>
                <span>{a.name}</span>
                <span className={styles.muted}>{formatGBP(a.value)}</span>
              </li>
            ))}
          </ul>

          <div className={styles.sectionLabel}>Top merchants</div>
          <ul className={styles.list}>
            {merchants.map((m) => (
              <li key={m.source} className={styles.row}>
                <span>{m.source}</span>
                <span className={styles.muted}>
                  {formatGBP(m.total)} ({m.count})
                </span>
              </li>
            ))}
            {merchants.length === 0 && <li className={styles.muted}>No spend yet.</li>}
          </ul>

          <div className={styles.sectionLabel}>Recurring charges</div>
          <ul className={styles.list}>
            {recurring.map((r) => (
              <li key={`${r.source}-${r.amount}`} className={styles.row}>
                <span>{r.source}</span>
                <span className={styles.muted}>
                  {formatGBP(r.amount)} · {r.occurrences} months
                </span>
              </li>
            ))}
            {recurring.length === 0 && <li className={styles.muted}>None detected.</li>}
          </ul>

          <div className={styles.sectionLabel}>Anomalies</div>
          <ul className={styles.list}>
            {anomalies.map((t) => (
              <li key={t.id} className={styles.row}>
                <span>
                  {t.category}
                  {t.source && ` · ${t.source}`}
                </span>
                <span className={styles.muted}>
                  {formatGBP(t.amount)} · {formatDate(t.date)}
                </span>
              </li>
            ))}
            {anomalies.length === 0 && <li className={styles.muted}>Nothing unusual.</li>}
          </ul>
        </Card>

        <Card title="Compare">
          <CompareView transactions={transactions} today={today} />
        </Card>

        <Card title="Uploads">
          <ul className={styles.list}>
            {freshness.map((a) => (
              <li key={a.id} className={styles.row}>
                <span>{a.name}</span>
                <span className={styles.muted}>
                  {a.lastUpdated ? formatDate(a.lastUpdated) : "Never updated"}
                  {a.stale && <span className={styles.badge}>It&rsquo;s been a while</span>}
                </span>
              </li>
            ))}
            {freshness.length === 0 && <li className={styles.muted}>No accounts yet.</li>}
          </ul>
        </Card>

        <Card title="Statements">
          <StatementList initialStatements={statementItems} />
        </Card>

        <Card title="Receivables">
          <div className={styles.sectionLabel}>Open</div>
          <ul className={styles.list}>
            {openReceivables.map((r) => (
              <li key={r.id} className={styles.row}>
                <span>
                  {formatGBP(r.amount)}
                  {r.note && ` · ${r.note}`}
                </span>
                <span className={styles.muted}>Opened {formatDate(r.openedAt)}</span>
              </li>
            ))}
            {openReceivables.length === 0 && <li className={styles.muted}>None open.</li>}
          </ul>
          <div className={styles.sectionLabel}>Settled</div>
          <ul className={styles.list}>
            {settledReceivables.map((r) => (
              <li key={r.id} className={styles.row}>
                <span>
                  {formatGBP(r.amount)}
                  {r.note && ` · ${r.note}`}
                </span>
                <span className={styles.muted}>{r.settledAt && `Settled ${formatDate(r.settledAt)}`}</span>
              </li>
            ))}
            {settledReceivables.length === 0 && <li className={styles.muted}>None settled yet.</li>}
          </ul>
        </Card>
      </div>
    </>
  );
}
