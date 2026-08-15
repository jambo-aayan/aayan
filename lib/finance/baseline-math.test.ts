import { describe, expect, it } from "vitest";
import { surplus } from "./baseline-math";

describe("surplus", () => {
  it("is income minus outgoings", () => {
    expect(surplus(3000, 2150)).toBe(850);
  });

  it("can be negative when outgoings exceed income", () => {
    expect(surplus(2000, 2500)).toBe(-500);
  });

  it("is zero when income equals outgoings", () => {
    expect(surplus(1800, 1800)).toBe(0);
  });
});
