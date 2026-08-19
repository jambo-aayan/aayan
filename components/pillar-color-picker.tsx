"use client";

import { useState } from "react";
import { ColorSwatchPicker } from "@/components/color-swatch-picker";
import { useToast } from "@/components/toast/toast-provider";
import { withRetry } from "@/lib/with-retry";
import { updatePillarColor } from "@/lib/pillars/actions";
import type { ColorKey } from "@/lib/colors";
import styles from "./pillar-color-picker.module.css";

/** Lets the user pick this Pillar's accent color from the fixed palette.
 * The color then propagates app-wide (Areas/Goals/Habits/Tasks under this
 * Pillar) via lib/colors.ts — see updatePillarColor's revalidation. */
export function PillarColorPicker({ pillarId, initialColor }: { pillarId: string; initialColor: string | null }) {
  const [color, setColor] = useState(initialColor);
  const { notifyError } = useToast();

  async function handleChange(next: string | null) {
    const previous = color;
    setColor(next);
    const result = await withRetry(() => updatePillarColor(pillarId, next as ColorKey | null));
    if (!result.ok) {
      setColor(previous);
      notifyError(result.error, { onRetry: () => handleChange(next) });
    }
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>Color</span>
      <ColorSwatchPicker value={color} onChange={handleChange} />
    </div>
  );
}
