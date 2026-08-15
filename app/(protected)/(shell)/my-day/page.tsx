import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { MyDayHabits } from "@/components/my-day-habits";
import { MyDayGoals } from "@/components/my-day-goals";
import { getMyDayHabits, getMyDayGoals } from "@/lib/action-goals/data";

export default async function MyDayPage() {
  const [habits, goals] = await Promise.all([getMyDayHabits(), getMyDayGoals()]);

  return (
    <>
      <PageHeader title="My Day" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Habits">
          <MyDayHabits initialHabits={habits} />
        </Card>
        <Card title="Goals">
          <MyDayGoals initialGoals={goals} />
        </Card>
      </div>
    </>
  );
}
