import pageStyles from "@/components/page-header.module.css";
import { PageHeader } from "@/components/page-header";
import { PageTitle } from "@/components/page-title";
import { Card } from "@/components/card";
import { DailyLogForm, type DailyLogFormInitial } from "@/components/daily-log-form";
import { getDailyLog } from "@/lib/daily-log/data";

const DEFAULT_SCALE_VALUE = 3;

export default async function LogTodayPage() {
  const now = new Date();
  const existing = await getDailyLog(now);

  const initial: DailyLogFormInitial = existing
    ? {
        date: now,
        mood: existing.mood,
        stress: existing.stress,
        energy: existing.energy,
        sleepQuality: existing.sleepQuality,
        pain: existing.pain,
        headache: existing.headache,
        stiffnessBucket: existing.stiffnessBucket,
        weight: existing.weight,
        waist: existing.waist,
        bpSystolic: existing.bpSystolic,
        bpDiastolic: existing.bpDiastolic,
      }
    : {
        date: now,
        mood: DEFAULT_SCALE_VALUE,
        stress: DEFAULT_SCALE_VALUE,
        energy: DEFAULT_SCALE_VALUE,
        sleepQuality: DEFAULT_SCALE_VALUE,
        pain: DEFAULT_SCALE_VALUE,
        headache: "NONE",
        stiffnessBucket: null,
        weight: null,
        waist: null,
        bpSystolic: null,
        bpDiastolic: null,
      };

  return (
    <>
      <PageHeader backHref="/today" />
      <div className={pageStyles.content}>
        <PageTitle eyebrow="Today" title="Log today" />
        <Card>
          <DailyLogForm initial={initial} />
        </Card>
      </div>
    </>
  );
}
