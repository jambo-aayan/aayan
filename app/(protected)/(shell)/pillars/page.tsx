import Link from "next/link";
import { HeartPulse, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { IconBadge } from "@/components/icon-badge";
import { PillarsSectionPills } from "@/components/nav-pills";
import styles from "./pillars.module.css";

export default function PillarsPage() {
  return (
    <>
      <PageHeader title="Your pillars" backHref="/today" />
      <div className={pageStyles.content}>
        <div className={styles.tiles}>
          <Link href="/health" className={`${styles.tile} ${styles.health}`}>
            <IconBadge icon={HeartPulse} accent="health" size={40} />
            <div>
              <div className={styles.name}>Health</div>
              <div className={styles.hint}>Habits, Areas, and Pain &amp; Mobility tracking</div>
            </div>
          </Link>
          <Link href="/finances" className={`${styles.tile} ${styles.finance}`}>
            <IconBadge icon={Wallet} accent="finance" size={40} />
            <div>
              <div className={styles.name}>Finances</div>
              <div className={styles.hint}>Net worth, Goals, and Transactions</div>
            </div>
          </Link>
        </div>
        <div className={styles.pillsWrap}>
          <PillarsSectionPills />
        </div>
      </div>
    </>
  );
}
