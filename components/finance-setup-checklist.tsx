import Link from "next/link";
import type { FinanceSetupSteps } from "@/lib/finance/data";
import { Card } from "@/components/card";
import styles from "@/components/day-one/day-one.module.css";

const STEPS: { key: keyof FinanceSetupSteps; title: string; body: string; href: string }[] = [
  {
    key: "baseline",
    title: "Baseline set?",
    body: "Your monthly income and fixed outgoings.",
    href: "/finances#baseline",
  },
  {
    key: "accounts",
    title: "First Account added?",
    body: "A bank account, card, or pension — anything worth tracking.",
    href: "/finances#accounts",
  },
  {
    key: "goals",
    title: "A Goal created?",
    body: "A savings target with a vehicle and a priority.",
    href: "/finances#financial-plan",
  },
];

/** Finance-scoped setup checklist, extending the app-wide Day One idiom
 * (components/day-one/day-one.tsx) — same badge/card/state visual
 * language, reused directly from its module (not copied), but embedded
 * as one Card on /finances rather than a full-page takeover, since the
 * rest of the dashboard is still useful even before setup is done
 * (#122, ADR-0010). */
export function FinanceSetupChecklist({ steps }: { steps: FinanceSetupSteps }) {
  return (
    <Card title="Get set up">
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
    </Card>
  );
}
