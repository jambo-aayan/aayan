"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { searchPalette, topHit } from "@/lib/palette/search";
import type { PaletteItem } from "@/lib/palette/types";
import { parseTaskInput } from "@/lib/tasks/natural-date-parser";
import { createTask } from "@/lib/tasks/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./command-palette.module.css";

export function CommandPalette({ items, open, onClose }: { items: PaletteItem[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { notifyError } = useToast();
  const [query, setQuery] = useState("");
  const [capturing, setCapturing] = useState(false);

  const groups = useMemo(() => searchPalette(query, items), [query, items]);
  const hasQuery = query.trim().length > 0;
  const hit = topHit(groups);

  function close() {
    setQuery("");
    onClose();
  }

  function goTo(item: PaletteItem) {
    router.push(item.href);
    close();
  }

  async function capture(rawText: string) {
    const trimmed = rawText.trim();
    if (!trimmed || capturing) return;
    setCapturing(true);
    const parsed = parseTaskInput(trimmed);
    const result = await withRetry(() =>
      createTask(
        {
          title: parsed.title,
          notes: null,
          listId: null,
          pillarId: null,
          areaId: null,
          goalId: null,
          tagNames: [],
          dueDate: parsed.dueDate,
          dueTime: parsed.dueTime,
          reminderOffset: null,
          repeatRule: null,
          repeatWeekdays: [],
          repeatIntervalN: null,
          important: false,
        },
        true
      )
    );
    setCapturing(false);
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => capture(rawText) });
      return;
    }
    router.push("/today");
    close();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      close();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (hit) goTo(hit);
      else if (hasQuery) capture(query);
    }
  }

  if (!open) return null;

  return (
    <>
      <div className={styles.overlay} onClick={close} aria-hidden />
      <div className={styles.palette} role="dialog" aria-modal="true" aria-label="Command palette">
        <div className={styles.header}>
          <Search size={16} strokeWidth={2} className={styles.searchIcon} />
          <input
            type="text"
            className={styles.input}
            placeholder="Jump to, or type to capture a task…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            role="combobox"
            aria-expanded={groups.length > 0}
            aria-controls="command-palette-results"
          />
          <span className={styles.keycap}>esc</span>
        </div>

        <div className={styles.body} id="command-palette-results">
          {hasQuery && (
            <button type="button" className={styles.captureRow} onClick={() => capture(query)} disabled={capturing}>
              <span className={styles.captureBox} aria-hidden />
              <span className={styles.captureText}>
                Capture &ldquo;{query}&rdquo; as a task
              </span>
              <span className={styles.enterHint}>⏎</span>
            </button>
          )}

          {groups.map((group) => (
            <div key={group.type} className={styles.group}>
              <div className={styles.groupLabel}>{group.title}</div>
              {group.items.map((item) => (
                <button key={item.id} type="button" className={styles.row} onClick={() => goTo(item)}>
                  <span
                    className={item.type === "task" ? styles.dotSquare : styles.dotCircle}
                    style={{ background: item.color ?? "var(--muted-2)" }}
                    aria-hidden
                  />
                  <span className={styles.rowLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}

          {hasQuery && groups.length === 0 && (
            <p className={styles.noMatches}>No matches — press ⏎ to capture it instead.</p>
          )}
        </div>
      </div>
    </>
  );
}
