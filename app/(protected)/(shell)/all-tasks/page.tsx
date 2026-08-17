import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { TaskFilters } from "@/components/tasks/task-filters";
import { AllTasksView } from "@/components/tasks/all-tasks-view";
import { getAllTasks, getTaskLists, getPillarOptions, getTaskTags, type TaskView } from "@/lib/tasks/data";

const VIEW_EMPTY_MESSAGE: Record<TaskView, string> = {
  active: "No active tasks — create one to get started.",
  completed: "No completed tasks yet.",
  archived: "Nothing archived.",
  today: "Nothing due today.",
  upcoming: "Nothing upcoming.",
  overdue: "Nothing overdue.",
  noDueDate: "No tasks without a due date.",
  important: "No important tasks yet.",
};

function isTaskView(value: string | undefined): value is TaskView {
  return !!value && value in VIEW_EMPTY_MESSAGE;
}

export default async function AllTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; listId?: string; pillarId?: string; tagId?: string }>;
}) {
  const params = await searchParams;
  const view: TaskView = isTaskView(params.view) ? params.view : "active";

  const [tasks, lists, pillars, tags] = await Promise.all([
    getAllTasks({
      view,
      listId: params.listId || undefined,
      pillarId: params.pillarId || undefined,
      tagId: params.tagId || undefined,
    }),
    getTaskLists(),
    getPillarOptions(),
    getTaskTags(),
  ]);

  return (
    <>
      <PageHeader title="All Tasks" backHref="/today" />
      <div className={pageStyles.content}>
        <Suspense fallback={null}>
          <TaskFilters lists={lists} pillars={pillars} tags={tags} />
        </Suspense>
        <Card>
          {/* AllTasksView holds its own optimistic task-list state, which only
              seeds from `tasks` on mount — without a key tied to the active
              filters, changing the view/list/pillar/tag select would navigate
              to fresh server data but the already-mounted client component
              would keep showing its stale local state. */}
          <AllTasksView
            key={`${view}:${params.listId ?? ""}:${params.pillarId ?? ""}:${params.tagId ?? ""}`}
            tasks={tasks}
            lists={lists}
            pillars={pillars}
            tagSuggestions={tags.map((t) => t.name)}
            emptyMessage={VIEW_EMPTY_MESSAGE[view]}
          />
        </Card>
      </div>
    </>
  );
}
