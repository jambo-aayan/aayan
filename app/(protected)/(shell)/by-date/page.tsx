import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { TodaySectionPills } from "@/components/nav-pills";
import { Card } from "@/components/card";
import { ByDateTasks } from "@/components/tasks/by-date-tasks";
import { getActiveTasksForByDate, getTaskLists, getPillarOptions, getAreaOptions, getTaskTags } from "@/lib/tasks/data";
import { getGoalOptions } from "@/lib/goals/data";
import styles from "./by-date.module.css";

export default async function ByDatePage() {
  const [tasks, lists, pillars, areas, goals, tags] = await Promise.all([
    getActiveTasksForByDate(),
    getTaskLists(),
    getPillarOptions(),
    getAreaOptions(),
    getGoalOptions(),
    getTaskTags(),
  ]);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="All tasks" title="By date" />
        <div className={styles.pillsWrap}>
          <TodaySectionPills />
        </div>
        <Card>
          <ByDateTasks
            initialTasks={tasks}
            lists={lists}
            pillars={pillars}
            areas={areas}
            goals={goals}
            tagSuggestions={tags.map((t) => t.name)}
          />
        </Card>
      </div>
    </>
  );
}
