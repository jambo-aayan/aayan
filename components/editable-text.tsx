"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./editable-text.module.css";
import { useToast } from "@/components/toast/toast-provider";

// Was imported from lib/health/actions, which #157/ADR-0016 retired along
// with Health's hardcoded pages — inlined here since every save-action
// module in this codebase (lib/pillars/actions.ts's ActionResult,
// lib/areas/actions.ts's SaveResult, ...) already independently declares
// this exact shape; this generic component shouldn't couple to any one of
// them.
type SaveResult = { ok: true } | { ok: false; error: string };

const SAVE_DEBOUNCE_MS = 800;

/** Always-editable, autosaves on type (debounced) — per the handoff's Health
 * North Star / Area detail spec ("editable textarea... saves as you type"),
 * not a click-to-reveal-then-explicit-Save toggle. */
export function EditableText({
  label,
  initialValue,
  placeholder,
  /** Shown below the field — the handoff notes this copy appears exactly
   * once, on Health's North Star, to teach the autosave pattern. Omit
   * everywhere else. */
  hint,
  fraunces,
  onSave,
}: {
  label: string;
  initialValue: string | null;
  placeholder: string;
  hint?: string;
  /** Renders the textarea in Fraunces at this px size — the North Star
   * fields (19px on Health, 16px on Area detail) per the handoff. Omit for
   * the default 13.5px Instrument Sans body treatment (Area's Current
   * state). */
  fraunces?: number;
  onSave: (value: string) => Promise<SaveResult>;
}) {
  const [value, setValue] = useState(initialValue ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const { notifyError } = useToast();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  async function save(next: string) {
    setStatus("saving");
    const result = await onSave(next);
    setStatus(result.ok ? "idle" : "error");
    if (!result.ok) {
      notifyError(result.error, { onRetry: () => save(next) });
    }
  }

  function handleChange(next: string) {
    setValue(next);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => save(next), SAVE_DEBOUNCE_MS);
  }

  return (
    <div className={styles.field}>
      <div className={styles.label}>{label}</div>
      <textarea
        className={`${styles.textarea} ${fraunces ? styles.textareaTitle : ""}`}
        style={fraunces ? { fontSize: fraunces } : undefined}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
      />
      {hint && <p className={styles.hint}>{hint}</p>}
      {status === "saving" && (
        <p className={styles.status} role="status" aria-live="polite">
          Saving…
        </p>
      )}
      {status === "error" && <p className={styles.error}>Couldn&rsquo;t save — retrying…</p>}
    </div>
  );
}
