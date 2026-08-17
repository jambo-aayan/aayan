import { isSameUtcDay, utcMidnight } from "../habits/date-utils";

export type DueBadge = { label: string; variant: "overdue" | "today" | "normal" } | null;

/** The compact due-date label shown on a task row ("Today", "Tomorrow",
 * "Overdue · 12 Aug", "Fri, 21 Aug"), with a time suffix when dueTime is set. */
export function formatDueBadge(dueDate: Date | null, dueTime: string | null, today: Date): DueBadge {
  if (!dueDate) return null;

  const due = utcMidnight(dueDate);
  const todayMid = utcMidnight(today);
  const tomorrowMid = new Date(todayMid);
  tomorrowMid.setUTCDate(tomorrowMid.getUTCDate() + 1);

  const timeSuffix = dueTime ? ` · ${formatTime(dueTime)}` : "";

  if (due.getTime() < todayMid.getTime()) {
    return { label: `Overdue · ${formatShortDate(due)}${timeSuffix}`, variant: "overdue" };
  }
  if (isSameUtcDay(due, todayMid)) {
    return { label: `Today${timeSuffix}`, variant: "today" };
  }
  if (isSameUtcDay(due, tomorrowMid)) {
    return { label: `Tomorrow${timeSuffix}`, variant: "normal" };
  }
  return { label: `${formatShortDate(due)}${timeSuffix}`, variant: "normal" };
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
    date
  );
}

/** dueTime is stored as a plain "HH:mm" 24h string — format as "6:00pm". */
function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${period}` : `${hour12}:${String(m).padStart(2, "0")}${period}`;
}
