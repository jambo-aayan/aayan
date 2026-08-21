"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { turnDigestIntoTasks, saveDigestAsThought } from "@/lib/insights/actions";
import type { WeeklyDigest } from "@/lib/insights/weekly-digest";
import styles from "./weekly-digest-card.module.css";

type Slot = { key: string; label: string; sentences: string[] };

export function WeeklyDigestCard({ digest }: { digest: WeeklyDigest }) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [pending, setPending] = useState<"tasks" | "thought" | null>(null);
  const [saved, setSaved] = useState<"tasks" | "thought" | null>(null);

  const slots: Slot[] = [
    { key: "worked", label: "Worked", sentences: digest.worked.length > 0 ? digest.worked : ["Nothing to report yet."] },
    { key: "slipped", label: "Slipped", sentences: digest.slipped.length > 0 ? digest.slipped : ["Nothing to report yet."] },
    { key: "surprising", label: "Surprising", sentences: [digest.surprising] },
    { key: "onething", label: "One thing", sentences: [digest.oneThing] },
  ];

  const allSentences = [...digest.worked, ...digest.slipped, digest.surprising, digest.oneThing];

  async function handleTurnIntoTasks() {
    setPending("tasks");
    const result = await withRetry(() => turnDigestIntoTasks(allSentences));
    setPending(null);
    if (!result.ok) notifyError(result.error, { onRetry: handleTurnIntoTasks });
    else {
      setSaved("tasks");
      router.refresh();
    }
  }

  async function handleSaveAsThought() {
    setPending("thought");
    const result = await withRetry(() => saveDigestAsThought(allSentences));
    setPending(null);
    if (!result.ok) notifyError(result.error, { onRetry: handleSaveAsThought });
    else {
      setSaved("thought");
      router.refresh();
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <span className={styles.eyebrow}>This week, in a sentence each</span>
        <span className={styles.caption}>auto-drafted Sunday 18:00</span>
      </div>

      <div className={styles.slots}>
        {slots.map((slot) => (
          <div key={slot.key} className={styles.slot}>
            <span className={styles.dot} aria-hidden />
            <div>
              <div className={styles.label}>{slot.label}</div>
              {slot.sentences.map((s, i) => (
                <p key={i} className={styles.sentence}>
                  {s}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <PrimaryButton onClick={handleTurnIntoTasks} disabled={pending !== null}>
          {pending === "tasks" ? "Adding…" : saved === "tasks" ? "Added" : "Turn into tasks"}
        </PrimaryButton>
        <button type="button" className={styles.outlineButton} onClick={handleSaveAsThought} disabled={pending !== null}>
          {pending === "thought" ? "Saving…" : saved === "thought" ? "Saved" : "Save as thought"}
        </button>
      </div>
    </div>
  );
}
