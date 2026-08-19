import { redirect } from "next/navigation";

/** All Actions (the old ActionGoal-backed backlog) is superseded by All
 * Tasks — every ActionGoal row was migrated into Task (see migration
 * 20260819115616_tasks_v2_habits_goals). Kept as a redirect rather than a
 * 404 so any old bookmark/link still lands somewhere useful. */
export default function AllActionsPage() {
  redirect("/tasks");
}
