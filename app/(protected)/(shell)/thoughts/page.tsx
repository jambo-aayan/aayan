import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { TodaySectionPills } from "@/components/nav-pills";
import { ThoughtsComposer } from "@/components/thoughts/thoughts-composer";
import { ThoughtsList } from "@/components/thoughts/thoughts-list";
import { getAllThoughts, getTagOptions } from "@/lib/thoughts/data";
import styles from "./thoughts.module.css";

export default async function ThoughtsPage() {
  const [thoughts, tagOptions] = await Promise.all([getAllThoughts(), getTagOptions()]);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Journal" title="Thoughts" />
        <div className={styles.pillsWrap}>
          <TodaySectionPills />
        </div>
        <div className={styles.composerWrap}>
          <ThoughtsComposer tagOptions={tagOptions} />
        </div>
        <ThoughtsList initialThoughts={thoughts} />
      </div>
    </>
  );
}
