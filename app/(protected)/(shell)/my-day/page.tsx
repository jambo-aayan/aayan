import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import pageStyles from "@/components/page-header.module.css";
import { PageTitle } from "@/components/page-title";
import { TodaySectionPills } from "@/components/nav-pills";
import { Card } from "@/components/card";
import { MyDayHabits } from "@/components/my-day-habits";
import { getHabitOccurrencesForDate } from "@/lib/habits/data";
import { getUpcomingSystemSteps } from "@/lib/systems/data";
import { HEALTH_PILLAR_ID } from "@/lib/health/seed-data";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./my-day.module.css";

const UPCOMING_WINDOW_DAYS = 14;

/** Only Health has a per-Area page today (`/health/[areaId]`); there's no
 * per-Pillar page yet either (`/pillars` is a flat index, no dynamic
 * route), so any other Pillar's System falls back to that index rather
 * than a link that would 404. Revisit once other Pillars grow real pages. */
function upcomingStepHref(step: { areaId: string | null; pillarId: string }): string {
  return step.areaId && step.pillarId === HEALTH_PILLAR_ID ? `/health/${step.areaId}` : "/pillars";
}

export default async function MyDayPage() {
  const now = new Date();
  const [habits, upcoming] = await Promise.all([
    getHabitOccurrencesForDate(now),
    getUpcomingSystemSteps(now, UPCOMING_WINDOW_DAYS),
  ]);
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
        {upcoming.length > 0 && (
          <Card title="Upcoming">
            <ul className={styles.upcomingList}>
              {upcoming.map((step) => (
                <li key={step.id} className={styles.upcomingRow}>
                  <span>{step.text}</span>
                  <span className={styles.upcomingMeta}>
                    {step.date.toISOString().slice(0, 10)} ·{" "}
                    <Link href={upcomingStepHref(step)}>{step.systemName}</Link>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </>
  );
}
