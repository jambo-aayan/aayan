import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { LogoutButton } from "@/components/logout-button";
import { SettingsToggles } from "@/components/settings-toggles";
import { CategoryManager } from "@/components/category-manager";
import { FinanceReset } from "@/components/finance-reset";
import { getAppSettings } from "@/lib/settings/data";
import { getCategories } from "@/lib/finance/data";
import styles from "./settings.module.css";

export default async function SettingsPage() {
  const [settings, categories] = await Promise.all([getAppSettings(), getCategories()]);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Account" title="Settings" />
        <Card title="Session">
          <LogoutButton />
        </Card>
        <Card title="Behavior">
          <SettingsToggles initialSettings={settings} />
        </Card>
        <Card title="Categories">
          <CategoryManager categories={categories} />
        </Card>
        <Card title="Danger zone">
          <FinanceReset />
        </Card>
        <Link href="/weekly-review" className={styles.reviewLink}>
          <div>
            <div className={styles.reviewLinkTitle}>Weekly review</div>
            <div className={styles.reviewLinkNote}>5 steps · about 6 minutes</div>
          </div>
          <span>→</span>
        </Link>
      </div>
    </>
  );
}
