import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { PillarCard } from "@/components/pillar-card";
import { NewPillarTile } from "@/components/new-pillar-tile";
import { PillarsSectionPills } from "@/components/nav-pills";
import { getPillarsWithStats } from "@/lib/pillars/data";
import styles from "./pillars.module.css";

export default async function PillarsPage() {
  const pillars = await getPillarsWithStats();

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle
          eyebrow="Structure"
          title="Pillars"
          lede="Each pillar tints its own areas, checkboxes and pills."
        />

        <div className={styles.tiles}>
          {pillars.map((pillar) => (
            <PillarCard key={pillar.id} pillar={pillar} />
          ))}
          <NewPillarTile />
        </div>

        <div className={styles.pillsWrap}>
          <PillarsSectionPills />
        </div>
      </div>
    </>
  );
}
