import { describe, expect, it, vi } from "vitest";
import { withRetry } from "./with-retry";

describe("withRetry", () => {
  it("returns the result immediately on first success", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true });
    const result = await withRetry(fn, { delay: async () => {} });
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on failure and returns the eventual success", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "Couldn't save — try again." })
      .mockResolvedValueOnce({ ok: true });
    const result = await withRetry(fn, { delay: async () => {} });
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("gives up after the configured number of retries and returns the last failure", async () => {
    const fn = vi.fn().mockResolvedValue({ ok: false, error: "Couldn't save — try again." });
    const result = await withRetry(fn, { retries: 2, delay: async () => {} });
    expect(result).toEqual({ ok: false, error: "Couldn't save — try again." });
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("treats a thrown/rejected call the same as a failed result and retries", async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error("network drop")).mockResolvedValueOnce({ ok: true });
    const result = await withRetry(fn, { delay: async () => {} });
    expect(result).toEqual({ ok: true });
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("waits with exponential backoff between attempts", async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: "x" })
      .mockResolvedValueOnce({ ok: false, error: "x" })
      .mockResolvedValueOnce({ ok: true });
    const delays: number[] = [];
    await withRetry(fn, {
      retries: 2,
      baseDelayMs: 100,
      delay: async (ms) => {
        delays.push(ms);
      },
    });
    expect(delays).toEqual([100, 200]);
  });
});
