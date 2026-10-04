/**
 * Unit tests for Product Readiness browser console gate (#391).
 */

import { describe, expect, it } from "vitest";
import { assertBrowserConsole } from "../readiness/assert-browser-console.mjs";

describe("assertBrowserConsole", () => {
  it("passes on clean logs", () => {
    const result = assertBrowserConsole([
      "[log] VisuDEV ready",
      "[info] Download the React DevTools for a better development experience",
    ]);
    expect(result.passed).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it("fails on console.error and pageerror", () => {
    const result = assertBrowserConsole([
      "[error] Something broke",
      "[pageerror] TypeError: x is not a function",
    ]);
    expect(result.passed).toBe(false);
    expect(result.failures.some((f) => f.startsWith("console-error"))).toBe(true);
    expect(result.failures.some((f) => f.startsWith("pageerror"))).toBe(true);
  });

  it("fails on React duplicate-key warning", () => {
    const result = assertBrowserConsole([
      "[warning] Warning: Encountered two children with the same key, `core`.",
    ]);
    expect(result.passed).toBe(false);
    expect(result.summary.matchedIds).toContain("duplicate-react-key");
  });
});
