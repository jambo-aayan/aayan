"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import styles from "./toast.module.css";

type ToastTone = "error" | "undo";

type Toast = {
  id: number;
  message: string;
  tone: ToastTone;
  actionLabel: string;
  onAction: () => void;
};

type NotifyErrorOptions = { actionLabel?: string; onRetry?: () => void; durationMs?: number };

type ToastContextValue = {
  notifyError: (message: string, options?: NotifyErrorOptions) => void;
  notifyUndo: (message: string, onUndo: () => void, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_ERROR_DURATION_MS = 8000;
const DEFAULT_UNDO_DURATION_MS = 5000;

/**
 * A single global toast stack for both failed-save errors (with a manual
 * "Retry" action — the last-resort backup path once automatic retries are
 * exhausted) and delete-undo confirmations, so every list gets consistent
 * non-silent failure handling without re-implementing its own toast markup.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (toast: Omit<Toast, "id">, durationMs: number) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { ...toast, id }]);
      const timer = setTimeout(() => dismiss(id), durationMs);
      timers.current.set(id, timer);
    },
    [dismiss]
  );

  const notifyError = useCallback(
    (message: string, options: NotifyErrorOptions = {}) => {
      push(
        {
          message,
          tone: "error",
          actionLabel: options.actionLabel ?? "Retry",
          onAction: () => options.onRetry?.(),
        },
        options.durationMs ?? DEFAULT_ERROR_DURATION_MS
      );
    },
    [push]
  );

  const notifyUndo = useCallback(
    (message: string, onUndo: () => void, durationMs = DEFAULT_UNDO_DURATION_MS) => {
      push({ message, tone: "undo", actionLabel: "Undo", onAction: onUndo }, durationMs);
    },
    [push]
  );

  return (
    <ToastContext.Provider value={{ notifyError, notifyUndo }}>
      {children}
      <div className={styles.stack}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`${styles.toast} ${toast.tone === "error" ? styles.error : ""}`}
            role={toast.tone === "error" ? "alert" : "status"}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => {
                toast.onAction();
                dismiss(toast.id);
              }}
            >
              {toast.actionLabel}
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
