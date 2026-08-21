import { describe, expect, it } from "vitest";
import { isLockedOut, lockedUntilFor, lockoutSecondsFor } from "./rate-limit";

describe("lockoutSecondsFor", () => {
  it("is 0 for the first 5 failed attempts", () => {
    for (let i = 0; i <= 5; i++) {
      expect(lockoutSecondsFor(i)).toBe(0);
    }
  });

  it("locks for 30s on the 6th failure", () => {
    expect(lockoutSecondsFor(6)).toBe(30);
  });

  it("doubles per additional failure", () => {
    expect(lockoutSecondsFor(7)).toBe(60);
    expect(lockoutSecondsFor(8)).toBe(120);
    expect(lockoutSecondsFor(9)).toBe(240);
  });

  it("caps at 1 hour", () => {
    expect(lockoutSecondsFor(20)).toBe(3600);
    expect(lockoutSecondsFor(100)).toBe(3600);
  });
});

describe("lockedUntilFor", () => {
  it("is null when there's no lockout", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(lockedUntilFor(3, now)).toBeNull();
  });

  it("adds the lockout duration to now", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const result = lockedUntilFor(6, now);
    expect(result?.getTime()).toBe(now.getTime() + 30 * 1000);
  });
});

describe("isLockedOut", () => {
  it("is false when lockedUntil is null", () => {
    expect(isLockedOut(null, new Date())).toBe(false);
  });

  it("is true when now is before lockedUntil", () => {
    const lockedUntil = new Date("2026-01-01T00:01:00.000Z");
    const now = new Date("2026-01-01T00:00:30.000Z");
    expect(isLockedOut(lockedUntil, now)).toBe(true);
  });

  it("is false when now is at or after lockedUntil", () => {
    const lockedUntil = new Date("2026-01-01T00:01:00.000Z");
    expect(isLockedOut(lockedUntil, lockedUntil)).toBe(false);
    expect(isLockedOut(lockedUntil, new Date("2026-01-01T00:02:00.000Z"))).toBe(false);
  });
});
