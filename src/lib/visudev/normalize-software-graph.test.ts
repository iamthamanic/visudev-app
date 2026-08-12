import { describe, it, expect } from "vitest";
import { isIsoTimestamp } from "./normalize-graph-guards";
import { normalizeSoftwareGraph } from "./normalize-software-graph";

describe("normalizeSoftwareGraph", () => {
  it("returns undefined for malformed graph payloads", () => {
    expect(normalizeSoftwareGraph(null)).toBeUndefined();
    expect(normalizeSoftwareGraph({ nodes: "bad", edges: [] })).toBeUndefined();
    expect(normalizeSoftwareGraph({ nodes: [], edges: [] })).toBeUndefined();
  });

  it("keeps only nodes and edges with required fields", () => {
    const graph = normalizeSoftwareGraph({
      version: 1,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: "n1", kind: "service", label: "API", metadata: {} },
        { id: "bad", kind: 1, label: "X", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "calls",
          sourceId: "n1",
          targetId: "n2",
          metadata: {},
        },
        { id: "e2", kind: "calls", sourceId: "n1" },
      ],
    });

    expect(graph?.nodes).toHaveLength(1);
    expect(graph?.edges).toHaveLength(0);
  });

  it("preserves snapshot analysis origin metadata", () => {
    const graph = normalizeSoftwareGraph({
      version: 1,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
      edges: [],
      snapshots: [
        {
          id: "snapshot:abc1234:2026-01-01T00:00:00.000Z",
          label: "Commit abc1234 · Branch main",
          ref: "abc1234",
          capturedAt: "2026-01-01T00:00:00.000Z",
          nodeIds: ["n1"],
          commitSha: "abc1234",
          branch: "main",
          sourceKind: "git",
          dirty: true,
        },
      ],
    });

    expect(graph?.snapshots?.[0]).toMatchObject({
      commitSha: "abc1234",
      branch: "main",
      sourceKind: "git",
      dirty: true,
    });
  });

  it("keeps edges only when both endpoints exist", () => {
    const graph = normalizeSoftwareGraph({
      version: 1,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
      edges: [
        {
          id: "e1",
          kind: "calls",
          sourceId: "n1",
          targetId: "n2",
          metadata: {},
        },
      ],
    });

    expect(graph?.edges).toHaveLength(0);
  });

  it("returns undefined when projectId or analyzedAt is missing", () => {
    expect(
      normalizeSoftwareGraph({
        nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
        edges: [],
      }),
    ).toBeUndefined();
  });

  it("returns undefined for invalid analyzedAt", () => {
    expect(
      normalizeSoftwareGraph({
        projectId: "p1",
        analyzedAt: "not-a-date",
        nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
        edges: [],
      }),
    ).toBeUndefined();
    expect(
      normalizeSoftwareGraph({
        projectId: "p1",
        analyzedAt: "2026-07-13",
        nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
        edges: [],
      }),
    ).toBeUndefined();
  });

  it("rejects overlong node and edge ids instead of truncating them", () => {
    const longSource = "s".repeat(300);
    const longTarget = "t".repeat(300);
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: longSource, kind: "service", label: "Source", metadata: {} },
        { id: longTarget, kind: "table", label: "Target", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "calls",
          sourceId: longSource,
          targetId: longTarget,
          metadata: {},
        },
      ],
    });

    expect(graph).toBeUndefined();
  });

  it("returns undefined for invalid calendar dates in analyzedAt", () => {
    expect(
      normalizeSoftwareGraph({
        projectId: "p1",
        analyzedAt: "2026-02-30T00:00:00.000Z",
        nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
        edges: [],
      }),
    ).toBeUndefined();
  });

  it("keeps edges for duplicate raw node ids that match the canonical winner", () => {
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: "n1", kind: "service", label: "First", metadata: {} },
        { id: "n1", kind: "service", label: "Duplicate", metadata: {} },
        { id: "target", kind: "table", label: "Target", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "calls",
          sourceId: "n1",
          targetId: "target",
          metadata: {},
        },
      ],
    });

    expect(graph?.nodes).toHaveLength(2);
    expect(graph?.edges).toHaveLength(1);
  });

  it("returns undefined for unsupported graph versions", () => {
    expect(
      normalizeSoftwareGraph({
        version: 2,
        projectId: "p1",
        analyzedAt: "2026-01-01T00:00:00.000Z",
        nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
        edges: [],
      }),
    ).toBeUndefined();
  });

  it("keeps only allowlisted metadata keys", () => {
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        {
          id: "n1",
          kind: "file",
          label: "API",
          metadata: { runtime: "node", secret: "token", __proto__: "x" },
        },
      ],
      edges: [],
    });

    expect(graph?.nodes[0]?.metadata).toEqual({ runtime: "node" });
  });

  it("drops edges whose ids collide with node ids", () => {
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [{ id: "n1", kind: "service", label: "API", metadata: {} }],
      edges: [
        {
          id: "n1",
          kind: "calls",
          sourceId: "n1",
          targetId: "n1",
          metadata: {},
        },
      ],
    });

    expect(graph?.edges).toHaveLength(0);
  });

  it("drops nodes with invalid optional fields", () => {
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: "n1", kind: "service", label: "API", metadata: {}, line: 0 },
        { id: "n2", kind: "service", label: "OK", metadata: {} },
      ],
      edges: [],
    });

    expect(graph?.nodes).toHaveLength(1);
    expect(graph?.nodes[0]?.id).toBe("n2");
  });

  it("caps oversized node arrays", () => {
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: Array.from({ length: MAX_NODES + 10 }, (_, index) => ({
        id: `node-${index}`,
        kind: "service",
        label: `Node ${index}`,
        metadata: {},
      })),
      edges: [],
    });

    expect(graph?.nodes).toHaveLength(2_500);
    expect(graph?.nodes[0]?.id).toBe("node-0");
  });

  it("rejects nodes whose ids exceed the max length", () => {
    const longId = "n".repeat(400);
    const single = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [{ id: longId, kind: "service", label: "API", metadata: {} }],
      edges: [],
    });
    expect(single).toBeUndefined();
  });

  it("drops edges that reference overlong endpoint ids", () => {
    const keptId = "a".repeat(256);
    const aliasedSource = `${keptId}extra`;
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: keptId, kind: "service", label: "Kept", metadata: {} },
        { id: "target", kind: "table", label: "Target", metadata: {} },
      ],
      edges: [
        {
          id: "e1",
          kind: "calls",
          sourceId: aliasedSource,
          targetId: "target",
          metadata: {},
        },
      ],
    });

    expect(graph?.edges).toHaveLength(0);
  });

  it("keeps distinct nodes that share a long prefix within the max id length", () => {
    const prefix = "x".repeat(254);
    const graph = normalizeSoftwareGraph({
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: `${prefix}a`, kind: "service", label: "First", metadata: {} },
        { id: `${prefix}b`, kind: "service", label: "Second", metadata: {} },
      ],
      edges: [],
    });

    expect(graph?.nodes).toHaveLength(2);
  });
});

