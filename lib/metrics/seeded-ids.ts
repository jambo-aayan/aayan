/** Fixed ids for the Metrics seeded from the old DailyLog model by the
 * 20260902020000_metric_system_replaces_daily_log migration (#182) — a
 * name lookup would silently break if the user renamed one, so anything
 * that needs to key off "the metric that used to be DailyLog.mood"
 * specifically (lib/daily-log's transitional shim, kept until #183-#188
 * land the real generic Log UI; lib/insights/data.ts's correlation pairs)
 * keys off these fixed ids instead — same convention as
 * lib/daily-log/habit-seed.ts's STRETCH_HABIT_ID/TRAINED_HABIT_ID. */
export const METRIC_MOOD_ID = "metric-mood";
export const METRIC_STRESS_ID = "metric-stress";
export const METRIC_ENERGY_ID = "metric-energy";
export const METRIC_SLEEP_QUALITY_ID = "metric-sleep-quality";
export const METRIC_PAIN_ID = "metric-pain";
export const METRIC_HEADACHE_ID = "metric-headache";
export const METRIC_STIFFNESS_ID = "metric-stiffness";
export const METRIC_WEIGHT_ID = "metric-weight";
export const METRIC_WAIST_ID = "metric-waist";
export const METRIC_BP_SYSTOLIC_ID = "metric-bp-systolic";
export const METRIC_BP_DIASTOLIC_ID = "metric-bp-diastolic";
