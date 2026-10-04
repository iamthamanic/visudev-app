/**
 * ObservationClass resolution for Execution trust layers (PR-09).
 */

import { describe, expect, it } from "vitest";
import type { SoftwareGraph } from "../../types";
import { resolveExecutionObservationClass } from "./execution-observation.js";

function makeGraph(overrides: Partial<SoftwareGraph> = {}): SoftwareGraph {
  return {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: [],
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
    ...overrides,
  };
}

describe("resolveExecutionObservationClass", () => {
  it("defaults to STATIC_MODEL", () => {
    const node = { id: "n1", kind: "file" as const, label: "a.ts", metadata: {} };
    expect(resolveExecutionObservationClass(node)).toBe("STATIC_MODEL");
  });

  it("marks runtimeObserved as OBSERVED_TRACE", () => {
    const node = {
      id: "n1",
      kind: "file" as const,
      label: "a.ts",
      metadata: { runtimeObserved: true },
    };
    expect(resolveExecutionObservationClass(node)).toBe("OBSERVED_TRACE");
  });

  it("marks runtimeVerified as RUNTIME_VERIFIED", () => {
    const node = {
      id: "n1",
      kind: "file" as const,
      label: "a.ts",
      metadata: { runtimeVerified: true },
    };
    expect(resolveExecutionObservationClass(node)).toBe("RUNTIME_VERIFIED");
  });

  it("marks conflicts as CONFLICTED over observed", () => {
    const node = {
      id: "n1",
      kind: "file" as const,
      label: "a.ts",
      metadata: { runtimeObserved: true, runtimeConflict: true },
    };
    expect(resolveExecutionObservationClass(node)).toBe("CONFLICTED");
  });

  it("uses runtime evidence kinds for OBSERVED_TRACE", () => {
    const node = { id: "n1", kind: "file" as const, label: "a.ts", metadata: {} };
    const graph = makeGraph({
      nodes: [node],
      evidence: [
        {
          id: "ev1",
          factId: "fact:ev1",
          kind: "runtime-trace",
          filePath: "a.ts",
          line: 1,
          excerpt: "observed",
          nodeId: "n1",
        },
      ],
    });
    expect(resolveExecutionObservationClass(node, graph)).toBe("OBSERVED_TRACE");
  });
});
