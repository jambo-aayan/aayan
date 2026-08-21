"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { regenerateReviewDigest, saveDraftDigest, finishReview } from "@/lib/weekly-review/actions";
import styles from "./step-write.module.css";

export function StepWrite({ initialDraft, onFinished }: { initialDraft: string; onFinished: () => void }) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [draft, setDraft] = useState(initialDraft);
  const [regenerating, setRegenerating] = useState(false);
  const [finishing, setFinishing] = useState(false);

  async function handleBlur() {
    await withRetry(() => saveDraftDigest(draft));
  }

  async function handleRegenerate() {
    setRegenerating(true);
    const result = await withRetry(() => regenerateReviewDigest());
    setRegenerating(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleRegenerate });
      return;
    }
    setDraft(result.draft);
  }

  async function handleFinish() {
    setFinishing(true);
    const result = await withRetry(() => finishReview(draft));
    setFinishing(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleFinish });
      return;
    }
    router.refresh();
    onFinished();
  }

  return (
    <div className={styles.panel}>
      <textarea
        className={styles.textarea}
        rows={7}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleBlur}
        placeholder="This week..."
      />
      <div className={styles.actions}>
        <PrimaryButton onClick={handleFinish} disabled={finishing || regenerating}>
          {finishing ? "Saving…" : "Save to Thoughts & finish"}
        </PrimaryButton>
        <button type="button" className={styles.outlineButton} onClick={handleRegenerate} disabled={finishing || regenerating}>
          {regenerating ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
    </div>
  );
}
