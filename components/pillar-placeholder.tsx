import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import styles from "./pillar-placeholder.module.css";

export function PillarPlaceholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className={pageStyles.content}>
        <div className={styles.card}>{subtitle}</div>
      </div>
    </>
  );
}