describe("isIsoTimestamp", () => {
  it("accepts UTC and offset timestamps with valid calendar dates", () => {
    expect(isIsoTimestamp("2026-01-01T12:00:00Z")).toBe(true);
    expect(isIsoTimestamp("2026-01-01T12:00:00+02:00")).toBe(true);
    expect(isIsoTimestamp("2026-01-01T12:00:00.123Z")).toBe(true);
  });

  it("preserves execution and atlas groups from raw graph payloads", () => {
    const graph = normalizeSoftwareGraph({
      version: 1,
      projectId: "p1",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      nodes: [
        { id: "route:leave", kind: "route", label: "POST /api/leave", metadata: {} },
        { id: "file:uc", kind: "file", label: "Use Case", metadata: {} },
      ],
      edges: [],
      groups: [
        {
          id: "execution:leave:0",
          kind: "route",
          label: "Leave trace",
          nodeIds: ["route:leave", "file:uc", "missing-node"],
        },
      ],
    });

    expect(graph?.groups).toEqual([
      {
        id: "execution:leave:0",
        kind: "route",
        label: "Leave trace",
        nodeIds: ["route:leave", "file:uc"],
      },
    ]);
  });

  it("rejects impossible calendar dates", () => {
    expect(isIsoTimestamp("2026-02-30T00:00:00Z")).toBe(false);
    expect(isIsoTimestamp("not-a-date")).toBe(false);
  });
});

const MAX_NODES = 2_500;
