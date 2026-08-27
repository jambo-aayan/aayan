"use client";

import { useState } from "react";
import Link from "next/link";
import type { SystemType, SystemState } from "@/lib/systems/logic";
import { expectedOccurrenceDates, classifyOccurrences, validatePhotoUpload } from "@/lib/systems/logic";
import {
  createSystem,
  setSystemState,
  setSystemSequential,
  setSystemParent,
  updateSystemReference,
  duplicateSystem,
  addChecklistStep,
  addCheckpointStep,
  captureCheckpoint,
  addMilestoneStep,
  addMeasureStep,
  captureMeasureValue,
  addRepeatingStep,
  logSystemStepOccurrence,
  deleteSystemStepOccurrence,
  uploadCheckpointPhoto,
  deleteCheckpointPhoto,
  linkSystemHabit,
  unlinkSystemHabit,
  linkSystemGoal,
  unlinkSystemGoal,
  updateChecklistStep,
  toggleSystemStep,
  backdateSystemStep,
  deleteSystemStep,
  addSystemDecision,
} from "@/lib/systems/actions";
import {
  ratingTrend,
  ratingHistogram,
  milestoneList,
  isGanttEligible,
  kanbanColumn,
  numericTrend,
  targetGauge,
  distinctMetricNames,
  streakGrid,
  adherenceBreakdown,
  ratingVsAdherence,
  photoStrip,
  thenAndNow,
  type KanbanColumn,
  type MilestoneStep,
} from "@/lib/systems/widgets";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import styles from "./systems-list.module.css";

export type SystemStepRow = {
  id: string;
  type: string;
  text: string;
  done: boolean;
  doneOn: Date | null;
  rating: number | null;
  comment: string | null;
  photoUrl: string | null;
  date: Date | null;
  value: number | null;
  unit: string | null;
  target: number | null;
  metricName: string | null;
  cadenceDays: number | null;
  endCondition: string | null;
  endValue: number | null;
  createdAt: Date;
  occurrences: { id: string; occurredOn: Date }[];
};
export type SystemDecisionRow = { id: string; when: Date; body: string };
export type LinkedHabit = { id: string; name: string; status: string; checkInDates: Date[] };
export type LinkedGoal = { id: string; name: string; status: string };
export type AreaSystem = {
  id: string;
  name: string;
  type: SystemType;
  state: SystemState;
  body: string | null;
  reference: string | null;
  review: Date | null;
  sequential: boolean;
  steps: SystemStepRow[];
  decisions: SystemDecisionRow[];
  children: { id: string; name: string; state: SystemState }[];
  parentId: string | null;
  parent: { id: string; name: string } | null;
  linkedHabits: LinkedHabit[];
  linkedGoals: LinkedGoal[];
};

const STATE_NOTE: Record<SystemState, string | null> = {
  ACTIVE: null,
  PAUSED: "Paused on purpose. Streaks and nudges leave it alone until it's active again.",
  DRAFT: "Still being thought through.",
  ARCHIVED: "Concluded but kept.",
};

function progress(steps: SystemStepRow[]): number {
  if (steps.length === 0) return 0;
  return Math.round((steps.filter((s) => s.done).length / steps.length) * 100);
}

const EMPTY_FORM = { name: "", type: "PROCESS" as SystemType, body: "", review: "", criteria: "" };

export function SystemsList({
  areaId,
  pillarId,
  initialSystems,
  habitOptions = [],
  goalOptions = [],
}: {
  areaId: string | null;
  pillarId: string;
  initialSystems: AreaSystem[];
  habitOptions?: { id: string; name: string }[];
  goalOptions?: { id: string; name: string }[];
}) {
  const [systems, setSystems] = useState(initialSystems);
  const [showArchived, setShowArchived] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  async function handleAdd() {
    setAdding(true);
    setError(null);
    const result = await withRetry(() =>
      createSystem({
        name: form.name,
        pillarId,
        areaId,
        type: form.type,
        body: form.body.trim() || null,
        review: form.type === "EXPERIMENT" && form.review ? new Date(form.review) : null,
        criteria: form.type === "EXPERIMENT" ? form.criteria.trim() || null : null,
      })
    );
    setAdding(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleAdd });
      return;
    }
    setSystems((prev) => [
      ...prev,
      {
        id: result.id,
        name: form.name.trim(),
        type: form.type,
        state: "ACTIVE",
        body: form.body.trim() || null,
        reference: null,
        review: form.type === "EXPERIMENT" && form.review ? new Date(form.review) : null,
        sequential: false,
        steps: [],
        decisions: [],
        children: [],
        parentId: null,
        parent: null,
        linkedHabits: [],
        linkedGoals: [],
      },
    ]);
    setForm(EMPTY_FORM);
  }

  const visible = systems.filter((s) => showArchived || s.state !== "ARCHIVED");

  return (
    <div>
      {visible.map((system) => (
        <SystemCard
          key={system.id}
          system={system}
          habitOptions={habitOptions}
          goalOptions={goalOptions}
          parentOptions={systems.filter((s) => s.id !== system.id && s.parentId === null)}
          onChange={(next) => setSystems((prev) => prev.map((s) => (s.id === system.id ? next : s)))}
        />
      ))}
      {visible.length === 0 && <p className={styles.empty}>No Systems yet.</p>}
      {systems.some((s) => s.state === "ARCHIVED") && (
        <button type="button" className={styles.link} onClick={() => setShowArchived((v) => !v)}>
          {showArchived ? "Hide archived" : "Show archived"}
        </button>
      )}

      <div className={styles.addForm}>
        <input
          className={styles.input}
          placeholder="System name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
        <select
          className={styles.input}
          value={form.type}
          onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as SystemType }))}
        >
          <option value="PROCESS">Process</option>
          <option value="EXPERIMENT">Experiment</option>
        </select>
        <textarea
          className={styles.input}
          placeholder="What's the method, and why this way?"
          value={form.body}
          onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
        />
        {form.type === "EXPERIMENT" && (
          <>
            <input
              type="date"
              className={styles.input}
              value={form.review}
              onChange={(e) => setForm((f) => ({ ...f, review: e.target.value }))}
            />
            <textarea
              className={styles.input}
              placeholder="Success criteria — what counts as working?"
              value={form.criteria}
              onChange={(e) => setForm((f) => ({ ...f, criteria: e.target.value }))}
            />
          </>
        )}
        <button type="button" className={styles.add} onClick={handleAdd} disabled={adding}>
          {adding ? "Adding…" : "Add a System"}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </div>
    </div>
  );
}

