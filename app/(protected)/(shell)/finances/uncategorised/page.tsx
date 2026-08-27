import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { UncategorisedQueue } from "@/components/uncategorised-queue";
import { getGoals, getUncategorisedTransactions } from "@/lib/finance/data";

export default async function UncategorisedPage() {
  const [transactions, goals] = await Promise.all([getUncategorisedTransactions(), getGoals()]);
  const items = transactions.map((t) => ({
    id: t.id,
    date: t.date,
    amount: t.amount,
    direction: t.direction,
    category: t.category,
    source: t.source,
    accountName: t.account?.name ?? null,
  }));

  return (
    <>
      <PageHeader title="Uncategorised" backHref="/finances" />
      <div className={pageStyles.content}>
        <Card title="Held for review">
          <UncategorisedQueue initialTransactions={items} goals={goals} />
        </Card>
      </div>
    </>
  );
}
