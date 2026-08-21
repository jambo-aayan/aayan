import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { Card } from "@/components/card";
import { MyDayHabits } from "@/components/my-day-habits";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";

export default async function MyDayPage() {
  const habits = await getHabitOccurrencesForDate(new Date());
  const myDayHabits = habits.map((h) => ({
    id: h.id,
    areaId: h.areaId,
    name: h.name,
    areaName: h.areaName,
    todayLevel: h.todayLevel,
    pillarColor: resolveColorHex(h.pillarColor as ColorKey | null),
  }));

  return (
    <>
      <PageHeader title="My Day habits" backHref="/today" />
      <div className={pageStyles.content}>
        <Card title="Today's habits">
          <MyDayHabits initialHabits={myDayHabits} />
        </Card>
      </div>
    </>
  );
}