function SystemCard({
  system,
  onChange,
  habitOptions,
  goalOptions,
  parentOptions,
}: {
  system: AreaSystem;
  onChange: (next: AreaSystem) => void;
  habitOptions: { id: string; name: string }[];
  goalOptions: { id: string; name: string }[];
  parentOptions: { id: string; name: string }[];
}) {
  const [stepText, setStepText] = useState("");
  const [stepType, setStepType] = useState<"CHECKLIST" | "CHECKPOINT" | "MILESTONE" | "MEASURE" | "REPEATING">(
    "CHECKLIST"
  );
  const [stepDate, setStepDate] = useState("");
  const [stepMetricName, setStepMetricName] = useState("");
  const [stepUnit, setStepUnit] = useState("");
  const [stepTarget, setStepTarget] = useState("");
  const [stepCadenceDays, setStepCadenceDays] = useState("7");
  const [stepEndCondition, setStepEndCondition] = useState<"FIXED_COUNT" | "REVIEW_DATE">("FIXED_COUNT");
  const [stepEndValue, setStepEndValue] = useState("4");
  const [occurrenceDates, setOccurrenceDates] = useState<Record<string, string>>({});
  const [decisionText, setDecisionText] = useState("");
  const [referenceDraft, setReferenceDraft] = useState(system.reference ?? "");
  const [editingReference, setEditingReference] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepText, setEditStepText] = useState("");
  const [capturingStepId, setCapturingStepId] = useState<string | null>(null);
  const [captureRating, setCaptureRating] = useState("");
  const [captureComment, setCaptureComment] = useState("");
  const [captureValue, setCaptureValue] = useState("");
  const [uploadingStepId, setUploadingStepId] = useState<string | null>(null);
  const [backdatingStepId, setBackdatingStepId] = useState<string | null>(null);
  const [backdateValue, setBackdateValue] = useState("");
  const [kanbanView, setKanbanView] = useState(false);
  const [scatterHabitId, setScatterHabitId] = useState<string | null>(null);
  const [now] = useState(() => new Date());
  const { notifyError } = useToast();

  async function handleSetParent(parentId: string) {
    const prev = { parentId: system.parentId, parent: system.parent };
    const option = parentId ? parentOptions.find((p) => p.id === parentId) ?? null : null;
    onChange({ ...system, parentId: parentId || null, parent: option ? { id: option.id, name: option.name } : null });
    const result = await withRetry(() => setSystemParent(system.id, parentId || null));
    if (!result.ok) {
      onChange({ ...system, ...prev });
      notifyError(result.error, { onRetry: () => handleSetParent(parentId) });
    }
  }

  async function handleToggleSequential() {
    const next = !system.sequential;
    onChange({ ...system, sequential: next });
    const result = await withRetry(() => setSystemSequential(system.id, next));
    if (!result.ok) {
      onChange({ ...system, sequential: !next });
      notifyError(result.error, { onRetry: handleToggleSequential });
    }
  }

  async function handleSetState(state: SystemState) {
    const prev = system;
    onChange({ ...system, state });
    const result = await withRetry(() => setSystemState(system.id, state));
    if (!result.ok) {
      onChange(prev);
      notifyError(result.error, { onRetry: () => handleSetState(state) });
    }
  }

  async function handleLinkHabit(habitId: string) {
    if (!habitId || system.linkedHabits.some((h) => h.id === habitId)) return;
    const option = habitOptions.find((h) => h.id === habitId);
    if (!option) return;
    // Optimistic placeholder first (instant feedback, matching this
    // file's established idiom), then corrected to the habit's real
    // status/checkInDates once the action returns — otherwise a
    // freshly-linked habit would compute the scatter widget against an
    // empty checkInDates stub until a full page reload.
    onChange({
      ...system,
      linkedHabits: [...system.linkedHabits, { id: option.id, name: option.name, status: "ACTIVE", checkInDates: [] }],
    });
    const result = await withRetry(() => linkSystemHabit(system.id, habitId));
    if (!result.ok) {
      onChange({ ...system, linkedHabits: system.linkedHabits.filter((h) => h.id !== habitId) });
      notifyError(result.error, { onRetry: () => handleLinkHabit(habitId) });
      return;
    }
    onChange({
      ...system,
      linkedHabits: [
        ...system.linkedHabits.filter((h) => h.id !== habitId),
        { id: option.id, name: option.name, status: result.status, checkInDates: result.checkInDates },
      ],
    });
  }

  async function handleUnlinkHabit(habitId: string) {
    const prev = system.linkedHabits;
    onChange({ ...system, linkedHabits: prev.filter((h) => h.id !== habitId) });
    const result = await withRetry(() => unlinkSystemHabit(system.id, habitId));
    if (!result.ok) {
      onChange({ ...system, linkedHabits: prev });
      notifyError(result.error, { onRetry: () => handleUnlinkHabit(habitId) });
    }
  }

  async function handleLinkGoal(goalId: string) {
    if (!goalId || system.linkedGoals.some((g) => g.id === goalId)) return;
    const option = goalOptions.find((g) => g.id === goalId);
    if (!option) return;
    onChange({ ...system, linkedGoals: [...system.linkedGoals, { id: option.id, name: option.name, status: "ACTIVE" }] });
    const result = await withRetry(() => linkSystemGoal(system.id, goalId));
    if (!result.ok) {
      onChange({ ...system, linkedGoals: system.linkedGoals.filter((g) => g.id !== goalId) });
      notifyError(result.error, { onRetry: () => handleLinkGoal(goalId) });
      return;
    }
    onChange({
      ...system,
      linkedGoals: [
        ...system.linkedGoals.filter((g) => g.id !== goalId),
        { id: option.id, name: option.name, status: result.status },
      ],
    });
  }

  async function handleUnlinkGoal(goalId: string) {
    const prev = system.linkedGoals;
    onChange({ ...system, linkedGoals: prev.filter((g) => g.id !== goalId) });
    const result = await withRetry(() => unlinkSystemGoal(system.id, goalId));
    if (!result.ok) {
      onChange({ ...system, linkedGoals: prev });
      notifyError(result.error, { onRetry: () => handleUnlinkGoal(goalId) });
    }
  }

  async function handleDuplicate() {
    if (
      !window.confirm(
        `Duplicate "${system.name}" as a one-time, unlinked copy? This creates an independent Draft — it is not a template/run relationship.`
      )
    ) {
      return;
    }
    const result = await withRetry(() => duplicateSystem(system.id));
    if (!result.ok) notifyError(result.error, { onRetry: handleDuplicate });
  }

  const EMPTY_STEP: Omit<SystemStepRow, "id" | "type" | "text" | "createdAt"> = {
    done: false,
    doneOn: null,
    rating: null,
    comment: null,
    photoUrl: null,
    date: null,
    value: null,
    unit: null,
    target: null,
    metricName: null,
    cadenceDays: null,
    endCondition: null,
    endValue: null,
    occurrences: [],
  };

  async function handleAddStep() {
    const text = stepText.trim();
    if (!text) return;

    if (stepType === "MILESTONE" && !stepDate) return;
    if (stepType === "MEASURE" && !stepMetricName.trim()) return;
    if (stepType === "REPEATING" && !stepCadenceDays) return;

    const result = await withRetry(() => {
      if (stepType === "CHECKLIST") return addChecklistStep(system.id, text);
      if (stepType === "CHECKPOINT") return addCheckpointStep(system.id, text, null);
      if (stepType === "MILESTONE") return addMilestoneStep(system.id, text, new Date(stepDate));
      if (stepType === "REPEATING") {
        return addRepeatingStep(system.id, {
          text,
          cadenceDays: Number(stepCadenceDays),
          endCondition: stepEndCondition,
          endValue: stepEndCondition === "FIXED_COUNT" ? Number(stepEndValue) : null,
        });
      }
      return addMeasureStep(system.id, {
        text,
        metricName: stepMetricName,
        unit: stepUnit.trim() || null,
        target: stepTarget ? Number(stepTarget) : null,
      });
    });
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleAddStep });
      return;
    }
    onChange({
      ...system,
      steps: [
        ...system.steps,
        {
          id: result.id,
          type: stepType,
          text,
          createdAt: new Date(),
          ...EMPTY_STEP,
          date: stepType === "MILESTONE" ? new Date(stepDate) : null,
          unit: stepType === "MEASURE" ? stepUnit.trim() || null : null,
          target: stepType === "MEASURE" && stepTarget ? Number(stepTarget) : null,
          metricName: stepType === "MEASURE" ? stepMetricName.trim() : null,
          cadenceDays: stepType === "REPEATING" ? Number(stepCadenceDays) : null,
          endCondition: stepType === "REPEATING" ? stepEndCondition : null,
          endValue: stepType === "REPEATING" && stepEndCondition === "FIXED_COUNT" ? Number(stepEndValue) : null,
        },
      ],
    });
    setStepText("");
    setStepDate("");
    setStepMetricName("");
    setStepUnit("");
    setStepTarget("");
  }

  async function handleLogOccurrence(stepId: string) {
    const raw = occurrenceDates[stepId];
    const occurredOn = raw ? new Date(raw) : now;
    const result = await withRetry(() => logSystemStepOccurrence(stepId, occurredOn));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleLogOccurrence(stepId) });
      return;
    }
    onChange({
      ...system,
      steps: system.steps.map((s) =>
        s.id === stepId ? { ...s, occurrences: [...s.occurrences, { id: result.id, occurredOn: result.occurredOn }] } : s
      ),
    });
    setOccurrenceDates((prev) => ({ ...prev, [stepId]: "" }));
  }

  async function handleDeleteOccurrence(stepId: string, occurrenceId: string) {
    const prevSteps = system.steps;
    onChange({
      ...system,
      steps: system.steps.map((s) =>
        s.id === stepId ? { ...s, occurrences: s.occurrences.filter((o) => o.id !== occurrenceId) } : s
      ),
    });
    const result = await withRetry(() => deleteSystemStepOccurrence(occurrenceId));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleDeleteOccurrence(stepId, occurrenceId) });
    }
  }

  async function handleToggleStep(step: SystemStepRow) {
    const nowDone = !step.done;
    const prevSteps = system.steps;
    onChange({
      ...system,
      steps: system.steps.map((s) =>
        s.id === step.id ? { ...s, done: nowDone, doneOn: nowDone ? new Date() : null } : s
      ),
    });
    const result = await withRetry(() => toggleSystemStep(step.id));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleToggleStep(step) });
      return;
    }
    // Tick-then-prompt: never blocks the tick, always optional/skippable.
    if (nowDone && step.type === "CHECKPOINT") {
      setCapturingStepId(step.id);
      setCaptureRating("");
      setCaptureComment("");
    } else if (nowDone && step.type === "MEASURE") {
      setCapturingStepId(step.id);
      setCaptureValue("");
    }
  }

  async function handleSaveMeasureCapture(stepId: string) {
    if (!captureValue) {
      setCapturingStepId(null);
      return;
    }
    const value = Number(captureValue);
    const prevSteps = system.steps;
    onChange({ ...system, steps: system.steps.map((s) => (s.id === stepId ? { ...s, value } : s)) });
    const result = await withRetry(() => captureMeasureValue(stepId, value));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleSaveMeasureCapture(stepId) });
      return;
    }
    setCapturingStepId(null);
  }

  async function handleSaveCapture(stepId: string) {
    const rating = captureRating ? Number(captureRating) : null;
    const comment = captureComment.trim() || null;
    const prevSteps = system.steps;
    onChange({ ...system, steps: system.steps.map((s) => (s.id === stepId ? { ...s, rating, comment } : s)) });
    const result = await withRetry(() => captureCheckpoint(stepId, { rating, comment }));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleSaveCapture(stepId) });
      return;
    }
    setCapturingStepId(null);
  }

  async function handlePhotoSelect(stepId: string, file: File | undefined) {
    if (!file) return;
    const validation = validatePhotoUpload(file.type, file.size);
    if (!validation.ok) {
      notifyError(validation.error);
      return;
    }
    setUploadingStepId(stepId);
    const result = await withRetry(() => uploadCheckpointPhoto(stepId, file));
    setUploadingStepId(null);
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handlePhotoSelect(stepId, file) });
      return;
    }
    onChange({
      ...system,
      steps: system.steps.map((s) => (s.id === stepId ? { ...s, photoUrl: result.photoUrl } : s)),
    });
  }

  async function handleDeletePhoto(stepId: string) {
    const prevSteps = system.steps;
    onChange({ ...system, steps: system.steps.map((s) => (s.id === stepId ? { ...s, photoUrl: null } : s)) });
    const result = await withRetry(() => deleteCheckpointPhoto(stepId));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleDeletePhoto(stepId) });
    }
  }

  async function handleBackdate(stepId: string) {
    if (!backdateValue) return;
    const doneOn = new Date(backdateValue);
    const prevSteps = system.steps;
    onChange({ ...system, steps: system.steps.map((s) => (s.id === stepId ? { ...s, doneOn } : s)) });
    const result = await withRetry(() => backdateSystemStep(stepId, doneOn));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleBackdate(stepId) });
      return;
    }
    setBackdatingStepId(null);
  }

  async function handleSaveStepEdit(stepId: string) {
    const text = editStepText.trim();
    if (!text) return;
    const prevSteps = system.steps;
    onChange({ ...system, steps: system.steps.map((s) => (s.id === stepId ? { ...s, text } : s)) });
    const result = await withRetry(() => updateChecklistStep(stepId, text));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleSaveStepEdit(stepId) });
      return;
    }
    setEditingStepId(null);
  }

  async function handleDeleteStep(stepId: string) {
    const prevSteps = system.steps;
    onChange({ ...system, steps: system.steps.filter((s) => s.id !== stepId) });
    const result = await withRetry(() => deleteSystemStep(stepId));
    if (!result.ok) {
      onChange({ ...system, steps: prevSteps });
      notifyError(result.error, { onRetry: () => handleDeleteStep(stepId) });
    }
  }

  async function handleSaveReference() {
    const result = await withRetry(() => updateSystemReference(system.id, referenceDraft));
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleSaveReference });
      return;
    }
    onChange({ ...system, reference: referenceDraft.trim() || null });
    setEditingReference(false);
  }

  async function handleAddDecision() {
    const body = decisionText.trim();
    if (!body) return;
    const result = await withRetry(() => addSystemDecision(system.id, body));
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleAddDecision });
      return;
    }
    onChange({ ...system, decisions: [{ id: result.id, when: result.when, body }, ...system.decisions] });
    setDecisionText("");
  }

  const note = STATE_NOTE[system.state];
  const ratingTrendData = ratingTrend(system.steps);
  const histogram = ratingHistogram(system.steps);
  const milestones = milestoneList(system.steps);
  const metricNames = distinctMetricNames(system.steps);
  // Small multiples: a metric's own trend/gauge renders once per distinct
  // metric, not just the first — otherwise a second metric's series would
  // exist only as a name in a list, never as a chart (DATA_MODEL.md §5).
  const singleMetric = metricNames ? null : (system.steps.find((s) => s.type === "MEASURE")?.metricName ?? null);
  const metricsToPlot = metricNames ?? (singleMetric ? [singleMetric] : []);
  const metricSeries = metricsToPlot.map((name) => ({
    name,
    trend: numericTrend(system.steps, name),
    gauge: targetGauge(system.steps, name),
  }));
  const repeatingSteps = system.steps.filter((s) => s.type === "REPEATING" && s.cadenceDays !== null);
  const scatterHabit = system.linkedHabits.find((h) => h.id === scatterHabitId) ?? system.linkedHabits[0] ?? null;
  const photos = photoStrip(system.steps);
  const beforeAfter = thenAndNow(system.steps);
  const scatter = scatterHabit ? ratingVsAdherence(system.steps, scatterHabit.checkInDates) : null;

  return (
    <div className={styles.systemCard} id={`system-${system.id}`}>
      {system.parent && (
        <a href={`#system-${system.parent.id}`} className={styles.insideThis}>
          Part of {system.parent.name}
        </a>
      )}
      {system.children.length > 0 && (
        <div className={styles.insideThis}>
          Inside this:{" "}
          {system.children.map((c, i) => (
            <span key={c.id}>
              {i > 0 && ", "}
              <a href={`#system-${c.id}`}>
                {c.name} ({c.state})
              </a>
            </span>
          ))}
        </div>
      )}
      <div className={styles.header}>
        <span className={styles.typeKicker}>{system.type === "EXPERIMENT" ? "Experiment" : "Process"}</span>
        <select
          className={styles.statePill}
          value={system.state}
          onChange={(e) => handleSetState(e.target.value as SystemState)}
        >
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="DRAFT">Draft</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button type="button" className={styles.link} onClick={handleDuplicate}>
          Duplicate
        </button>
        <button type="button" className={styles.link} onClick={handleToggleSequential}>
          {system.sequential ? "Sequential ✓" : "Make sequential"}
        </button>
        {system.children.length === 0 && parentOptions.length > 0 && (
          <select
            className={styles.statePill}
            value={system.parentId ?? ""}
            onChange={(e) => handleSetParent(e.target.value)}
          >
            <option value="">Not nested</option>
            {parentOptions.map((p) => (
              <option key={p.id} value={p.id}>
                Part of {p.name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className={styles.name}>{system.name}</div>
      {system.body && <p className={styles.body}>{system.body}</p>}
      {note && <p className={styles.stateNote}>{note}</p>}

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress(system.steps)}%` }} />
      </div>

      {(system.linkedHabits.length > 0 || system.linkedGoals.length > 0 || habitOptions.length > 0 || goalOptions.length > 0) && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Linked habits &amp; goals</div>
          <div className={styles.chipRow}>
            {system.linkedHabits.map((h) => (
              <Link key={h.id} href="/habits" className={styles.chip}>
                {h.name} ({h.status}) <button type="button" onClick={() => handleUnlinkHabit(h.id)}>×</button>
              </Link>
            ))}
            {system.linkedGoals.map((g) => (
              <Link key={g.id} href={`/goals/${g.id}`} className={styles.chip}>
                {g.name} ({g.status}) <button type="button" onClick={() => handleUnlinkGoal(g.id)}>×</button>
              </Link>
            ))}
          </div>
          <div className={styles.addForm}>
            {habitOptions.length > 0 && (
              <select className={styles.input} value="" onChange={(e) => handleLinkHabit(e.target.value)}>
                <option value="">Link a habit…</option>
                {habitOptions.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            )}
            {goalOptions.length > 0 && (
              <select className={styles.input} value="" onChange={(e) => handleLinkGoal(e.target.value)}>
                <option value="">Link a goal…</option>
                {goalOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}
      {scatterHabit && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            Rating vs.{" "}
            {system.linkedHabits.length > 1 ? (
              <select
                className={styles.input}
                value={scatterHabit.id}
                onChange={(e) => setScatterHabitId(e.target.value)}
              >
                {system.linkedHabits.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.name}
                  </option>
                ))}
              </select>
            ) : (
              scatterHabit.name
            )}
          </div>
          {scatter && scatter.ready ? (
            <p className={styles.body}>
              Avg rating with: {scatter.trueAvg.toFixed(1)} ({scatter.trueDays}d) · without:{" "}
              {scatter.falseAvg.toFixed(1)} ({scatter.falseDays}d)
            </p>
          ) : (
            <p className={styles.body}>
              Not enough data yet ({system.steps.filter((s) => s.rating !== null).length} rated Checkpoint
              {system.steps.filter((s) => s.rating !== null).length === 1 ? "" : "s"} so far) — needs 5+ ratings and
              at least 3 days on each side of &ldquo;{scatterHabit.name}&rdquo;.
            </p>
          )}
        </div>
      )}
      {photos && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Photos</div>
          <div className={styles.photoStrip}>
            {photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element -- Blob CDN URLs, not a static/local asset
              <img key={p.url} src={p.url} alt="" className={styles.photoThumb} title={p.date.toISOString().slice(0, 10)} />
            ))}
          </div>
        </div>
      )}
      {beforeAfter && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Then and now</div>
          <div className={styles.thenAndNow}>
            <div>
              <div className={styles.meta}>{beforeAfter.then.date.toISOString().slice(0, 10)}</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob CDN URLs, not a static/local asset */}
              <img src={beforeAfter.then.url} alt="Earliest" className={styles.photoThumbLarge} />
            </div>
            <div>
              <div className={styles.meta}>{beforeAfter.now.date.toISOString().slice(0, 10)}</div>
              {/* eslint-disable-next-line @next/next/no-img-element -- Blob CDN URLs, not a static/local asset */}
              <img src={beforeAfter.now.url} alt="Latest" className={styles.photoThumbLarge} />
            </div>
          </div>
        </div>
      )}

      <div className={styles.section}>
        {editingReference ? (
          <div className={styles.addForm}>
            <textarea
              className={styles.input}
              value={referenceDraft}
              onChange={(e) => setReferenceDraft(e.target.value)}
            />
            <button type="button" className={styles.add} onClick={handleSaveReference}>
              Save
            </button>
          </div>
        ) : system.reference ? (
          <p className={styles.reference} onClick={() => setEditingReference(true)}>
            {system.reference}
          </p>
        ) : (
          <button type="button" className={styles.link} onClick={() => setEditingReference(true)}>
            + Add reference material
          </button>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Decisions</div>
        {system.decisions.map((d) => (
          <div key={d.id} className={styles.decision}>
            <span className={styles.decisionDate}>{d.when.toISOString().slice(0, 10)}</span> {d.body}
          </div>
        ))}
        <div className={styles.addForm}>
          <input
            className={styles.input}
            placeholder="Log a decision"
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
          />
          <button type="button" className={styles.link} onClick={handleAddDecision}>
            + Log a decision
          </button>
        </div>
      </div>

      {ratingTrendData && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Rating over time</div>
          <ul className={styles.stepList}>
            {ratingTrendData.map((p) => (
              <li key={p.date.getTime()} className={styles.stepRow}>
                <span>{p.date.toISOString().slice(0, 10)}</span>
                <span>{p.rating}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {histogram && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>Rating distribution</div>
          <p className={styles.body}>
            Mean {histogram.mean.toFixed(1)}, spread {histogram.spread.toFixed(1)}
          </p>
        </div>
      )}
      {milestones && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            {isGanttEligible(milestones) ? "Timeline" : "Milestones"}
            {isGanttEligible(milestones) && (
              <button type="button" className={styles.link} onClick={() => setKanbanView((v) => !v)}>
                {kanbanView ? " · List view" : " · Board view"}
              </button>
            )}
          </div>
          {isGanttEligible(milestones) && kanbanView ? (
            <KanbanBoard milestones={milestones} today={now} />
          ) : isGanttEligible(milestones) ? (
            <GanttTimeline milestones={milestones} now={now} />
          ) : (
            <ul className={styles.stepList}>
              {[...milestones]
                .sort((a, b) => a.date!.getTime() - b.date!.getTime())
                .map((m) => (
                  <li key={m.text + m.date!.getTime()} className={styles.stepRow}>
                    <span>{m.text}</span>
                    <span>{m.date!.toISOString().slice(0, 10)}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
      {metricSeries.map(
        (series) =>
          (series.trend || series.gauge) && (
            <div key={series.name} className={styles.section}>
              {series.trend && (
                <>
                  <div className={styles.sectionLabel}>{series.name} over time</div>
                  <ul className={styles.stepList}>
                    {series.trend.map((p) => (
                      <li key={p.date.getTime()} className={styles.stepRow}>
                        <span>{p.date.toISOString().slice(0, 10)}</span>
                        <span>{p.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {series.gauge && (
                <p className={styles.body}>
                  {series.name}: start {series.gauge.start} → current {series.gauge.current} → target{" "}
                  {series.gauge.target}
                </p>
              )}
            </div>
          )
      )}
      {repeatingSteps.map((step) => {
        const schedule = {
          cadenceDays: step.cadenceDays!,
          anchorDate: step.createdAt,
          endCondition: step.endCondition as "FIXED_COUNT" | "REVIEW_DATE",
          endValue: step.endValue,
          reviewDate: system.review,
        };
        const expected = expectedOccurrenceDates(schedule, now);
        const logged = step.occurrences.map((o) => o.occurredOn);
        const statuses = classifyOccurrences(expected, logged, now);
        const breakdown = adherenceBreakdown(statuses, step.occurrences.length);
        const grid = streakGrid(logged, now);
        return (
          <div key={step.id} className={styles.section}>
            <div className={styles.sectionLabel}>{step.text} — 90-day streak</div>
            <div className={styles.streakGrid}>
              {grid.map((d) => (
                <span
                  key={d.date.getTime()}
                  className={d.done ? styles.streakDayDone : styles.streakDay}
                  title={d.date.toISOString().slice(0, 10)}
                />
              ))}
            </div>
            {breakdown && (
              <p className={styles.body}>
                On time {breakdown.onTime} · Late {breakdown.late} · Skipped {breakdown.skipped}
              </p>
            )}
          </div>
        );
      })}

      <div className={styles.section}>
        {system.sequential && system.steps.length > 0 && <div className={styles.sectionLabel}>Steps — in order</div>}
        <ol className={system.sequential ? styles.stepChain : styles.stepList}>
          {system.steps.map((step) =>
            editingStepId === step.id ? (
              <li key={step.id} className={styles.stepRow}>
                <input
                  className={styles.input}
                  value={editStepText}
                  onChange={(e) => setEditStepText(e.target.value)}
                  autoFocus
                />
                <button type="button" className={styles.link} onClick={() => handleSaveStepEdit(step.id)}>
                  Save
                </button>
                <button type="button" className={styles.link} onClick={() => setEditingStepId(null)}>
                  Cancel
                </button>
              </li>
            ) : (
              <li key={step.id} className={styles.stepRow}>
                <div>
                  {step.type === "REPEATING" ? (
                    <RepeatingStepRow
                      step={step}
                      now={now}
                      dateValue={occurrenceDates[step.id] ?? ""}
                      onDateChange={(v) => setOccurrenceDates((prev) => ({ ...prev, [step.id]: v }))}
                      onLog={() => handleLogOccurrence(step.id)}
                      onDeleteOccurrence={(occurrenceId) => handleDeleteOccurrence(step.id, occurrenceId)}
                    />
                  ) : (
                    <label>
                      <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(step)} />
                      <span className={step.done ? styles.stepDone : undefined}>{step.text}</span>
                    </label>
                  )}
                  {step.done && step.rating !== null && (
                    <span className={styles.meta}> · rated {step.rating}</span>
                  )}
                  {step.done && step.type === "MEASURE" && step.value !== null && (
                    <span className={styles.meta}>
                      {" "}
                      · {step.value}
                      {step.unit ?? ""}
                    </span>
                  )}
                  {capturingStepId === step.id && step.type === "CHECKPOINT" && (
                    <div className={styles.addForm}>
                      <select
                        className={styles.input}
                        value={captureRating}
                        onChange={(e) => setCaptureRating(e.target.value)}
                      >
                        <option value="">No rating</option>
                        {[1, 2, 3, 4, 5].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                      <input
                        className={styles.input}
                        placeholder="Comment (optional)"
                        value={captureComment}
                        onChange={(e) => setCaptureComment(e.target.value)}
                      />
                      <button type="button" className={styles.link} onClick={() => handleSaveCapture(step.id)}>
                        Save
                      </button>
                      <button type="button" className={styles.link} onClick={() => setCapturingStepId(null)}>
                        Skip
                      </button>
                    </div>
                  )}
                  {step.type === "CHECKPOINT" && (
                    <div className={styles.meta}>
                      {step.photoUrl ? (
                        <>
                          {" "}
                          · photo attached{" "}
                          <button type="button" className={styles.link} onClick={() => handleDeletePhoto(step.id)}>
                            remove
                          </button>
                        </>
                      ) : (
                        <>
                          {" "}
                          ·{" "}
                          <label className={styles.link}>
                            {uploadingStepId === step.id ? "Uploading…" : "add photo"}
                            <input
                              type="file"
                              accept="image/*"
                              hidden
                              disabled={uploadingStepId === step.id}
                              onChange={(e) => handlePhotoSelect(step.id, e.target.files?.[0])}
                            />
                          </label>
                        </>
                      )}
                    </div>
                  )}
                  {capturingStepId === step.id && step.type === "MEASURE" && (
                    <div className={styles.addForm}>
                      <input
                        className={styles.input}
                        type="number"
                        placeholder={`Value${step.unit ? ` (${step.unit})` : ""}`}
                        value={captureValue}
                        onChange={(e) => setCaptureValue(e.target.value)}
                      />
                      <button
                        type="button"
                        className={styles.link}
                        onClick={() => handleSaveMeasureCapture(step.id)}
                      >
                        Save
                      </button>
                      <button type="button" className={styles.link} onClick={() => setCapturingStepId(null)}>
                        Skip
                      </button>
                    </div>
                  )}
                  {step.done && backdatingStepId === step.id && (
                    <div className={styles.addForm}>
                      <input
                        type="date"
                        className={styles.input}
                        value={backdateValue}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(e) => setBackdateValue(e.target.value)}
                      />
                      <button type="button" className={styles.link} onClick={() => handleBackdate(step.id)}>
                        Save
                      </button>
                      <button type="button" className={styles.link} onClick={() => setBackdatingStepId(null)}>
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                <span>
                  {step.done && (
                    <button
                      type="button"
                      className={styles.link}
                      onClick={() => {
                        setBackdatingStepId(step.id);
                        setBackdateValue(step.doneOn ? step.doneOn.toISOString().slice(0, 10) : "");
                      }}
                    >
                      Not today?
                    </button>
                  )}{" "}
                  <button
                    type="button"
                    className={styles.link}
                    onClick={() => {
                      setEditingStepId(step.id);
                      setEditStepText(step.text);
                    }}
                  >
                    Edit
                  </button>{" "}
                  <button type="button" className={styles.link} onClick={() => handleDeleteStep(step.id)}>
                    Delete
                  </button>
                </span>
              </li>
            )
          )}
        </ol>
        <div className={styles.addForm}>
          <input
            className={styles.input}
            placeholder="Add a step"
            value={stepText}
            onChange={(e) => setStepText(e.target.value)}
          />
          <select
            className={styles.input}
            value={stepType}
            onChange={(e) =>
              setStepType(e.target.value as "CHECKLIST" | "CHECKPOINT" | "MILESTONE" | "MEASURE" | "REPEATING")
            }
          >
            <option value="CHECKLIST">Checklist</option>
            <option value="CHECKPOINT">Checkpoint</option>
            <option value="MILESTONE">Dated milestone</option>
            <option value="MEASURE">Measure</option>
            <option value="REPEATING">Repeating</option>
          </select>
          {stepType === "MILESTONE" && (
            <input
              type="date"
              className={styles.input}
              value={stepDate}
              onChange={(e) => setStepDate(e.target.value)}
            />
          )}
          {stepType === "MEASURE" && (
            <>
              <input
                className={styles.input}
                placeholder="Metric name (e.g. Weight)"
                value={stepMetricName}
                onChange={(e) => setStepMetricName(e.target.value)}
              />
              <input
                className={styles.input}
                placeholder="Unit (optional)"
                value={stepUnit}
                onChange={(e) => setStepUnit(e.target.value)}
              />
              <input
                type="number"
                className={styles.input}
                placeholder="Target (optional)"
                value={stepTarget}
                onChange={(e) => setStepTarget(e.target.value)}
              />
            </>
          )}
          {stepType === "REPEATING" && (
            <>
              <input
                type="number"
                min={1}
                className={styles.input}
                placeholder="Every N days"
                value={stepCadenceDays}
                onChange={(e) => setStepCadenceDays(e.target.value)}
              />
              <select
                className={styles.input}
                value={stepEndCondition}
                onChange={(e) => setStepEndCondition(e.target.value as "FIXED_COUNT" | "REVIEW_DATE")}
              >
                <option value="FIXED_COUNT">Fixed count</option>
                <option value="REVIEW_DATE" disabled={!system.review}>
                  Until review date{!system.review ? " (Experiment only)" : ""}
                </option>
              </select>
              {stepEndCondition === "FIXED_COUNT" && (
                <input
                  type="number"
                  min={1}
                  className={styles.input}
                  placeholder="Occurrence count"
                  value={stepEndValue}
                  onChange={(e) => setStepEndValue(e.target.value)}
                />
              )}
            </>
          )}
          <button type="button" className={styles.link} onClick={handleAddStep}>
            + Add step
          </button>
        </div>
      </div>
    </div>
  );
}

/** A real horizontal timeline: each milestone positioned proportionally
 * along a date axis (earliest milestone to latest, padded a week either
 * side), with a now-line marking today's position — not just a sorted
 * list with a glyph on past items. */
function RepeatingStepRow({
  step,
  now,
  dateValue,
  onDateChange,
  onLog,
  onDeleteOccurrence,
}: {
  step: SystemStepRow;
  now: Date;
  dateValue: string;
  onDateChange: (v: string) => void;
  onLog: () => void;
  onDeleteOccurrence: (occurrenceId: string) => void;
}) {
  const recent = [...step.occurrences].sort((a, b) => b.occurredOn.getTime() - a.occurredOn.getTime()).slice(0, 5);
  return (
    <div>
      <div className={styles.repeatingRow}>
        <span>
          {step.text}
          <span className={styles.meta}>
            {" "}
            · every {step.cadenceDays}d ·{" "}
            {step.endCondition === "FIXED_COUNT" ? `${step.endValue} occurrences` : "until review"} · logged{" "}
            {step.occurrences.length}
          </span>
        </span>
        <span>
          <input
            type="date"
            className={styles.input}
            value={dateValue}
            max={now.toISOString().slice(0, 10)}
            onChange={(e) => onDateChange(e.target.value)}
            placeholder="Today"
          />
          <button type="button" className={styles.link} onClick={onLog}>
            Log occurrence
          </button>
        </span>
      </div>
      {recent.length > 0 && (
        <div className={styles.meta}>
          {recent.map((o) => (
            <span key={o.id}>
              {" "}
              {o.occurredOn.toISOString().slice(0, 10)}
              <button type="button" className={styles.link} onClick={() => onDeleteOccurrence(o.id)}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function GanttTimeline({ milestones, now }: { milestones: MilestoneStep[]; now: Date }) {
  const sorted = [...milestones].sort((a, b) => a.date!.getTime() - b.date!.getTime());
  const padMs = 7 * 24 * 60 * 60 * 1000;
  const start = sorted[0].date!.getTime() - padMs;
  const end = sorted[sorted.length - 1].date!.getTime() + padMs;
  const span = Math.max(end - start, 1);
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - start) / span) * 100))}%`;

  return (
    <div className={styles.gantt}>
      <div className={styles.ganttAxis}>
        <div className={styles.ganttNowLine} style={{ left: pct(now.getTime()) }} title="Today" />
        {sorted.map((m) => (
          <div
            key={m.text + m.date!.getTime()}
            className={`${styles.ganttPoint} ${m.done ? styles.ganttPointDone : ""}`}
            style={{ left: pct(m.date!.getTime()) }}
            title={`${m.text} — ${m.date!.toISOString().slice(0, 10)}`}
          />
        ))}
      </div>
      <ul className={styles.stepList}>
        {sorted.map((m) => (
          <li key={m.text + m.date!.getTime()} className={styles.stepRow}>
            <span>{m.text}</span>
            <span>{m.date!.toISOString().slice(0, 10)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const KANBAN_COLUMNS: { key: KanbanColumn; label: string }[] = [
  { key: "NOT_STARTED", label: "Not started" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "DONE", label: "Done" },
];

function KanbanBoard({ milestones, today }: { milestones: MilestoneStep[]; today: Date }) {
  return (
    <div className={styles.kanban}>
      {KANBAN_COLUMNS.map((col) => (
        <div key={col.key} className={styles.kanbanColumn}>
          <div className={styles.sectionLabel}>{col.label}</div>
          {milestones
            .filter((m) => kanbanColumn(m, today) === col.key)
            .map((m) => (
              <div key={m.text + m.date!.getTime()} className={styles.kanbanCard}>
                {m.text}
                <span className={styles.meta}> {m.date!.toISOString().slice(0, 10)}</span>
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
