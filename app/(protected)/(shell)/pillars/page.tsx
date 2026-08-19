import Link from "next/link";
import { HeartPulse, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { IconBadge } from "@/components/icon-badge";
import { PillarColorPicker } from "@/components/pillar-color-picker";
import { PillarsSectionPills } from "@/components/nav-pills";
import { getPillarOptions } from "@/lib/tasks/data";
import { HEALTH_PILLAR_ID } from "@/lib/health/seed-data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./pillars.module.css";

export default async function PillarsPage() {
  const pillars = await getPillarOptions();
  const health = pillars.find((p) => p.id === HEALTH_PILLAR_ID);
  const healthHex = resolveColorHex(health?.color as ColorKey | null);

  return (
    <>
      <PageHeader title="Your pillars" backHref="/today" />
      <div className={pageStyles.content}>
        <div className={styles.tiles}>
          <div className={`${styles.tile} ${styles.health}`}>
            <Link href="/health" className={styles.tileLink}>
              <IconBadge icon={HeartPulse} accent="health" size={40} colorOverride={healthHex} />
              <div>
                <div className={styles.name} style={healthHex ? { color: healthHex } : undefined}>
                  Health
                </div>
                <div className={styles.hint}>Habits, Areas, and Pain &amp; Mobility tracking</div>
              </div>
            </Link>
            {health && <PillarColorPicker pillarId={health.id} initialColor={health.color} />}
          </div>
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
