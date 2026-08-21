"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToggleSwitch } from "@/components/toggle-switch";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { updateAppSettings } from "@/lib/settings/actions";
import type { AppSettings } from "@/lib/settings/data";
import styles from "./settings-toggles.module.css";

const ROWS: { key: keyof AppSettings; label: string; note: string }[] = [
  { key: "emptyAppMode", label: "Empty-app mode", note: "Forces every count/badge/list to read zero, for demos." },
  { key: "reduceMotion", label: "Reduce motion", note: "Turns off sheet/toast animations and hover lifts app-wide." },
  { key: "weeklyReviewPrompt", label: "Weekly review prompt", note: "Nudge me on Sundays to do my weekly review." },
];

export function SettingsToggles({ initialSettings }: { initialSettings: AppSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const router = useRouter();
  const { notifyError } = useToast();

  async function handleToggle(key: keyof AppSettings, next: boolean) {
    const previous = settings;
    setSettings((prev) => ({ ...prev, [key]: next }));
    const result = await withRetry(() => updateAppSettings({ [key]: next }));
    if (!result.ok) {
      setSettings(previous);
      notifyError(result.error, { onRetry: () => handleToggle(key, next) });
      return;
    }
    if (key === "reduceMotion") router.refresh();
  }

  return (
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
  );
}
