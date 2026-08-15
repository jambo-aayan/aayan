import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import styles from "./pillars.module.css";

export default function PillarsPage() {
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
      </div>
    </>
  );
}
