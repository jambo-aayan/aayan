"use client";

import { useState } from "react";
import { Ruler } from "lucide-react";
import { createMetric, updateMetric, archiveMetric, type MetricInput } from "@/lib/metrics/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { PrimaryButton } from "@/components/primary-button";
import { EmptyState } from "@/components/empty-state";
import { RowActions } from "@/components/row-actions";
import styles from "./metric-manager.module.css";

export type MetricRow = {
  id: string;
  name: string;
  valueType: "NUMBER" | "SCALE_5" | "BOOLEAN" | "ENUM" | "TEXT";
  cadence: "DAILY" | "WEEKLY" | "AD_HOC";
  required: boolean;
  unit: string | null;
  enumOptions: string | null;
  pillarId: string | null;
  areaId: string | null;
};

type Pillar = { id: string; name: string };
type Area = { id: string; name: string; pillarId: string };

const VALUE_TYPE_LABELS: Record<MetricRow["valueType"], string> = {
  NUMBER: "Number",
  SCALE_5: "1–5 scale",
  BOOLEAN: "Yes / no",
  ENUM: "Multiple choice",
  TEXT: "Text",
};

const CADENCE_LABELS: Record<MetricRow["cadence"], string> = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  AD_HOC: "Ad hoc",
};

function parseEnumOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Create/edit/archive Metrics (#183) — the definitions the Log tab (#184)
 * reads to know what's due and how to render each entry field. Archive is
 * the only removal path (see the Metric schema's own doc comment): a
 * Metric's history/correlations stay intact once archived, it just stops
 * appearing as loggable/due. */
export function MetricManager({
  metrics,
  pillars,
  areas,
}: {
  metrics: MetricRow[];
  pillars: Pillar[];
  areas: Area[];
}) {
  const [rows, setRows] = useState(metrics);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { notifyError } = useToast();

  function upsertRow(row: MetricRow) {
    setRows((prev) => [...prev.filter((r) => r.id !== row.id), row].sort((a, b) => a.name.localeCompare(b.name)));
  }

  async function handleArchive(id: string) {
    const result = await withRetry(() => archiveMetric(id));
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => handleArchive(id) });
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div>
      <ul className={styles.list}>
        {rows.map((m) =>
          editingId === m.id ? (
            <li key={m.id} className={styles.row}>
              <MetricForm
                pillars={pillars}
                areas={areas}
                initial={m}
                notifyError={notifyError}
                onCancel={() => setEditingId(null)}
                onSaved={(row) => {
                  upsertRow(row);
                  setEditingId(null);
                }}
              />
            </li>
          ) : (
            <li key={m.id} className={styles.row}>
              <div className={styles.summary}>
                <span className={styles.name}>
                  {m.name}
                  {m.required && <span className={styles.requiredBadge}>Required</span>}
                </span>
                <span className={styles.meta}>
                  {VALUE_TYPE_LABELS[m.valueType]} · {CADENCE_LABELS[m.cadence]}
                  {m.unit ? ` · ${m.unit}` : ""}
                </span>
              </div>
              <RowActions>
                <button type="button" className={styles.link} onClick={() => setEditingId(m.id)}>
                  Edit
                </button>
                <button type="button" className={styles.link} onClick={() => handleArchive(m.id)}>
                  Archive
                </button>
              </RowActions>
            </li>
          )
        )}
      </ul>
      {rows.length === 0 && !adding && <EmptyState icon={Ruler} message="No metrics yet." />}

      {adding ? (
        <div className={styles.addWrap}>
          <MetricForm
            pillars={pillars}
            areas={areas}
            initial={null}
            notifyError={notifyError}
            onCancel={() => setAdding(false)}
            onSaved={(row) => {
              upsertRow(row);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <PrimaryButton className={styles.addButton} onClick={() => setAdding(true)}>
          + Add metric
        </PrimaryButton>
      )}
    </div>
  );
}

type NotifyError = ReturnType<typeof useToast>["notifyError"];

function MetricForm({
  pillars,
  areas,
  initial,
  notifyError,
  onCancel,
  onSaved,
}: {
  pillars: Pillar[];
  areas: Area[];
  initial: MetricRow | null;
  notifyError: NotifyError;
  onCancel: () => void;
  onSaved: (row: MetricRow) => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [valueType, setValueType] = useState<MetricRow["valueType"]>(initial?.valueType ?? "SCALE_5");
  const [cadence, setCadence] = useState<MetricRow["cadence"]>(initial?.cadence ?? "DAILY");
  const [required, setRequired] = useState(initial?.required ?? false);
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [enumOptionsText, setEnumOptionsText] = useState(parseEnumOptions(initial?.enumOptions ?? null).join(", "));
  const [pillarId, setPillarId] = useState(initial?.pillarId ?? "");
  const [areaId, setAreaId] = useState(initial?.areaId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const areaOptions = areas.filter((a) => a.pillarId === pillarId);

  async function handleSave() {
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    const enumOptions = valueType === "ENUM" ? enumOptionsText.split(",").map((o) => o.trim()).filter(Boolean) : null;
    if (valueType === "ENUM" && (!enumOptions || enumOptions.length < 2)) {
      setError("Enum metrics need at least 2 options.");
      return;
    }

    const input: MetricInput = {
      name,
      valueType,
      cadence,
      required,
      unit: unit.trim() || null,
      enumOptions,
      pillarId: pillarId || null,
      areaId: areaId || null,
    };

    setSaving(true);
    setError(null);
    const result = await withRetry(() => (initial ? updateMetric(initial.id, input) : createMetric(input)));
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      notifyError(result.error, { onRetry: handleSave });
      return;
    }
    onSaved({
      id: result.id,
      name: input.name.trim(),
      valueType,
      cadence,
      required,
      unit: input.unit ?? null,
      enumOptions: enumOptions ? JSON.stringify(enumOptions) : null,
      pillarId: input.pillarId ?? null,
      areaId: input.areaId ?? null,
    });
  }

  return (
    <div className={styles.form}>
      <input
        className={styles.input}
        placeholder="Name"
        aria-label="Metric name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <select className={styles.input} aria-label="Value type" value={valueType} onChange={(e) => setValueType(e.target.value as MetricRow["valueType"])}>
        {Object.entries(VALUE_TYPE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select className={styles.input} aria-label="Cadence" value={cadence} onChange={(e) => setCadence(e.target.value as MetricRow["cadence"])}>
        {Object.entries(CADENCE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <label className={styles.checkboxLabel}>
        <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
        Required — missed entries nudge
      </label>

      <input
        className={styles.input}
        placeholder="Unit (optional, e.g. kg)"
        aria-label="Unit"
        value={unit}
        onChange={(e) => setUnit(e.target.value)}
      />

      {valueType === "ENUM" && (
        <input
          className={styles.input}
          placeholder="Options, comma-separated (e.g. None, Mild, Moderate, Bad)"
          aria-label="Enum options"
          value={enumOptionsText}
          onChange={(e) => setEnumOptionsText(e.target.value)}
        />
      )}

      <select
        className={styles.input}
        aria-label="Pillar scope"
        value={pillarId}
        onChange={(e) => {
          setPillarId(e.target.value);
          setAreaId("");
        }}
      >
        <option value="">Global (no pillar)</option>
        {pillars.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {pillarId && (
        <select className={styles.input} aria-label="Area scope" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Whole pillar (no specific area)</option>
          {areaOptions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      )}

      <div className={styles.formActions}>
        <PrimaryButton onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </PrimaryButton>
        <button type="button" className={styles.link} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  );
}
