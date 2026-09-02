export type MetricValueType = "NUMBER" | "SCALE_5" | "BOOLEAN" | "ENUM" | "TEXT";

export type MetricValidationInput = {
  name: string;
  valueType: MetricValueType;
  enumOptions?: string[] | null;
};

/** A Metric's own validation, kept separate from the server action so it's
 * testable without touching Prisma — same "pure logic, separate file"
 * split every other domain's actions.ts/logic.ts pair in this app uses
 * (e.g. lib/finance/logic.ts). */
export function validateMetricInput(input: MetricValidationInput): string | null {
  if (!input.name.trim()) return "Enter a name.";
  if (input.valueType === "ENUM" && (!input.enumOptions || input.enumOptions.length < 2)) {
    return "Enum metrics need at least 2 options.";
  }
  return null;
}
