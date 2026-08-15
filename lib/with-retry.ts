type Result = { ok: true } | { ok: false; error: string };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retries a server-action call on failure with exponential backoff, so a
 * transient blip (a dropped connection, a momentary DB hiccup) doesn't
 * surface as a user-facing error on the first attempt.
 */
const NETWORK_ERROR: Result = { ok: false, error: "Couldn't reach the server — try again." };

async function attempt<T extends Result>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    // A rejected server-action call (e.g. a dropped connection) never
    // resolves to our {ok:false} shape at all — treat it the same as one.
    return NETWORK_ERROR as T;
  }
}

export async function withRetry<T extends Result>(
  fn: () => Promise<T>,
  { retries = 2, baseDelayMs = 400, delay = sleep }: { retries?: number; baseDelayMs?: number; delay?: (ms: number) => Promise<void> } = {}
): Promise<T> {
  let result = await attempt(fn);
  for (let i = 0; !result.ok && i < retries; i++) {
    await delay(baseDelayMs * 2 ** i);
    result = await attempt(fn);
  }
  return result;
}
