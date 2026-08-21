import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { TodaySectionPills } from "@/components/nav-pills";
import { Card } from "@/components/card";
import { MyDayHabits } from "@/components/my-day-habits";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./my-day.module.css";

export default async function MyDayPage() {
  const now = new Date();
  const habits = await getHabitOccurrencesForDate(now);
  const myDayHabits = habits.map((h) => ({
    id: h.id,
    areaId: h.areaId,
    name: h.name,
    areaName: h.areaName,
    todayLevel: h.todayLevel,
    pillarColor: resolveColorHex(h.pillarColor as ColorKey | null),
  }));
  const doneCount = myDayHabits.filter((h) => h.todayLevel !== null).length;
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle
          eyebrow={dateLabel}
          title="Check in"
          lede={`Just today's habits, nothing else. ${doneCount}/${myDayHabits.length} done.`}
        />
        <div className={styles.pillsWrap}>
          <TodaySectionPills />
        </div>
        <Card title="Today's habits">
          <MyDayHabits initialHabits={myDayHabits} />
        </Card>
      </div>
    </>
  );
}
