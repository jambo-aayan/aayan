"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import type { SystemType, SystemState, SystemVerdict } from "@/lib/systems/logic";
import { filterRollupByName } from "@/lib/systems/logic";
import type { AreaLoadRow, TimelineRow, RollupRow, WhatWorkedRow } from "@/lib/systems/data";
import { createSystem } from "@/lib/systems/actions";
import { withRetry } from "@/lib/with-retry";
import { useToast } from "@/components/toast/toast-provider";
import { HEALTH_PILLAR_ID } from "@/lib/health/seed-data";
import { FINANCE_PILLAR_ID } from "@/lib/finance/pillar-id";
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

/** A pillar-scoped System (no Area — e.g. Finances' own "Payday routine")
 * deep-links to its Pillar's own page rather than an Area page, per
 * #108. Health and Finances are the only pillars with a dedicated page
 * today (`/health`, `/finances`); any other pillar (and any Area-scoped
 * System whose Area doesn't have a wired-up detail page — only Health's
 * `/health/[areaId]` exists) falls back to the general /pillars index,
 * same fallback My Day's upcomingStepHref already uses — that index has
 * no System card to focus. */
function pillarHref(pillarId: string): string | null {
  if (pillarId === HEALTH_PILLAR_ID) return "/health";
  if (pillarId === FINANCE_PILLAR_ID) return "/finances";
  return null;
}

/** Deep-links into a System's card: Area-scoped under Health lands on
 * that Area's page, pillar-scoped Systems land on their own Pillar's page
 * (Health/Finances both render a pillar-level Systems list) — either way
 * floated to the top, ringed in coral, with a dismissible "Opened from
 * the Systems list" strip (SystemsList/SystemCard's `focusId` prop). The
 * `#system-…` anchor is a same-page fallback for a no-JS load. A pillar
 * with no dedicated page yet falls back to the general /pillars index,
 * without a focus param since there's no card there to find. */
function systemHref(row: { id: string; areaId: string | null; pillarId: string }): string {
  if (row.areaId && row.pillarId === HEALTH_PILLAR_ID) return `/health/${row.areaId}?focus=${row.id}#system-${row.id}`;
  const pillarPage = pillarHref(row.pillarId);
  return pillarPage ? `${pillarPage}?focus=${row.id}#system-${row.id}` : "/pillars";
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [rollupQuery, setRollupQuery] = useState(searchParams.get("q") ?? "");

  // Debounced so the URL (and any RSC refetch it triggers) settles a beat
  // after typing stops, rather than on every keystroke — the filtering
  // itself is instant client-side (below), this is only for shareability.
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (rollupQuery === current) return;
    const timer = setTimeout(() => {
      const next = new URLSearchParams(searchParams.toString());
      if (rollupQuery) next.set("q", rollupQuery);
      else next.delete("q");
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-sync on rollupQuery changing, not on every searchParams/router identity change
  }, [rollupQuery]);

  const filteredRollup = filterRollupByName(rollup, rollupQuery);
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
        {rollup.length > 0 && (
          <input
            type="search"
            className={`${styles.input} ${styles.rollupSearch}`}
            placeholder="Search by name…"
            value={rollupQuery}
            onChange={(e) => setRollupQuery(e.target.value)}
            aria-label="Search the rollup by name"
          />
        )}
        {rollup.length === 0 && <p className={styles.empty}>No Systems yet.</p>}
        {rollup.length > 0 && filteredRollup.length === 0 && (
          <p className={styles.empty}>No Systems match &ldquo;{rollupQuery}&rdquo;.</p>
        )}
        {filteredRollup.map((row) => (
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
