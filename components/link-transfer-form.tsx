"use client";

import { useState } from "react";
import { linkTransfer } from "@/lib/finance/actions";
import { rankTransferCandidates, canLinkTransfer, type RankableTransaction } from "@/lib/finance/logic";
import { withRetry } from "@/lib/with-retry";
import { PrimaryButton } from "@/components/primary-button";
import styles from "./link-transfer-form.module.css";

function formatGBP(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date);
}

type Candidate = RankableTransaction & { category: string };

/** "Link as transfer"'s suggested-matches picker (#139, ADR-0013) — never
 * auto-links, always requires an explicit pick. `rankTransferCandidates`
 * surfaces the likeliest matches (opposite direction, different account,
 * within 5 days, closest amount) first; the full dropdown below it is the
 * manual fallback for when nothing suggested is right, filtered only by
 * canLinkTransfer (no date window) so it still can't produce an invalid
 * pairing. */
export function LinkTransferForm({
  transaction,
  accountNames,
  candidates,
  onCancel,
  onConfirmed,
}: {
  transaction: RankableTransaction;
  accountNames: Record<string, string>;
  candidates: Candidate[];
  onCancel: () => void;
  onConfirmed: (transferId: string) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggested = rankTransferCandidates(transaction, candidates);
  const suggestedIds = new Set(suggested.map((c) => c.id));
  const rest = candidates.filter((c) => !suggestedIds.has(c.id) && canLinkTransfer(transaction, c));

  function candidateLabel(c: Candidate): string {
    const account = accountNames[c.accountId ?? ""] ?? "Unknown account";
    return `${account} · ${c.category} · ${formatGBP(c.amount)} · ${formatDate(c.date)}`;
  }

  async function handleLink(candidateId: string) {
    setSaving(true);
    setError(null);
    const result = await withRetry(() => linkTransfer(transaction.id, candidateId, null));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirmed(result.transferId);
  }

  return (
    <div className={styles.form}>
      {suggested.length > 0 ? (
        <ul className={styles.suggestions}>
          {suggested.map((c) => (
            <li key={c.id} className={styles.suggestion}>
              <span>{candidateLabel(c)}</span>
              <button type="button" className={styles.link} disabled={saving} onClick={() => handleLink(c.id)}>
                Link
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.muted}>No close matches found — pick one manually below.</p>
      )}

      <div className={styles.manualRow}>
        <select
          className={styles.input}
          aria-label="Pick a different transaction"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">Pick a different transaction…</option>
          {rest.map((c) => (
            <option key={c.id} value={c.id}>
              {candidateLabel(c)}
            </option>
          ))}
        </select>
        <PrimaryButton onClick={() => handleLink(selectedId)} disabled={saving || !selectedId}>
          {saving ? "Linking…" : "Link"}
        </PrimaryButton>
        <button type="button" className={styles.link} onClick={onCancel}>
          Cancel
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
