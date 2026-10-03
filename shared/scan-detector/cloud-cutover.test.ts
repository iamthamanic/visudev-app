/**
 * SDE-14 Local-vs-Cloud golden: same SoftwareGraph → equivalent shared resolve.
 */

import { describe, expect, it } from "vitest";
import {
  applyEngineHostCutover,
  CLOUD_ENGINE_CAPABILITIES_ABSENT,
  CLOUD_ENGINE_CAPABILITIES_PRESENT,
} from "./application/apply-engine-host-cutover.js";
import { adaptVisuDevGraphToSoftwareGraph } from "../visudev-to-software-graph.js";
import type { SoftwareGraph } from "../software-graph.types.js";

function fixtureGraph(): SoftwareGraph {
  return adaptVisuDevGraphToSoftwareGraph(
    {
      version: 1,
      nodes: [
        {
          id: "route:users",
          kind: "route",
          label: "GET /users",
          state: "confirmed",
          metadata: { method: "GET", path: "/users", routeId: "GET /users" },
          evidenceIds: [],
        },
        {
          id: "svc:auth",
          kind: "auth",
          label: "Auth",
          state: "confirmed",
          evidenceIds: [],
        },
        {
          id: "tbl:users",
          kind: "table",
          label: "users",
          state: "confirmed",
          evidenceIds: [],
        },
      ],
      edges: [
        {
          id: "e1",
          fromNodeId: "route:users",
          toNodeId: "svc:auth",
          kind: "authenticates",
          state: "confirmed",
          evidenceIds: [],
        },
        {
          id: "e2",
          fromNodeId: "route:users",
          toNodeId: "tbl:users",
          kind: "reads",
          state: "confirmed",
          evidenceIds: [],
        },
      ],
      evidence: [],
    },
    {
      projectId: "golden-cloud",
      analyzedAt: "2026-04-01T00:00:00.000Z",
      routes: [
        {
          id: "GET /users",
          method: "GET",
          path: "/users",
          filePath: "src/users.ts",
          line: 1,
          pipeline: [{ kind: "auth" }],
        },
      ],
    },
  );
}

describe("SDE-14 cloud engine cutover", () => {
  it("produces semantically equivalent models for Local and Cloud on same inputs", () => {
    const graph = fixtureGraph();
    const local = applyEngineHostCutover({
      host: "local",
      legacyGraph: graph,
      modeRaw: "shadow",
    });
    const cloud = applyEngineHostCutover({
      host: "cloud",
      legacyGraph: graph,
      modeRaw: "shadow",
    });

    expect(local.mode).toBe("shadow");
    expect(cloud.mode).toBe("shadow");
    expect(local.resolved.source).toBe(cloud.resolved.source);
    expect(local.semanticSystemModel.entities.map((e) => e.id).sort()).toEqual(
      cloud.semanticSystemModel.entities.map((e) => e.id).sort(),
    );
    expect(local.semanticSystemModel.relations.map((r) => r.id).sort()).toEqual(
      cloud.semanticSystemModel.relations.map((r) => r.id).sort(),
    );
    expect(local.resolved.graph.nodes.length).toBe(cloud.resolved.graph.nodes.length);
  });

  it("manifests cloud capability gaps explicitly without inventing evidence", () => {
    const cloud = applyEngineHostCutover({
      host: "cloud",
      legacyGraph: fixtureGraph(),
      modeRaw: "shadow",
    });
    expect(cloud.capabilitiesPresent).toEqual([...CLOUD_ENGINE_CAPABILITIES_PRESENT]);
    for (const absent of CLOUD_ENGINE_CAPABILITIES_ABSENT) {
      expect(cloud.capabilitiesAbsent).toContain(absent);
    }
    expect(
      cloud.resolved.graph.evidence.some(
        (item) =>
          typeof item.kind === "string" &&
          (item.kind.includes("runtime") || item.kind.includes("schema")),
      ),
    ).toBe(false);
  });

  it("defaults mode to shadow when unset", () => {
    const cloud = applyEngineHostCutover({
      host: "cloud",
      legacyGraph: fixtureGraph(),
      modeRaw: undefined,
    });
    expect(cloud.mode).toBe("shadow");
  });
});
