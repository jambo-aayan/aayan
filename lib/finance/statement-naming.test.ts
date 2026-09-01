import { describe, expect, it } from "vitest";
import { generateStatementName } from "./statement-naming";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("generateStatementName", () => {
  it("uses institution — account — month year when extraction is confident", () => {
    const name = generateStatementName({
      institutionName: "Barclays",
      periodEnd: d("2026-08-31"),
      accountName: "Current Account",
      uploadedAt: d("2026-09-01"),
    });
    expect(name).toBe("Barclays — Current Account — August 2026");
  });

  it("falls back to account — Statement date when institution is missing", () => {
    const name = generateStatementName({
      institutionName: null,
      periodEnd: d("2026-08-31"),
      accountName: "Current Account",
      uploadedAt: d("2026-09-01"),
    });
    expect(name).toBe("Current Account — Statement 1 Sept 2026");
  });

  it("falls back to account — Statement date when period end is missing", () => {
    const name = generateStatementName({
      institutionName: "Barclays",
      periodEnd: null,
      accountName: "Current Account",
      uploadedAt: d("2026-09-01"),
    });
    expect(name).toBe("Current Account — Statement 1 Sept 2026");
  });

  it("falls back when both institution and period are missing", () => {
    const name = generateStatementName({
      institutionName: null,
      periodEnd: null,
      accountName: "Savings",
      uploadedAt: d("2026-01-15"),
    });
    expect(name).toBe("Savings — Statement 15 Jan 2026");
  });

  it("falls back on a blank institution name", () => {
    const name = generateStatementName({
      institutionName: "   ",
      periodEnd: d("2026-08-31"),
      accountName: "Current Account",
      uploadedAt: d("2026-09-01"),
    });
    expect(name).toBe("Current Account — Statement 1 Sept 2026");
  });
});
