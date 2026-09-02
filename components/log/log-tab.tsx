import Link from "next/link";
import { MetricEntryField } from "./metric-entry-field";
import type { MetricForLog } from "@/lib/metrics/data";
import styles from "./log-tab.module.css";

type Pillar = { id: string; name: string };

const GLOBAL_GROUP_KEY = "__global__";

/**
 * Every non-archived Metric due today/this week, grouped by pillar (a
 * "General" group first for global, unscoped metrics), plus an
 * always-visible "Ad hoc" section (#184) — the one place logging
 * anything in the app happens, replacing /log-today's single fixed
 * sheet. A plain server component: every interactive bit lives in
 * MetricEntryField, so this only needs to group and lay out.
 */
export function LogTab({ metrics, pillars }: { metrics: MetricForLog[]; pillars: Pillar[] }) {
  if (metrics.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>No metrics yet — add one to start logging.</p>
        <Link href="/log/metrics" className={styles.manageLink}>
          Add your first metric →
        </Link>
      </div>
    );
  }

  const adHoc = metrics.filter((m) => m.cadence === "AD_HOC");
  const scheduled = metrics.filter((m) => m.cadence !== "AD_HOC");

  const pillarNameById = new Map(pillars.map((p) => [p.id, p.name]));
  const groups = new Map<string, MetricForLog[]>();
  for (const m of scheduled) {
    const key = m.pillarId ?? GLOBAL_GROUP_KEY;
    const list = groups.get(key) ?? [];
    list.push(m);
    groups.set(key, list);
  }
  const groupKeys = [...groups.keys()].sort((a, b) => {
    if (a === GLOBAL_GROUP_KEY) return -1;
    if (b === GLOBAL_GROUP_KEY) return 1;
    return (pillarNameById.get(a) ?? "").localeCompare(pillarNameById.get(b) ?? "");
  });

  return (
    <div>
      {groupKeys.map((key) => (
        <section key={key} className={styles.group}>
          <h2 className={styles.groupTitle}>{key === GLOBAL_GROUP_KEY ? "General" : (pillarNameById.get(key) ?? "Other")}</h2>
          <ul className={styles.list}>
            {groups.get(key)!.map((m) => (
              <li key={m.id} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.name}>
                    {m.name}
                    {m.required && (
                      <span className={styles.requiredDot} title="Required" aria-label="Required" />
                    )}
                  </span>
                  <span className={styles.cadence}>{m.cadence === "DAILY" ? "Today" : "This week"}</span>
                </div>
                <MetricEntryField
                  metricId={m.id}
                  date={m.periodStart!}
                  valueType={m.valueType}
                  enumOptions={m.enumOptions}
                  unit={m.unit}
                  initialNumberValue={m.currentEntry?.numberValue ?? null}
                  initialTextValue={m.currentEntry?.textValue ?? null}
                  isAdHoc={false}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {adHoc.length > 0 && (
        <section className={styles.group}>
          <h2 className={styles.groupTitle}>Ad hoc</h2>
          <ul className={styles.list}>
            {adHoc.map((m) => (
              <li key={m.id} className={styles.row}>
                <div className={styles.rowHead}>
                  <span className={styles.name}>{m.name}</span>
                </div>
                <MetricEntryField
                  metricId={m.id}
                  date={new Date()}
                  valueType={m.valueType}
                  enumOptions={m.enumOptions}
                  unit={m.unit}
                  initialNumberValue={null}
                  initialTextValue={null}
                  isAdHoc
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <Link href="/log/metrics" className={styles.manageLink}>
        Manage metrics →
      </Link>
    </div>
  );
}
