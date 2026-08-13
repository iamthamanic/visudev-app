/**
 * Honest-Core P0-12: one formatter, one unit (percent).
 */

import { describe, expect, it } from "vitest";
import { formatConfidence } from "./format-confidence";

describe("formatConfidence", () => {
  it("formats a 0..1 ratio as de-DE percent", () => {
    expect(formatConfidence(0.82)).toBe("82,0\u00a0%");
  });

  it("treats values > 1 as already-percent", () => {
    expect(formatConfidence(82)).toBe("82,0\u00a0%");
  });

  it("returns null for missing values", () => {
    expect(formatConfidence(null)).toBeNull();
    expect(formatConfidence(undefined)).toBeNull();
  });

  it("formats a real zero as 0 %", () => {
    expect(formatConfidence(0)).toBe("0,0\u00a0%");
  });
});
