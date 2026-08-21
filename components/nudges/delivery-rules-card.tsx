"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToggleSwitch } from "@/components/toggle-switch";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { updateAppSettings } from "@/lib/settings/actions";
import type { AppSettings } from "@/lib/settings/data";
import styles from "./delivery-rules-card.module.css";

const ROWS: { key: "morningBrief" | "eveningCheckIn" | "streakWarnings" | "weeklyReviewPrompt"; label: string; note: string }[] = [
  { key: "morningBrief", label: "Morning brief", note: "07:30 · today's habits and top three tasks" },
  { key: "eveningCheckIn", label: "Evening check-in", note: "20:30 · anything unlogged" },
  { key: "streakWarnings", label: "Streak warnings", note: "Only when a streak over 7 days is at risk" },
  { key: "weeklyReviewPrompt", label: "Weekly review prompt", note: "Sunday 18:00" },
];

type DeliveryRuleSettings = Pick<AppSettings, "morningBrief" | "eveningCheckIn" | "streakWarnings" | "weeklyReviewPrompt">;

export function DeliveryRulesCard({ initialSettings }: { initialSettings: DeliveryRuleSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const router = useRouter();
  const { notifyError } = useToast();

  async function handleToggle(key: keyof DeliveryRuleSettings, next: boolean) {
    const previous = settings;
    setSettings((prev) => ({ ...prev, [key]: next }));
    const result = await withRetry(() => updateAppSettings({ [key]: next }));
    if (!result.ok) {
      setSettings(previous);
      notifyError(result.error, { onRetry: () => handleToggle(key, next) });
      return;
    }
    router.refresh();
  }

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Delivery rules</div>
      <div className={styles.list}>
        {ROWS.map((row) => (
          <div key={row.key} className={styles.row}>
            <div className={styles.text}>
              <span className={styles.label}>{row.label}</span>
              <span className={styles.note}>{row.note}</span>
            </div>
            <ToggleSwitch checked={settings[row.key]} onChange={(next) => handleToggle(row.key, next)} label={row.label} />
          </div>
        ))}
      </div>

      <div className={styles.quietHours}>
        <span className={styles.quietHoursLabel}>Quiet hours</span>
        <span className={styles.quietHoursValue}>22:00 — 07:30</span>
      </div>
    </div>
  );
}
