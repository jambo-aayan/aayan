"use client";

import { useState } from "react";
import Link from "next/link";
import type { SystemType, SystemState, SystemVerdict } from "@/lib/systems/logic";
import type { AreaLoadRow, TimelineRow, RollupRow, WhatWorkedRow } from "@/lib/systems/data";
import { createSystem } from "@/lib/systems/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { HEALTH_PILLAR_ID } from "@/lib/health/seed-data";
import styles from "./systems-tab.module.css";

export type { AreaLoadRow, TimelineRow, RollupRow, WhatWorkedRow };

const TIMELINE_HORIZON_DAYS = 90;

const STATE_LABEL: Record<SystemState, string> = { ACTIVE: "Active", PAUSED: "Paused", DRAFT: "Draft", ARCHIVED: "Archived" };
const VERDICT_LABEL: Record<SystemVerdict, string> = { CONTINUE: "Continued", ESCALATE: "Escalated", STOP: "Stopped" };
const VERDICT_STYLE: Record<SystemVerdict, string> = {
  CONTINUE: styles.verdictContinue,
  ESCALATE: styles.verdictEscalate,
  STOP: styles.verdictStop,
};
const DAY_MS = 24 * 60 * 60 * 1000;

/** A System's card is only reachable today if it's Area-scoped under
 * Health, the only pillar with a wired-up detail page — no per-Pillar
 * route exists anywhere in the app (confirmed while fixing #100's
 * revalidateSystemPaths), and pillar-level Systems (no Area) have no card
 * at all yet, in any pillar. For those, link plainly to /pillars — the
 * general index, same fallback My Day's upcomingStepHref already uses —
 * rather than appending a `#system-…` anchor that would silently resolve
 * to nothing. */
function systemHref(row: { id: string; areaId: string | null; pillarId: string }): string {
  if (row.areaId && row.pillarId === HEALTH_PILLAR_ID) return `/health/${row.areaId}#system-${row.id}`;
  return "/pillars";
}

/** Type-appropriate status text for a rollup row — matches the category a
 * row falls into per lib/systems/logic.ts's rollupCategory/sortRollup, so
 * the label always agrees with where the row sorted. */
function rollupStatus(row: RollupRow, today: Date): string {
  if (row.state !== "ACTIVE") return STATE_LABEL[row.state];
  if (row.type === "EXPERIMENT") {
    if (row.verdict) return VERDICT_LABEL[row.verdict];
    if (row.review) {
      const days = Math.round((row.review.getTime() - today.getTime()) / DAY_MS);
      return days <= 0 ? "Review due" : `review in ${days} day${days === 1 ? "" : "s"}`;
    }
    return "No review date set";
  }
  return `${row.stepsDone}/${row.totalSteps} steps done`;
}

const EMPTY_FORM = { name: "", pillarId: "", areaId: "", type: "PROCESS" as SystemType, body: "", review: "", criteria: "" };

export function SystemsTab({
  areaLoad,
  loadSummary,
  timeline,
  rollup,
  whatWorked,
  pillars,
  areas,
  today,
}: {
  areaLoad: AreaLoadRow[];
  loadSummary: string | null;
  timeline: TimelineRow[];
  rollup: RollupRow[];
  whatWorked: WhatWorkedRow[];
  pillars: { id: string; name: string }[];
  areas: { id: string; name: string; pillarId: string }[];
  today: Date;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { notifyError } = useToast();

  const areasForPillar = areas.filter((a) => a.pillarId === form.pillarId);
  const maxLoad = Math.max(1, ...areaLoad.map((a) => a.count));

  async function handleAdd() {
    if (!form.pillarId) {
      setError("Pick an Area's Pillar first.");
      return;
    }
    setAdding(true);
    setError(null);
    const result = await withRetry(() =>
      createSystem({
        name: form.name,
        pillarId: form.pillarId,
        areaId: form.areaId || null,
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
    setForm(EMPTY_FORM);
  }

  return (
    <div>
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Load</div>
        {loadSummary && <p className={styles.summary}>{loadSummary}</p>}
        {areaLoad.map((area) => (
          <div key={area.id} className={styles.loadTrack}>
            <span className={styles.loadName}>{area.name}</span>
            <span className={styles.loadBar}>
              <span className={styles.loadFill} style={{ width: `${(area.count / maxLoad) * 100}%` }} />
            </span>
            <span className={styles.loadCount}>{area.count || "none"}</span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Everything running</div>
        {timeline.length === 0 && <p className={styles.empty}>Nothing active right now.</p>}
        {timeline.map((row) => (
          <div key={row.id} className={styles.timelineRow}>
            <span className={styles.timelineName}>{row.name}</span>
            <span className={styles.timelineTrack}>
              <span
                className={row.type === "EXPERIMENT" ? styles.timelineBarExperiment : styles.timelineBarProcess}
                style={{
                  width:
                    row.endOffsetDays === null
                      ? "100%"
                      : `${Math.min(100, (row.endOffsetDays / TIMELINE_HORIZON_DAYS) * 100)}%`,
                }}
              />
            </span>
          </div>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Rollup</div>
        {rollup.length === 0 && <p className={styles.empty}>No Systems yet.</p>}
        {rollup.map((row) => (
          <Link key={row.id} href={systemHref(row)} className={styles.rollupRow}>
            <div className={styles.rollupMain}>
              <span className={styles.rollupName}>{row.name}</span>
              <span className={styles.rollupMeta}>
                <span className={styles.typeBadge}>{row.type === "EXPERIMENT" ? "Experiment" : "Process"}</span>
                {row.areaName ?? "Pillar-level"}
              </span>
            </div>
            <span className={styles.status}>{rollupStatus(row, today)}</span>
          </Link>
        ))}
      </div>

      <div className={styles.section}>
        <div className={styles.sectionLabel}>Add a system</div>
        <div className={styles.addForm}>
          <input
            className={styles.input}
            placeholder="System name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <select
            className={styles.input}
            value={form.pillarId}
            onChange={(e) => setForm((f) => ({ ...f, pillarId: e.target.value, areaId: "" }))}
          >
            <option value="">Pillar…</option>
            {pillars.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {form.pillarId && (
            <select className={styles.input} value={form.areaId} onChange={(e) => setForm((f) => ({ ...f, areaId: e.target.value }))}>
              <option value="">Pillar-level (no Area)</option>
              {areasForPillar.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
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

      <div className={styles.section}>
        <div className={styles.sectionLabel}>What worked</div>
        {whatWorked.length === 0 && <p className={styles.empty}>No Experiments have reached a verdict yet.</p>}
        {whatWorked.map((row) => (
          <div key={row.id} className={styles.verdictEntry}>
            <span className={`${styles.verdictPill} ${VERDICT_STYLE[row.verdict]}`}>{VERDICT_LABEL[row.verdict]}</span>
            <span className={styles.verdictName}>{row.name}</span>
            <div className={styles.verdictDetail}>Said in advance: {row.criteria || "no success criteria was set"}</div>
            {row.runOutcome && <div className={styles.verdictDetail}>{row.runOutcome}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
