"use client";

import { COLOR_PALETTE } from "@/lib/colors";
import styles from "./color-swatch-picker.module.css";

/** Shared fixed-palette swatch picker — used anywhere a Pillar or List
 * color is set (see lib/colors.ts for why it's a fixed palette rather than
 * a free picker). */
export function ColorSwatchPicker({ value, onChange }: { value: string | null; onChange: (key: string | null) => void }) {
  return (
    <div className={styles.swatches}>
      <button
        type="button"
        className={`${styles.swatch} ${styles.swatchNone} ${!value ? styles.swatchActive : ""}`}
        aria-label="No color"
        onClick={() => onChange(null)}
      />
      {COLOR_PALETTE.map((c) => (
        <button
          key={c.key}
          type="button"
          className={`${styles.swatch} ${value === c.key ? styles.swatchActive : ""}`}
          style={{ background: c.hex, "--swatch-ring-color": c.hex } as React.CSSProperties}
          aria-label={c.label}
          onClick={() => onChange(c.key)}
        />
      ))}
    </div>
  );
}
