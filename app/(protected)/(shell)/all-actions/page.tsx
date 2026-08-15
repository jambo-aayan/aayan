import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { AllActionsList } from "@/components/all-actions-list";
import { getAllActionsGoals } from "@/lib/action-goals/data";

export default async function AllActionsPage() {
  const goals = await getAllActionsGoals();

  return (
    <>
      <PageHeader title="All Actions" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Backlog goals">
          <AllActionsList goals={goals} />
        </Card>
      </div>
    </>
  );
}
