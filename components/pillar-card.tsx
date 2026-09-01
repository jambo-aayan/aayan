"use client";

import { useState } from "react";
import Link from "next/link";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { updatePillarColor, updatePillarTimeShare } from "@/lib/pillars/actions";
import { resolveColorHex, type ColorKey } from "@/lib/colors";
import { pillarHref } from "@/lib/pillars/nav";
import type { PillarWithStats } from "@/lib/pillars/data";
import styles from "./pillar-card.module.css";

export function PillarCard({ pillar }: { pillar: PillarWithStats }) {
  const [color, setColor] = useState(pillar.color);
  const [timeShare, setTimeShare] = useState(pillar.intendedTimeShare?.toString() ?? "");
  const { notifyError } = useToast();
  const hex = resolveColorHex(color as ColorKey | null);

  async function handleColorChange(next: string | null) {
    const previous = color;
    setColor(next);
    const result = await withRetry(() => updatePillarColor(pillar.id, next as ColorKey | null));
    if (!result.ok) {
      setColor(previous);
      notifyError(result.error, { onRetry: () => handleColorChange(next) });
    }
  }

  async function handleTimeShareBlur() {
    const percent = timeShare.trim() === "" ? null : Number(timeShare);
    if (percent !== null && Number.isNaN(percent)) return;
    const result = await withRetry(() => updatePillarTimeShare(pillar.id, percent));
    if (!result.ok) {
      notifyError(result.error, { onRetry: handleTimeShareBlur });
    }
  }

  return (
    <div className={styles.card} style={hex ? { borderTopColor: hex } : undefined}>
      <Link href={pillarHref(pillar.id)} className={styles.link}>
        <span className={styles.badge} style={hex ? { background: `${hex}24`, color: hex } : undefined}>
          {pillar.name.charAt(0).toUpperCase()}
        </span>
        <span className={styles.stats}>
          {pillar.areaCount} area{pillar.areaCount === 1 ? "" : "s"} · {pillar.habitCount} habit
          {pillar.habitCount === 1 ? "" : "s"}
        </span>
        <span className={styles.name} style={hex ? { color: hex } : undefined}>
          {pillar.name}
        </span>
        {pillar.desc && <span className={styles.desc}>{pillar.desc}</span>}
      </Link>

      <div className={styles.divider} />

      <div className={styles.row}>
        <span className={styles.label}>Accent</span>
        <ColorSwatchPicker value={color} onChange={handleColorChange} />
      </div>

      <div className={styles.row}>
        <label className={styles.label} htmlFor={`time-share-${pillar.id}`}>
          Intended time-share
        </label>
        <div className={styles.timeShareField}>
          <input
            id={`time-share-${pillar.id}`}
            type="number"
            min={0}
            max={100}
            className={styles.timeShareInput}
            placeholder="—"
            value={timeShare}
            onChange={(e) => setTimeShare(e.target.value)}
            onBlur={handleTimeShareBlur}
          />
          <span className={styles.timeSharePercent}>%</span>
        </div>
      </div>
    </div>
  );
}
