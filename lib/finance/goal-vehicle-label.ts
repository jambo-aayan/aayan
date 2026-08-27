import type { GoalInput } from "./actions";

/** Display labels for GoalVehicle — shared by GoalsManager and the
 * Financial plan section (#121, ADR-0010) so the two never drift apart. */
export const VEHICLE_LABEL: Record<GoalInput["vehicle"], string> = {
  EMERGENCY_FUND: "Emergency Fund",
  LISA: "LISA",
  PENSION: "Pension",
  STOCKS_ISA: "Stocks & Shares ISA",
  CASH_ISA: "Cash ISA",
  GENERIC: "Generic",
};
