/**
 * Tests for blueprint graph stats helper.
 */

import { describe, expect, it } from "vitest";
import { computeBlueprintGraphStats, formatRelativeFreshness } from "./blueprint-graph-stats";
import type { SoftwareGraph } from "../types";

const sampleGraph: SoftwareGraph = {
  version: 1,
  projectId: "demo",
  analyzedAt: "2026-07-14T12:00:00.000Z",
  scopes: [],
  evidence: [],
  metrics: [],
  condensed: false,
  limits: { maxNodes: 1000, maxEdges: 2000 },
  nodes: [
    { id: "m1", kind: "module", label: "Auth", metadata: {} },
    { id: "d1", kind: "domain", label: "Users", metadata: {} },
    { id: "f1", kind: "file", label: "auth.ts", metadata: {} },
    { id: "f2", kind: "file", label: "users.ts", metadata: {} },
  ],
  edges: [
    { id: "e1", kind: "imports", sourceId: "f1", targetId: "f2", metadata: {} },
    { id: "e2", kind: "contains", sourceId: "m1", targetId: "f1", metadata: {} },
  ],
  groups: [],
};

describe("computeBlueprintGraphStats", () => {
  it("counts exact modules, analyzed files, and dependency edges", () => {
    expect(computeBlueprintGraphStats(sampleGraph)).toEqual({
      moduleCount: 1,
      fileCount: 2,
      dependencyCount: 1,
    });
  });

  it("ignores legacy module-scale metrics while preserving file scan metrics", () => {
    expect(
      computeBlueprintGraphStats({
        ...sampleGraph,
        metrics: [
          { id: "m-modules", name: "modules", value: 1248 },
          { id: "m-files", name: "files", value: 5732 },
        ],
      }),
    ).toEqual({
      moduleCount: 1,
      fileCount: 5732,
      dependencyCount: 1,
    });
  });

  it("returns zeros for missing graph", () => {
    expect(computeBlueprintGraphStats(null)).toEqual({
      moduleCount: 0,
      fileCount: 0,
      dependencyCount: 0,
    });
  });

  it("returns zeros for malformed graph collections", () => {
    expect(
      computeBlueprintGraphStats({
        ...sampleGraph,
        nodes: undefined as unknown as SoftwareGraph["nodes"],
        edges: null as unknown as SoftwareGraph["edges"],
      }),
    ).toEqual({
      moduleCount: 0,
      fileCount: 0,
      dependencyCount: 0,
    });
  });
});

describe("formatRelativeFreshness", () => {
  it("formats recent timestamps in German", () => {
    const twoMinutesAgo = new Date(Date.now() - 2 * 60_000).toISOString();
    expect(formatRelativeFreshness(twoMinutesAgo)).toBe("vor 2 Min");
  });

  it("returns dash for invalid input", () => {
    expect(formatRelativeFreshness(undefined)).toBe("—");
  });
});
