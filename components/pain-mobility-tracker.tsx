"use client";

import { useState } from "react";
import { logPainMobility, deletePainMobilityLog } from "@/lib/pain-mobility/actions";
import { weeklyAverage, weekTrend, type Trend } from "@/lib/pain-mobility/trend";
import { mondayOf } from "@/lib/habits/streak";
import styles from "./pain-mobility-tracker.module.css";

type Log = { id: string; date: Date; pain: number; mobility: number };

function toDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** The user's local calendar "today", not UTC — a browser west of UTC could
 * otherwise default the log form to tomorrow's date in the evening. Stored
 * log dates stay UTC-midnight; only "what does today default to" cares
 * about the local clock. */
function todayLocalDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function trendLabel(trend: Trend | null): string {
  if (trend === null) return "not enough data yet";
  if (trend === "UP") return "up vs last week";
  if (trend === "DOWN") return "down vs last week";
  return "steady vs last week";
}

function WeeklyStat({
  label,
  logs,
  field,
  thisWeekStart,
  priorWeekStart,
}: {
  label: string;
  logs: Log[];
  field: "pain" | "mobility";
  thisWeekStart: Date;
  priorWeekStart: Date;
}) {
  const values = logs.map((l) => ({ date: l.date, value: l[field] }));
  const current = weeklyAverage(values, thisWeekStart);
  const prior = weeklyAverage(values, priorWeekStart);
  const trend = weekTrend(current, prior);

  return (
    <div className={styles.stat}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statNum}>{current !== null ? current.toFixed(1) : "—"}</div>
      <div className={styles.statSub}>{trendLabel(trend)}</div>
    </div>
  );
}

export function PainMobilityTracker({ areaId, initialLogs }: { areaId: string; initialLogs: Log[] }) {
  const [logs, setLogs] = useState(initialLogs);
  const [date, setDate] = useState(todayLocalDateString());
  const [pain, setPain] = useState(5);
  const [mobility, setMobility] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todayAtUtcMidnight = new Date(`${todayLocalDateString()}T00:00:00.000Z`);
  const thisWeekStart = mondayOf(todayAtUtcMidnight);
  const priorWeekStart = new Date(thisWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  async function handleLog() {
    setSaving(true);
    setError(null);
    const result = await logPainMobility(areaId, {
      date: new Date(`${date}T00:00:00.000Z`),
      pain,
      mobility,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLogs((prev) => {
      const withoutSameDate = prev.filter((l) => l.date.getTime() !== result.item.date.getTime());
      return [...withoutSameDate, { ...result.item }].sort((a, b) => a.date.getTime() - b.date.getTime());
    });
  }

  async function handleDelete(log: Log) {
    setError(null);
    setLogs((prev) => prev.filter((l) => l.id !== log.id));
    const result = await deletePainMobilityLog(log.id, areaId);
    if (!result.ok) {
      setLogs((prev) => [...prev, log].sort((a, b) => a.date.getTime() - b.date.getTime()));
      setError(result.error);
    }
  }

  return (
    <div>
      <div className={styles.statRow}>
        <WeeklyStat
          label="Pain (weekly avg)"
          logs={logs}
          field="pain"
          thisWeekStart={thisWeekStart}
          priorWeekStart={priorWeekStart}
        />
        <WeeklyStat
          label="Mobility (weekly avg)"
          logs={logs}
          field="mobility"
          thisWeekStart={thisWeekStart}
          priorWeekStart={priorWeekStart}
        />
      </div>

      <div className={styles.form}>
        <label className={styles.field}>
          <span className={styles.label}>Date</span>
          <input
            type="date"
            className={styles.input}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Pain (0–10)</span>
          <input
            type="number"
            min={0}
            max={10}
            className={styles.input}
            value={pain}
            onChange={(e) => setPain(Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>Mobility (0–10)</span>
          <input
            type="number"
            min={0}
            max={10}
            className={styles.input}
            value={mobility}
            onChange={(e) => setMobility(Number(e.target.value))}
          />
        </label>
        <button type="button" className={styles.save} onClick={handleLog} disabled={saving}>
          {saving ? "Saving…" : "Log"}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.history}>
        {logs.length === 0 && <p className={styles.empty}>No logs yet.</p>}
        {[...logs]
          .reverse()
          .slice(0, 10)
          .map((log) => (
            <div key={log.id} className={styles.historyRow}>
              <span>{toDateInputValue(log.date)}</span>
              <span>
                Pain {log.pain} · Mobility {log.mobility}
                <button type="button" className={styles.deleteLink} onClick={() => handleDelete(log)}>
                  Delete
                </button>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
