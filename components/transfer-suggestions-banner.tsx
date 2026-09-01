"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { linkTransfer } from "@/lib/finance/actions";
import { withRetry } from "@/lib/with-retry";
import type { RankableTransaction, TransferSuggestion } from "@/lib/finance/logic";
import { formatGBP, formatDateShort as formatDate } from "@/lib/finance/format";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./transfer-suggestions-banner.module.css";

type Candidate = RankableTransaction & { category: string };

/** Proactively surfaces likely-transfer pairs the user hasn't flagged yet
 * (#152, ADR-0015) — a batch-review list instead of relying on the user
 * to notice and open "Link as transfer" on the right transaction
 * themselves. Still suggest-and-confirm only, same as the existing
 * per-transaction flow (ADR-0013): "Link" calls the same linkTransfer
 * action LinkTransferForm uses, "Dismiss" only hides the row for this
 * session (no persisted "don't suggest again" state — it'll resurface
 * next visit if still unflagged, matching how nothing else in this app's
 * suggestion surfaces tracks a permanent dismissal).
 *
 * Each row tracks its own pending/error state (a Set of in-flight keys, a
 * per-key error map) rather than one shared value for the whole list —
 * matching how every other independently-actionable row list in this app
 * (uncategorised-queue.tsx, habits-list.tsx) handles it, since a suggestion
 * elsewhere in the list can go stale (its transaction got reclassified by
 * some other action on the same page) independently of the rest. */
export function TransferSuggestionsBanner({ suggestions }: { suggestions: TransferSuggestion<Candidate>[] }) {
  const router = useRouter();
  const [hiddenKeys, setHiddenKeys] = useState<Set<string>>(new Set());
  const [linkingKeys, setLinkingKeys] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});

  function keyFor(s: TransferSuggestion<Candidate>): string {
    return `${s.a.id}-${s.b.id}`;
  }

  function label(c: Candidate): string {
    return `${c.category} · ${c.direction === "IN" ? "+" : "−"}${formatGBP(c.amount)} · ${formatDate(c.date)}`;
  }

  async function handleLink(s: TransferSuggestion<Candidate>) {
    const key = keyFor(s);
    setLinkingKeys((prev) => new Set(prev).add(key));
    setErrors((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => k !== key)));
    const result = await withRetry(() => linkTransfer(s.a.id, s.b.id, null));
    setLinkingKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [key]: result.error }));
      return;
    }
    setHiddenKeys((prev) => new Set(prev).add(key));
    router.refresh();
  }

  const visible = suggestions.filter((s) => !hiddenKeys.has(keyFor(s)));
  if (visible.length === 0) return null;

  return (
    <div className={styles.card}>
      <div className={styles.head}>Possible transfers to review</div>
      <ul className={styles.list}>
        {visible.map((s) => {
          const key = keyFor(s);
          const linking = linkingKeys.has(key);
          return (
            <li key={key} className={styles.row}>
              <span className={styles.pair}>
                {label(s.a)} <span className={styles.arrow}>→</span> {label(s.b)}
              </span>
              <span className={styles.actions}>
                <PrimaryButton onClick={() => handleLink(s)} disabled={linking}>
                  {linking ? "Linking…" : "Link"}
                </PrimaryButton>
                <button
                  type="button"
                  className={styles.dismiss}
                  disabled={linking}
                  onClick={() => setHiddenKeys((prev) => new Set(prev).add(key))}
                >
                  Dismiss
                </button>
              </span>
              {errors[key] && <p className={styles.error}>{errors[key]}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
