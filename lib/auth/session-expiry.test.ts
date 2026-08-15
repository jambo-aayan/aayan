import { describe, expect, it } from "vitest";
import { isSessionExpired, sessionExpiryDate, SESSION_TTL_DAYS } from "./session-expiry";

describe("sessionExpiryDate", () => {
  it("adds SESSION_TTL_DAYS days to the given date", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiry = sessionExpiryDate(now);
    const expectedMs = now.getTime() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
    expect(expiry.getTime()).toBe(expectedMs);
  });
});

describe("isSessionExpired", () => {
  it("is false when now is before expiresAt", () => {
    const expiresAt = new Date("2026-01-10T00:00:00.000Z");
    const now = new Date("2026-01-05T00:00:00.000Z");
    expect(isSessionExpired(expiresAt, now)).toBe(false);
  });

  it("is true when now is after expiresAt", () => {
    const expiresAt = new Date("2026-01-10T00:00:00.000Z");
    const now = new Date("2026-01-11T00:00:00.000Z");
    expect(isSessionExpired(expiresAt, now)).toBe(true);
  });

  it("is true when now exactly equals expiresAt (boundary is not valid)", () => {
    const expiresAt = new Date("2026-01-10T00:00:00.000Z");
    expect(isSessionExpired(expiresAt, expiresAt)).toBe(true);
  });
});
