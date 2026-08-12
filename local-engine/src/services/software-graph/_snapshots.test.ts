/**
 * Tests for snapshot capture and merge.
 */

import { describe, expect, it } from "vitest";
import { attachSnapshotsToGraph, createGraphSnapshot, mergeGraphSnapshots } from "./_snapshots.js";
import type { SoftwareGraph } from "../../../../shared/software-graph.types.js";

function makeGraph(nodeIds: string[]): SoftwareGraph {
  return {
    version: 1,
    projectId: "p1",
    analyzedAt: "2026-01-01T00:00:00.000Z",
    scopes: [],
    nodes: nodeIds.map((id) => ({ id, kind: "file", label: id, metadata: {} })),
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

describe("createGraphSnapshot", () => {
  it("stores node ids and signatures", () => {
    const snapshot = createGraphSnapshot(makeGraph(["a", "b"]), {
      ref: "abc123",
      capturedAt: "2026-01-02T00:00:00.000Z",
      commitSha: "abc123",
      branch: "main",
      sourceKind: "git",
      dirty: false,
    });
    expect(snapshot.nodeIds).toEqual(["a", "b"]);
    expect(snapshot.nodeSignatures?.a).toBe("file:a");
  });

  it("snapshot id includes the timestamp", () => {
    const snapshot = createGraphSnapshot(makeGraph(["a"]), {
      ref: "abc123",
      capturedAt: "2026-01-02T00:00:00.123Z",
      commitSha: "abc123",
      branch: "main",
      sourceKind: "git",
      dirty: false,
    });

    expect(snapshot.id).toBe("snapshot:abc123:2026-01-02T00:00:00.123Z");
  });

  it("snapshot without commitSha still gets a unique id", () => {
    const first = createGraphSnapshot(makeGraph(["a"]), {
      ref: "2026-01-02T00:00:00.123Z",
      capturedAt: "2026-01-02T00:00:00.123Z",
      sourceKind: "filesystem",
      dirty: false,
    });
    const second = createGraphSnapshot(makeGraph(["a"]), {
      ref: "2026-01-02T00:00:00.124Z",
      capturedAt: "2026-01-02T00:00:00.124Z",
      sourceKind: "filesystem",
      dirty: false,
    });

    expect(first.id).toBe("snapshot:local:2026-01-02T00:00:00.123Z");
    expect(second.id).not.toBe(first.id);
  });
});

describe("mergeGraphSnapshots", () => {
  it("appends unique snapshots and keeps order", () => {
    const first = createGraphSnapshot(makeGraph(["a"]), {
      ref: "v1",
      capturedAt: "2026-01-01T00:00:00.000Z",
      sourceKind: "filesystem",
      dirty: false,
    });
    const second = createGraphSnapshot(makeGraph(["a", "b"]), {
      ref: "v2",
      capturedAt: "2026-01-02T00:00:00.000Z",
      sourceKind: "filesystem",
      dirty: false,
    });
    const merged = mergeGraphSnapshots([first], second);
    expect(merged).toHaveLength(2);
    expect(merged[1].nodeIds).toContain("b");
  });

  it("two captures of the same commit produce two snapshots", () => {
    const first = createGraphSnapshot(makeGraph(["a"]), {
      ref: "abc123",
      capturedAt: "2026-01-01T00:00:00.000Z",
      commitSha: "abc123",
      branch: "main",
      sourceKind: "git",
      dirty: false,
    });
    const second = createGraphSnapshot(makeGraph(["a", "b"]), {
      ref: "abc123",
      capturedAt: "2026-01-01T00:00:00.001Z",
      commitSha: "abc123",
      branch: "main",
      sourceKind: "git",
      dirty: true,
    });

    expect(mergeGraphSnapshots([first], second)).toHaveLength(2);
  });

  it("captures in the same millisecond do not collide silently", () => {
    const options = {
      ref: "abc123",
      capturedAt: "2026-01-01T00:00:00.000Z",
      commitSha: "abc123",
      branch: "main",
      sourceKind: "git" as const,
      dirty: false,
    };
    const first = createGraphSnapshot(makeGraph(["a"]), options);
    const second = createGraphSnapshot(makeGraph(["a", "b"]), options);
    const merged = mergeGraphSnapshots([first], second);

    expect(second.id).toBe(first.id);
    expect(merged).toHaveLength(1);
    expect(merged[0].nodeIds).toContain("b");
  });
});

describe("attachSnapshotsToGraph", () => {
  it("writes snapshots onto graph", () => {
    const graph = attachSnapshotsToGraph(makeGraph(["n1"]), {
      ref: "current",
      capturedAt: "2026-01-01T00:00:00.000Z",
      sourceKind: "filesystem",
      dirty: false,
    });
    expect(graph.snapshots).toHaveLength(1);
    expect(graph.snapshots?.[0].nodeIds).toEqual(["n1"]);
  });
});
