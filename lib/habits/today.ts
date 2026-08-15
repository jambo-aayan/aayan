import "server-only";
import { utcMidnight } from "./date-utils";

/** Today at UTC midnight, matching how check-in dates are stored (DATE-only). */
export function todayUtcMidnight(): Date {
  return utcMidnight(new Date());
}
