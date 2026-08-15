import "server-only";

/** Today at UTC midnight, matching how check-in dates are stored (DATE-only). */
export function todayUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
