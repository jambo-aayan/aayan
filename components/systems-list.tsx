"use client";

import { useState } from "react";
import type { SystemType, SystemState } from "@/lib/systems/logic";
import {
  createSystem,
  setSystemState,
  updateSystemReference,
  duplicateSystem,
  addChecklistStep,
  addCheckpointStep,
  captureCheckpoint,
  addMilestoneStep,
  addMeasureStep,
  captureMeasureValue,
  updateChecklistStep,
  toggleSystemStep,
  backdateSystemStep,
  deleteSystemStep,
  addSystemDecision,
} from "@/lib/systems/actions";
import { ratingTrend, ratingHistogram, milestoneList, numericTrend, targetGauge, distinctMetricNames } from "@/lib/systems/widgets";
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
  date: Date | null;
  value: number | null;
  unit: string | null;
  target: number | null;
  metricName: string | null;
};
export type SystemDecisionRow = { id: string; when: Date; body: string };
export type AreaSystem = {
  id: string;
  name: string;
  type: SystemType;
  state: SystemState;
  body: string | null;
  reference: string | null;
  steps: SystemStepRow[];
  decisions: SystemDecisionRow[];
  children: { id: string; name: string; state: SystemState }[];
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
}: {
  areaId: string | null;
  pillarId: string;
  initialSystems: AreaSystem[];
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
        steps: [],
        decisions: [],
        children: [],
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

function SystemCard({ system, onChange }: { system: AreaSystem; onChange: (next: AreaSystem) => void }) {
  const [stepText, setStepText] = useState("");
  const [stepType, setStepType] = useState<"CHECKLIST" | "CHECKPOINT" | "MILESTONE" | "MEASURE">("CHECKLIST");
  const [stepDate, setStepDate] = useState("");
  const [stepMetricName, setStepMetricName] = useState("");
  const [stepUnit, setStepUnit] = useState("");
  const [stepTarget, setStepTarget] = useState("");
  const [decisionText, setDecisionText] = useState("");
  const [referenceDraft, setReferenceDraft] = useState(system.reference ?? "");
  const [editingReference, setEditingReference] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editStepText, setEditStepText] = useState("");
  const [capturingStepId, setCapturingStepId] = useState<string | null>(null);
  const [captureRating, setCaptureRating] = useState("");
  const [captureComment, setCaptureComment] = useState("");
  const [captureValue, setCaptureValue] = useState("");
  const [backdatingStepId, setBackdatingStepId] = useState<string | null>(null);
  const [backdateValue, setBackdateValue] = useState("");
  const { notifyError } = useToast();

  async function handleSetState(state: SystemState) {
    const prev = system;
    onChange({ ...system, state });
    const result = await withRetry(() => setSystemState(system.id, state));
    if (!result.ok) {
      onChange(prev);
      notifyError(result.error, { onRetry: () => handleSetState(state) });
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

  const EMPTY_STEP: Omit<SystemStepRow, "id" | "type" | "text"> = {
    done: false,
    doneOn: null,
    rating: null,
    comment: null,
    date: null,
    value: null,
    unit: null,
    target: null,
    metricName: null,
  };

  async function handleAddStep() {
    const text = stepText.trim();
    if (!text) return;

    if (stepType === "MILESTONE" && !stepDate) return;
    if (stepType === "MEASURE" && !stepMetricName.trim()) return;

    const result = await withRetry(() => {
      if (stepType === "CHECKLIST") return addChecklistStep(system.id, text);
      if (stepType === "CHECKPOINT") return addCheckpointStep(system.id, text, null);
      if (stepType === "MILESTONE") return addMilestoneStep(system.id, text, new Date(stepDate));
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
          ...EMPTY_STEP,
          date: stepType === "MILESTONE" ? new Date(stepDate) : null,
          unit: stepType === "MEASURE" ? stepUnit.trim() || null : null,
          target: stepType === "MEASURE" && stepTarget ? Number(stepTarget) : null,
          metricName: stepType === "MEASURE" ? stepMetricName.trim() : null,
        },
      ],
    });
    setStepText("");
    setStepDate("");
    setStepMetricName("");
    setStepUnit("");
    setStepTarget("");
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

  return (
    <div className={styles.systemCard}>
      {system.children.length > 0 && (
        <div className={styles.insideThis}>
          Inside this: {system.children.map((c) => `${c.name} (${c.state})`).join(", ")}
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
      </div>
      <div className={styles.name}>{system.name}</div>
      {system.body && <p className={styles.body}>{system.body}</p>}
      {note && <p className={styles.stateNote}>{note}</p>}

      <div className={styles.progressBar}>
        <div className={styles.progressFill} style={{ width: `${progress(system.steps)}%` }} />
      </div>

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
          <div className={styles.sectionLabel}>Milestones</div>
          <ul className={styles.stepList}>
            {milestones.map((m) => (
              <li key={m.text + m.date!.getTime()} className={styles.stepRow}>
                <span>{m.text}</span>
                <span>{m.date!.toISOString().slice(0, 10)}</span>
              </li>
            ))}
          </ul>
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

      <div className={styles.section}>
        <ul className={styles.stepList}>
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
                  <label>
                    <input type="checkbox" checked={step.done} onChange={() => handleToggleStep(step)} />
                    <span className={step.done ? styles.stepDone : undefined}>{step.text}</span>
                  </label>
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
        </ul>
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
            onChange={(e) => setStepType(e.target.value as "CHECKLIST" | "CHECKPOINT" | "MILESTONE" | "MEASURE")}
          >
            <option value="CHECKLIST">Checklist</option>
            <option value="CHECKPOINT">Checkpoint</option>
            <option value="MILESTONE">Dated milestone</option>
            <option value="MEASURE">Measure</option>
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
          <button type="button" className={styles.link} onClick={handleAddStep}>
            + Add step
          </button>
        </div>
      </div>
    </div>
  );
}
