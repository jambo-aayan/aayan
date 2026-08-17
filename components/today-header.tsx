import styles from "./today-header.module.css";

function greeting(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export function TodayHeader({ name, now }: { name: string; now: Date }) {
  const dateLabel = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(now);

  return (
    <div className={styles.header}>
      <div>
        <h1 className={styles.greeting}>
          {greeting(now.getHours())}, {name}
        </h1>
        <p className={styles.sub}>Focus on what matters today.</p>
      </div>
      <div className={styles.date}>{dateLabel}</div>
    </div>
  );
}
