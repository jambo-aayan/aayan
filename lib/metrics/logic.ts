export type MetricValidationInput = {
  name: string;
  valueType: "NUMBER" | "SCALE_5" | "BOOLEAN" | "ENUM" | "TEXT";
  enumOptions?: string[] | null;
};

/** A Metric's own validation, kept separate from the server action so it's
 * testable without touching Prisma — same "pure logic, separate file"
 * split as lib/daily-log/logic.ts's validateDailyLogInput. */
export function validateMetricInput(input: MetricValidationInput): string | null {
  if (!input.name.trim()) return "Enter a name.";
  if (input.valueType === "ENUM" && (!input.enumOptions || input.enumOptions.length < 2)) {
    return "Enum metrics need at least 2 options.";
  }
  return null;
}
