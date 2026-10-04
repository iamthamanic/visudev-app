/**
 * PR-16 Local/GitHub parity — ≥2 golden GitHub project ids + shared cutover.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { adaptVisuDevGraphToSoftwareGraph } from "../visudev-to-software-graph.js";
import type { SoftwareGraph } from "../software-graph.types.js";
import {
  compareLocalGithubParity,
  listParityEnabledProjectIds,
} from "./application/local-github-parity.js";
import { CLOUD_ENGINE_CAPABILITIES_ABSENT } from "./application/apply-engine-host-cutover.js";

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(here, "../../.qa/readiness/golden-projects.manifest.json");

function fixtureGraph(projectId: string): SoftwareGraph {
  return adaptVisuDevGraphToSoftwareGraph(
    {
      version: 1,
      nodes: [
        {
          id: "route:health",
          kind: "route",
          label: "GET /health",
          state: "confirmed",
          metadata: { method: "GET", path: "/health", routeId: "GET /health" },
          evidenceIds: [],
        },
        {
          id: "tbl:items",
          kind: "table",
          label: "items",
          state: "confirmed",
          evidenceIds: [],
        },
      ],
      edges: [
        {
          id: "e-read",
          fromNodeId: "route:health",
          toNodeId: "tbl:items",
          kind: "reads",
          state: "confirmed",
          evidenceIds: [],
        },
      ],
      evidence: [],
    },
    {
      projectId,
      analyzedAt: "2026-04-01T00:00:00.000Z",
      routes: [
        {
          id: "GET /health",
          method: "GET",
          path: "/health",
          filePath: "src/health.ts",
          line: 1,
          pipeline: [],
        },
      ],
    },
  );
}

describe("local-github-parity", () => {
  it("manifest lists at least two GitHub projects with parity.enabled", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      projects: Array<{ id?: string; parity?: { enabled?: boolean }; source?: { kind?: string } }>;
    };
    const ids = listParityEnabledProjectIds(manifest.projects);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    expect(ids).toEqual(expect.arrayContaining(["hrkoordinator", "sagadrive"]));
  });

  it("passes semantic parity for each parity-enabled golden project on shared static-blueprint", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      projects: Array<{ id?: string; parity?: { enabled?: boolean }; source?: { kind?: string } }>;
    };
    const ids = listParityEnabledProjectIds(manifest.projects);
    expect(ids.length).toBeGreaterThanOrEqual(2);

    for (const projectId of ids) {
      const graph = fixtureGraph(projectId);
      const result = compareLocalGithubParity({
        projectId,
        localGraph: graph,
        cloudGraph: graph,
        modeRaw: "engine",
      });
      expect(result.status, projectId).toBe("pass");
      expect(result.sharedCapabilities).toContain("static-blueprint");
      // Host-only capabilities must be explicit and must not fail the gate.
      const hostDeltas = result.capabilityDeltas.filter((delta) => delta.hostSpecific);
      expect(hostDeltas.length).toBeGreaterThan(0);
      for (const absent of CLOUD_ENGINE_CAPABILITIES_ABSENT) {
        expect(
          result.capabilityDeltas.some(
            (delta) =>
              delta.capability === absent &&
              delta.hostSpecific &&
              delta.local === "present" &&
              delta.cloud === "absent",
          ),
          absent,
        ).toBe(true);
      }
      expect(result.local.semanticSystemModel.entities.map((e) => e.id).sort()).toEqual(
        result.cloud.semanticSystemModel.entities.map((e) => e.id).sort(),
      );
    }
  });

  it("fails when Local and Cloud graphs diverge under shared capabilities", () => {
    const localGraph = fixtureGraph("divergent");
    const cloudGraph = fixtureGraph("divergent");
    cloudGraph.nodes = cloudGraph.nodes.filter((node) => node.id !== "tbl:items");
    const result = compareLocalGithubParity({
      projectId: "divergent",
      localGraph,
      cloudGraph,
      modeRaw: "engine",
    });
    expect(result.status).toBe("fail");
  });
});
