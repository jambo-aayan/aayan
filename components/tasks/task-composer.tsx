"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { PrimaryButton } from "@/components/primary-button";
import { REMINDER_LABEL, REPEAT_LABEL, type TaskReminderOffset, type TaskRepeatRule } from "@/lib/tasks/types";
import type { Task } from "@/lib/tasks/types";
import type { TaskListSummary } from "@/lib/tasks/data";
import { TaskSteps } from "./task-steps";
import { TaskCheckbox } from "./task-checkbox";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import styles from "./task-composer.module.css";

export type TaskFormInput = {
  title: string;
  notes: string | null;
  listId: string | null;
  pillarId: string | null;
  areaId: string | null;
  goalId: string | null;
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
  areas,
  goals,
  tagSuggestions,
  defaultListId,
  onClose,
  onSubmit,
  onToggleComplete,
  pending,
}: {
  mode: "create" | "edit";
  task?: Task;
  lists: TaskListSummary[];
  pillars: { id: string; name: string; color?: string | null }[];
  areas: { id: string; name: string; pillarId: string }[];
  goals: { id: string; name: string; areaId: string | null; pillarId?: string }[];
  tagSuggestions: string[];
  /** Pre-selects the List in create mode when the composer was opened while
   * already viewing a specific List — otherwise a "+ New task" from that
   * view would silently create the task in Inbox instead. Ignored in edit
   * mode, where the task's own List always wins. */
  defaultListId?: string;
  onClose: () => void;
  onSubmit: (input: TaskFormInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** Toggles the task's completion, wired to the header checkbox — see the
   * design_handoff_aayan README's Task detail header spec ("checkbox +
   * editable title"). Undefined in create mode, where there's no saved
   * task yet to complete. */
  onToggleComplete?: () => void;
  pending?: boolean;
}) {
  const today = utcMidnight(new Date());
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [listId, setListId] = useState(task?.listId ?? defaultListId ?? "");
  const [pillarId, setPillarId] = useState(task?.pillarId ?? "");
  const [areaId, setAreaId] = useState(task?.areaId ?? "");
  const [goalId, setGoalId] = useState(task?.goalId ?? "");
  const [tagsText, setTagsText] = useState(task?.tags.map((t) => t.name).join(", ") ?? "");
  const [dueOption, setDueOption] = useState<DueOption>(initialDueOption(task, today, tomorrow));
  const [customDate, setCustomDate] = useState(task?.dueDate ? toDateInputValue(task.dueDate) : "");
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [reminderOffset, setReminderOffset] = useState<TaskReminderOffset | "">(task?.reminderOffset ?? "");
  const [repeatRule, setRepeatRule] = useState<TaskRepeatRule | "">(task?.repeatRule ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(task?.status === "COMPLETED");

  const pillarHex = resolveColorHex((pillars.find((p) => p.id === pillarId)?.color ?? null) as ColorKey | null);

  function handleToggleDone() {
    if (!onToggleComplete) return;
    setDone((v) => !v);
    onToggleComplete();
  }

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
      areaId: areaId || null,
      goalId: goalId || null,
      tagNames: tagsText
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      dueDate,
      dueTime: dueDate && dueTime ? dueTime : null,
      reminderOffset: reminderOffset || null,
      repeatRule: repeatRule || null,
      important: task?.important ?? false,
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
          <TaskCheckbox
            checked={done}
            onToggle={handleToggleDone}
            disabled={!onToggleComplete || pending}
            label={done ? `Mark "${title || "task"}" not done` : `Mark "${title || "task"}" done`}
            accentColor={pillarHex}
          />
          <input
            type="text"
            className={styles.titleInput}
            placeholder="Task title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            aria-label="Task title"
          />
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.body}>
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
              <select
                className={styles.select}
                value={pillarId}
                onChange={(e) => {
                  setPillarId(e.target.value);
                  // Switching Pillar invalidates an Area from a different one.
                  if (areaId && areas.find((a) => a.id === areaId)?.pillarId !== e.target.value) setAreaId("");
                }}
              >
                <option value="">No pillar</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className={styles.grid}>
            <label className={styles.field}>
              <span className={styles.label}>Area</span>
              <select className={styles.select} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
                <option value="">No area</option>
                {(pillarId ? areas.filter((a) => a.pillarId === pillarId) : areas).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Goal</span>
              <select
                className={styles.select}
                value={goalId}
                onChange={(e) => {
                  const nextGoalId = e.target.value;
                  setGoalId(nextGoalId);
                  // Picking a Goal infers Pillar/Area from it where possible,
                  // rather than leaving them to silently disagree.
                  const goal = goals.find((g) => g.id === nextGoalId);
                  if (goal?.pillarId) setPillarId(goal.pillarId);
                  if (goal?.areaId) setAreaId(goal.areaId);
                }}
              >
                <option value="">No goal</option>
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
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

          {mode === "edit" && task && (
            <div className={styles.field}>
              <span className={styles.label}>Steps</span>
              <TaskSteps taskId={task.id} initialSteps={task.steps} />
            </div>
          )}

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
