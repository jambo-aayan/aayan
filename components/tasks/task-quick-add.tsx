"use client";

import { useMemo, useState } from "react";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { parseTaskInput } from "@/lib/tasks/natural-date-parser";
import { formatDueBadge } from "@/lib/tasks/format";
import styles from "./task-quick-add.module.css";

export type QuickAddSubmission = { title: string; dueDate: Date | null; dueTime: string | null };

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function nextWeekendDate(from: Date): Date {
  const day = from.getUTCDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + daysUntilSaturday);
  return result;
}

export function TaskQuickAdd({ onAdd }: { onAdd: (submission: QuickAddSubmission) => void }) {
  const [text, setText] = useState("");
  const [manualDate, setManualDate] = useState<Date | null>(null);
  const [focused, setFocused] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const preview = useMemo(() => {
    if (manualDate) return formatDueBadge(manualDate, null, new Date());
    if (!text.trim()) return null;
    const parsed = parseTaskInput(text);
    return formatDueBadge(parsed.dueDate, parsed.dueTime, new Date());
  }, [text, manualDate]);

  function submit() {
    const title = text.trim();
    if (!title) return;

    if (manualDate) {
      onAdd({ title, dueDate: manualDate, dueTime: null });
    } else {
      const parsed = parseTaskInput(title);
      onAdd({ title: parsed.title, dueDate: parsed.dueDate, dueTime: parsed.dueTime });
    }
    setText("");
    setManualDate(null);
    setShowDatePicker(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const today = utcMidnight(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  return (
    <div
      className={styles.wrap}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        // Only collapse the shortcuts row once focus has left the whole
        // quick-add block, not just the text input — otherwise clicking
        // "Pick date" would blur the input and unmount the date field
        // before the click could ever reach it.
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setFocused(false);
          setShowDatePicker(false);
        }
      }}
    >
      <div className={styles.inputRow}>
        <span className={styles.dashedBox} aria-hidden>
          <Plus size={11} strokeWidth={2} />
        </span>
        <input
          type="text"
          className={styles.input}
          placeholder="Call mum tomorrow 9am"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Add a task"
        />
        {preview && <span className={styles.preview}>{preview.label}</span>}
        <button type="button" className={styles.add} onClick={submit} disabled={!text.trim()}>
          Add
        </button>
      </div>
      {focused && (
        <div className={styles.shortcuts}>
          <button type="button" className={styles.chip} onClick={() => setManualDate(today)}>
            Today
          </button>
          <button type="button" className={styles.chip} onClick={() => setManualDate(tomorrow)}>
            Tomorrow
          </button>
          <button type="button" className={styles.chip} onClick={() => setManualDate(nextWeekendDate(today))}>
            This weekend
          </button>
          <button type="button" className={styles.chip} onClick={() => setShowDatePicker((v) => !v)}>
            <CalendarIcon size={12} strokeWidth={2} /> Pick date
          </button>
          {showDatePicker && (
            <input
              type="date"
              className={styles.datePicker}
              onChange={(e) => {
                if (e.target.value) setManualDate(new Date(`${e.target.value}T00:00:00.000Z`));
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
