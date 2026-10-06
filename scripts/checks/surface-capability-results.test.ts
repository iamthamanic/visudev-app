/**
 * PU-16 surface capability classification tests.
 * Location: scripts/checks/surface-capability-results.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  classifySemanticFailure,
  evaluateAppflowStaticSurface,
  evaluateDataSurface,
  surfaceResultsFromSemanticAssertions,
  verdictToCapabilityPassed,
} from "../readiness/surface-capability-results.mjs";

describe("surface-capability-results", () => {
  it("classifies semantic failures onto independent surfaces", () => {
    expect(classifySemanticFailure("Dependencies has no semantic overview")).toBe("dependencies");
    expect(classifySemanticFailure("Evolution snapshots lack nodeSignatures")).toBe(
      "knowledgeStatus",
    );
    expect(classifySemanticFailure("Graph has only route/file nodes")).toBe("atlas");
  });

  it("does not fan one failure into every blueprint surface", () => {
    const surfaces = surfaceResultsFromSemanticAssertions({
      passed: false,
      failures: ["Dependencies has no semantic overview while primary graph exceeds density cap."],
    });
    expect(surfaces.dependencies.verdict).toBe("FAIL");
    expect(surfaces.atlas.verdict).toBe("PASS");
    expect(surfaces.architecture.verdict).toBe("PASS");
    expect(surfaces.knowledgeStatus.verdict).toBe("PASS");
  });

  it("evaluates AppFlow static / Data honestly without inventing UI/data", () => {
    const emptyGraph = { blueprint: { graph: { nodes: [{ id: "n1", kind: "module" }] } } };
    expect(evaluateAppflowStaticSurface(emptyGraph).verdict).toBe("PASS");
    expect(evaluateDataSurface(emptyGraph).verdict).toBe("PASS");
    expect(verdictToCapabilityPassed("PARTIAL")).toBe("partial");
    expect(verdictToCapabilityPassed("UNAVAILABLE")).toBeNull();
  });
});
