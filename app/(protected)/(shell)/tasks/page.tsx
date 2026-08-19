import { Suspense } from "react";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { TaskFilters } from "@/components/tasks/task-filters";
import { AllTasksView } from "@/components/tasks/all-tasks-view";
import { TasksSidebar } from "@/components/tasks/tasks-sidebar";
import { getAllTasks, getTaskLists, getPillarOptions, getAreaOptions, getTaskTags, type TaskView } from "@/lib/tasks/data";
import { getGoalOptions } from "@/lib/goals/data";
import layoutStyles from "./tasks.module.css";

const VIEW_EMPTY_MESSAGE: Record<TaskView, string> = {
  active: "No tasks here yet — create one to get started.",
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

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; listId?: string; pillarId?: string; areaId?: string; goalId?: string; tagId?: string }>;
}) {
  const params = await searchParams;
  const view: TaskView = isTaskView(params.view) ? params.view : "active";

  const [tasks, lists, pillars, areas, goals, tags] = await Promise.all([
    getAllTasks({
      view,
      listId: params.listId || undefined,
      pillarId: params.pillarId || undefined,
      areaId: params.areaId || undefined,
      goalId: params.goalId || undefined,
      tagId: params.tagId || undefined,
    }),
    getTaskLists(),
    getPillarOptions(),
    getAreaOptions(),
    getGoalOptions(),
    getTaskTags(),
  ]);

  const activeList = params.listId ? lists.find((l) => l.id === params.listId) : undefined;
  const title = activeList ? activeList.name : view === "completed" ? "Completed" : view === "important" ? "Important" : "All Tasks";
  const emptyMessage = activeList ? `No tasks in ${activeList.name} yet.` : VIEW_EMPTY_MESSAGE[view];

  return (
    <>
      <PageHeader title="Tasks" backHref="/today" />
      <div className={pageStyles.content}>
        <div className={layoutStyles.layout}>
          <div className={layoutStyles.sidebarCol}>
            <TasksSidebar lists={lists} />
          </div>
          <div className={layoutStyles.mainCol}>
            <Suspense fallback={null}>
              <TaskFilters lists={[]} pillars={pillars} areas={areas} goals={goals} tags={tags} />
            </Suspense>
            <Card title={title}>
              <AllTasksView
                key={`${view}:${params.listId ?? ""}:${params.pillarId ?? ""}:${params.areaId ?? ""}:${params.goalId ?? ""}:${params.tagId ?? ""}`}
                tasks={tasks}
                lists={lists}
                pillars={pillars}
                areas={areas}
                goals={goals}
                tagSuggestions={tags.map((t) => t.name)}
                emptyMessage={emptyMessage}
                activeListId={params.listId}
              />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
