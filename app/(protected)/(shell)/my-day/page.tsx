import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { MyDayHabits } from "@/components/my-day-habits";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";

export default async function MyDayPage() {
  const habits = await getHabitOccurrencesForDate(new Date());

  return (
    <>
      <PageHeader title="My Day habits" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Today's habits">
          <MyDayHabits initialHabits={habits} />
        </Card>
      </div>
    </>
  );
}
