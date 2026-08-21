"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/primary-button";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { loadSampleData } from "@/lib/onboarding/actions";

export function LoadSampleDataButton() {
  const router = useRouter();
  const { notifyError } = useToast();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    const result = await withRetry(() => loadSampleData());
    setLoading(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleClick });
      return;
    }
    router.refresh();
  }

  return (
    <PrimaryButton onClick={handleClick} disabled={loading}>
      {loading ? "Loading…" : "Load sample data"}
    </PrimaryButton>
  );
}
