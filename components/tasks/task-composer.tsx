"use client";

import { useEffect, useState } from "react";
import { X, Star } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { REMINDER_LABEL, REPEAT_LABEL, type TaskReminderOffset, type TaskRepeatRule } from "@/lib/tasks/types";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";
import styles from "./task-composer.module.css";

export type TaskFormInput = {
  title: string;
  notes: string | null;
  listId: string | null;
  pillarId: string | null;
  tagNames: string[];
  dueDate: Date | null;
  dueTime: string | null;
  reminderOffset: TaskReminderOffset | null;
  repeatRule: TaskRepeatRule | null;
  important: boolean;
};

type DueOption = "none" | "today" | "tomorrow" | "weekend" | "custom";

function utcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function nextWeekendDate(from: Date): Date {
  const day = from.getUTCDay();
  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  const result = new Date(from);
  result.setUTCDate(result.getUTCDate() + daysUntilSaturday);
  return result;
}

function initialDueOption(task: Task | undefined, today: Date, tomorrow: Date): DueOption {
  if (!task?.dueDate) return "none";
  const due = utcMidnight(task.dueDate);
  if (due.getTime() === today.getTime()) return "today";
  if (due.getTime() === tomorrow.getTime()) return "tomorrow";
  return "custom";
}

export function TaskComposer({
  mode,
  task,
  lists,
  pillars,
  tagSuggestions,
  onClose,
  onSubmit,
}: {
  mode: "create" | "edit";
  task?: Task;
  lists: TaskListSummary[];
  pillars: { id: string; name: string }[];
  tagSuggestions: string[];
  onClose: () => void;
  onSubmit: (input: TaskFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const today = utcMidnight(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [listId, setListId] = useState(task?.listId ?? "");
  const [pillarId, setPillarId] = useState(task?.pillarId ?? "");
  const [tagsText, setTagsText] = useState(task?.tags.map((t) => t.name).join(", ") ?? "");
  const [dueOption, setDueOption] = useState<DueOption>(initialDueOption(task, today, tomorrow));
  const [customDate, setCustomDate] = useState(task?.dueDate ? toDateInputValue(task.dueDate) : "");
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [reminderOffset, setReminderOffset] = useState<TaskReminderOffset | "">(task?.reminderOffset ?? "");
  const [repeatRule, setRepeatRule] = useState<TaskRepeatRule | "">(task?.repeatRule ?? "");
  const [important, setImportant] = useState(task?.important ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function resolveDueDate(): Date | null {
    switch (dueOption) {
      case "today":
        return today;
      case "tomorrow":
        return tomorrow;
      case "weekend":
        return nextWeekendDate(today);
      case "custom":
        return customDate ? new Date(`${customDate}T00:00:00.000Z`) : null;
      case "none":
      default:
        return null;
    }
  }

  async function handleSubmit() {
    if (!title.trim()) {
      setError("Give the task a title first.");
      return;
    }
    setSaving(true);
    setError(null);
    const dueDate = resolveDueDate();
    const result = await onSubmit({
      title: title.trim(),
      notes: notes.trim() || null,
      listId: listId || null,
      pillarId: pillarId || null,
      tagNames: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      dueDate,
      dueTime: dueDate && dueTime ? dueTime : null,
      reminderOffset: reminderOffset || null,
      repeatRule: repeatRule || null,
      important,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onClose();
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden />
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-label={mode === "create" ? "New task" : "Edit task"}>
        <div className={styles.header}>
          <h2 className={styles.heading}>{mode === "create" ? "New task" : "Edit task"}</h2>
          <div className={styles.headerActions}>
            <button
              type="button"
              className={`${styles.star} ${important ? styles.starActive : ""}`}
              onClick={() => setImportant((v) => !v)}
              aria-pressed={important}
              aria-label={important ? "Unmark as important" : "Mark as important"}
            >
              <Star size={17} strokeWidth={2} fill={important ? "currentColor" : "none"} />
            </button>
            <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
              <X size={18} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className={styles.body}>
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            aria-label="Task title"
          />

          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>List</span>
              <select className={styles.select} value={listId} onChange={(e) => setListId(e.target.value)}>
                <option value="">No list</option>
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Pillar</span>
              <select className={styles.select} value={pillarId} onChange={(e) => setPillarId(e.target.value)}>
                <option value="">No pillar</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className={styles.field}>
            <span className={styles.label}>Tags</span>
            <input
              type="text"
              className={styles.textInput}
              placeholder="e.g. Strength, Gym"
              value={tagsText}
              onChange={(e) => setTagsText(e.target.value)}
              list="task-tag-suggestions"
            />
            <datalist id="task-tag-suggestions">
              {tagSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>

          <div className={styles.field}>
            <span className={styles.label}>Due date</span>
            <div className={styles.dueOptions}>
              {(["none", "today", "tomorrow", "weekend", "custom"] as const).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.dueChip} ${dueOption === opt ? styles.dueChipActive : ""}`}
                  onClick={() => setDueOption(opt)}
                >
                  {opt === "none" && "No due date"}
                  {opt === "today" && "Today"}
                  {opt === "tomorrow" && "Tomorrow"}
                  {opt === "weekend" && "This weekend"}
                  {opt === "custom" && "Pick date"}
                </button>
              ))}
            </div>
            {dueOption === "custom" && (
              <input
                type="date"
                className={styles.textInput}
                value={customDate}
                onChange={(e) => setCustomDate(e.target.value)}
              />
            )}
          </div>

          {dueOption !== "none" && (
            <div className={styles.grid}>
              <label className={styles.field}>
                <span className={styles.label}>Due time</span>
                <input
                  type="time"
                  className={styles.textInput}
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.label}>Reminder</span>
                <select
                  className={styles.select}
                  value={reminderOffset}
                  onChange={(e) => setReminderOffset(e.target.value as TaskReminderOffset | "")}
                >
                  <option value="">None</option>
                  {(Object.keys(REMINDER_LABEL) as TaskReminderOffset[]).map((key) => (
                    <option key={key} value={key}>
                      {REMINDER_LABEL[key]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Repeat</span>
            <select
              className={styles.select}
              value={repeatRule}
              onChange={(e) => setRepeatRule(e.target.value as TaskRepeatRule | "")}
            >
              <option value="">Doesn&rsquo;t repeat</option>
              {(Object.keys(REPEAT_LABEL) as TaskRepeatRule[]).map((key) => (
                <option key={key} value={key}>
                  {REPEAT_LABEL[key]}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Notes</span>
            <textarea
              className={styles.textarea}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}
        </div>

        <div className={styles.footer}>
          <PrimaryButton onClick={handleSubmit} disabled={saving}>
            {saving ? "Saving…" : mode === "create" ? "Add task" : "Save changes"}
          </PrimaryButton>
        </div>
      </div>
    </>
  );
}
