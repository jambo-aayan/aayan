import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { ThoughtQuickAdd } from "@/components/thoughts/thought-quick-add";
import { getTagOptions } from "@/lib/thoughts/data";
import styles from "./pillars.module.css";

export default async function PillarsPage() {
  const tagOptions = await getTagOptions();

  return (
    <>
      <PageHeader title="Your pillars" />
      <div className={pageStyles.content}>
        <div className={styles.tiles}>
          <Link href="/health" className={`${styles.tile} ${styles.health}`}>
            <div className={styles.name}>Health</div>
            <div className={styles.hint}>Habits, Areas, and Pain &amp; Mobility tracking</div>
          </Link>
          <Link href="/finances" className={`${styles.tile} ${styles.finance}`}>
            <div className={styles.name}>Finances</div>
            <div className={styles.hint}>Net worth, Goals, and Transactions</div>
          </Link>
        </div>
        <div className={styles.crossCutting}>
          <Link href="/my-day" className={styles.crossLink}>
            My Day
          </Link>
          <Link href="/all-actions" className={styles.crossLink}>
            All Actions
          </Link>
          <Link href="/thoughts" className={styles.crossLink}>
            Thoughts
          </Link>
        </div>
        <Card title="Quick thought">
          <ThoughtQuickAdd tagOptions={tagOptions} />
        </Card>
      </div>
    </>
  );
}
