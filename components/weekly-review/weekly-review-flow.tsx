"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { setReviewStep } from "@/lib/weekly-review/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { StepCloseOut } from "./step-close-out";
import { StepHabits } from "./step-habits";
import { StepRerank } from "./step-rerank";
import { StepNumbers } from "./step-numbers";
import { StepWrite } from "./step-write";
import type { StaleTask, HabitReviewCard, RankCandidate, ReviewStat } from "@/lib/weekly-review/data";
import styles from "./weekly-review-flow.module.css";

const STEP_LABELS = ["Close out", "Habits", "Re-rank", "Numbers", "Write it"];
const STEP_TITLES = [
  "What's still open?",
  "Which habits earned their place?",
  "What actually matters next week?",
  "The numbers, briefly",
  "Say it in your own words",
];
const STEP_BLURBS = [
  "These are still open from the week. Close, push, or drop each one — carrying them silently is the expensive option.",
  "Keep what's working, pause what isn't. A paused habit is not a failure; a fake one is.",
  "Reorder by what you'd regret not doing. The top three become next week's My Day.",
  "One glance at where the month landed, so the sentence you write next is grounded.",
  "Edit the draft until it sounds like you. It saves to Thoughts and shows up in Insights.",
];
const NEXT_LABELS = ["Next: habits", "Next: re-rank", "Next: numbers", "Next: write it", ""];

export function WeeklyReviewFlow({
  initialStep,
  staleTasks,
  habitCards,
  rankCandidates,
  numbers,
  digestDraft,
}: {
  initialStep: number;
  staleTasks: StaleTask[];
  habitCards: HabitReviewCard[];
  rankCandidates: RankCandidate[];
  numbers: ReviewStat[];
  digestDraft: string;
}) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [step, setStep] = useState(Math.min(4, Math.max(0, initialStep)));
  const [navigating, setNavigating] = useState(false);

  async function goTo(next: number) {
    setNavigating(true);
    const result = await withRetry(() => setReviewStep(next));
    setNavigating(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => goTo(next) });
      return;
    }
    setStep(next);
    router.refresh();
  }

  const footNote = [
    `${staleTasks.length} to triage`,
    `${habitCards.length} habits`,
    "drag or use arrows",
    "This week so far",
    "saves to Thoughts",
  ][step];

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <Link href="/today" className={styles.exit}>
          ← Exit
        </Link>
        <span className={styles.stepIndicator}>
          Step {step + 1} of 5 · {STEP_LABELS[step]}
        </span>
      </div>

      <div className={styles.progress} aria-hidden>
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className={`${styles.progressSegment} ${i <= step ? styles.progressFilled : ""}`} />
        ))}
      </div>

      <h1 className={styles.title}>{STEP_TITLES[step]}</h1>
      <p className={styles.blurb}>{STEP_BLURBS[step]}</p>

      <div className={styles.body}>
        {step === 0 && <StepCloseOut tasks={staleTasks} />}
        {step === 1 && <StepHabits cards={habitCards} />}
        {step === 2 && <StepRerank candidates={rankCandidates} />}
        {step === 3 && <StepNumbers stats={numbers} />}
        {step === 4 && <StepWrite initialDraft={digestDraft} onFinished={() => goTo(0)} />}
      </div>

      <div className={styles.footer}>
        <div className={styles.footerButtons}>
          {step > 0 && (
            <button type="button" className={styles.backButton} onClick={() => goTo(step - 1)} disabled={navigating}>
              Back
            </button>
          )}
          {step < 4 && (
            <button type="button" className={styles.nextButton} onClick={() => goTo(step + 1)} disabled={navigating}>
              {NEXT_LABELS[step]}
            </button>
          )}
        </div>
        <span className={styles.footNote}>{footNote}</span>
      </div>
    </div>
  );
}
