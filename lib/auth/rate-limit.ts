/** Per ADR-0004: 5 free failed attempts, then exponential backoff starting
 * at 30s and doubling per additional failure, capped at 1 hour so a typo
 * spree doesn't lock the single legitimate user out for an absurd length. */
const FREE_ATTEMPTS = 5;
const BASE_LOCKOUT_SECONDS = 30;
const MAX_LOCKOUT_SECONDS = 60 * 60;

export function lockoutSecondsFor(failedCount: number): number {
  if (failedCount <= FREE_ATTEMPTS) return 0;
  const seconds = BASE_LOCKOUT_SECONDS * 2 ** (failedCount - FREE_ATTEMPTS - 1);
  return Math.min(seconds, MAX_LOCKOUT_SECONDS);
}

export function lockedUntilFor(failedCount: number, now: Date): Date | null {
  const seconds = lockoutSecondsFor(failedCount);
  if (seconds === 0) return null;
  return new Date(now.getTime() + seconds * 1000);
}

export function isLockedOut(lockedUntil: Date | null, now: Date): boolean {
  if (!lockedUntil) return false;
  return now.getTime() < lockedUntil.getTime();
}
