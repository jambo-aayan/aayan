"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { markAllNudgesRead, markNudgeRead, snoozeNudge } from "@/lib/nudges/actions";
import { NUDGE_PRIMARY_ACTION_LABEL, type NudgeType } from "@/lib/nudges/types";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import styles from "./nudges-list.module.css";

export type NudgeRow = {
  id: string;
  type: NudgeType;
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
  snoozedUntil: string | null;
};

const FILTERS = [
  { value: "unread", label: "Unread" },
  { value: "all", label: "All" },
  { value: "snoozed", label: "Snoozed" },
] as const;

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function NudgesList({ filter, nudges }: { filter: "unread" | "all" | "snoozed"; nudges: NudgeRow[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { notifyError } = useToast();
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [markingAll, setMarkingAll] = useState(false);

  function withPending(id: string, fn: () => Promise<void>) {
    setPendingIds((prev) => new Set(prev).add(id));
    fn().finally(() =>
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      })
    );
  }

  async function handleMarkRead(id: string) {
    withPending(id, async () => {
      const result = await withRetry(() => markNudgeRead(id));
      if (!result.ok) notifyError(result.error, { onRetry: () => handleMarkRead(id) });
      else router.refresh();
    });
  }

  async function handleSnooze(id: string) {
    withPending(id, async () => {
      const result = await withRetry(() => snoozeNudge(id));
      if (!result.ok) notifyError(result.error, { onRetry: () => handleSnooze(id) });
      else router.refresh();
    });
  }

  async function handleMarkAllRead() {
    setMarkingAll(true);
    const result = await withRetry(() => markAllNudgesRead());
    setMarkingAll(false);
    if (!result.ok) notifyError(result.error, { onRetry: handleMarkAllRead });
    else router.refresh();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="radiogroup" aria-label="Filter">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={f.value === "unread" ? pathname : `${pathname}?filter=${f.value}`}
              className={`${styles.filterTab} ${filter === f.value ? styles.filterTabActive : ""}`}
              role="radio"
              aria-checked={filter === f.value}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <button type="button" className={styles.markAllRead} onClick={handleMarkAllRead} disabled={markingAll}>
          Mark all read
        </button>
      </div>

      {nudges.length === 0 && <p className={styles.empty}>Nothing here.</p>}

      <ul className={styles.list}>
        {nudges.map((n) => {
          const pending = pendingIds.has(n.id);
          return (
            <li key={n.id} className={styles.row}>
              <span className={styles.dot} aria-hidden />
              <div className={styles.body}>
                <div className={styles.rowHead}>
                  <span className={styles.title}>{n.title}</span>
                  <span className={styles.time}>{relativeTime(n.createdAt)}</span>
                </div>
                <p className={styles.text}>{n.body}</p>
                <div className={styles.actions}>
                  <button type="button" className={styles.primaryAction} onClick={() => handleMarkRead(n.id)} disabled={pending}>
                    {NUDGE_PRIMARY_ACTION_LABEL[n.type]}
                  </button>
                  {!n.snoozedUntil && (
                    <button type="button" className={styles.snoozeAction} onClick={() => handleSnooze(n.id)} disabled={pending}>
                      Snooze
                    </button>
                  )}
                  {n.snoozedUntil && <span className={styles.snoozedNote}>Snoozed until tomorrow</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
