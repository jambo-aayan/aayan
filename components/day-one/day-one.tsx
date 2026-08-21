import Link from "next/link";
import { PageTitle } from "@/components/page-title";
import { LoadSampleDataButton } from "./load-sample-data-button";
import type { DayOneSteps } from "@/lib/onboarding/data";
import styles from "./day-one.module.css";

const STEPS: { key: keyof DayOneSteps; title: string; body: string; href: string }[] = [
  {
    key: "pillars",
    title: "Name your pillars",
    body: "The areas of life you want to track — Health and Finances are already here; add your own.",
    href: "/pillars",
  },
  {
    key: "northStar",
    title: "Write one North Star",
    body: "A single financial target to aim at, with a deadline.",
    href: "/finances",
  },
  {
    key: "habit",
    title: "Add a single habit",
    body: "Just one, to start. You can add more once it sticks.",
    href: "/habits",
  },
  {
    key: "capture",
    title: "Capture whatever's loud",
    body: "A task, a thought — anything on your mind right now.",
    href: "/all-tasks",
  },
];

export function DayOne({ steps }: { steps: DayOneSteps }) {
  return (
    <div className={styles.wrap}>
      <PageTitle
        eyebrow="Day one"
        title="Nothing here yet. That's the right amount."
        lede="Start with two Pillars and one habit — everything else can wait."
      />

      <div className={styles.cards}>
        {STEPS.map((step, i) => {
          const done = steps[step.key];
          return (
            <Link key={step.key} href={step.href} className={styles.card}>
              <span className={`${styles.badge} ${done ? styles.badgeDone : ""}`}>{i + 1}</span>
              <span className={styles.title}>{step.title}</span>
              <span className={styles.body}>{step.body}</span>
              <span className={done ? styles.stateDone : styles.stateTodo}>{done ? "Done" : "To do"}</span>
            </Link>
          );
        })}
      </div>

      <div className={styles.sampleCard}>
        <div>
          <div className={styles.sampleTitle}>Want to look around first?</div>
          <p className={styles.sampleBody}>Load a starter dataset — two Pillars, a habit, a task, and a thought.</p>
        </div>
        <LoadSampleDataButton />
      </div>
    </div>
  );
}
