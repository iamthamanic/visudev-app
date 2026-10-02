/**
 * Static blueprint detector adapter tests (SDE-06).
 */

import { describe, expect, it } from "vitest";
import {
  buildLegacySoftwareGraph,
  createStaticBlueprintDetector,
  STATIC_BLUEPRINT_DETECTOR_ID,
} from "./static-blueprint-detector.js";
import { scanFactsToSoftwareGraph } from "../../../shared/scan-detector/application/software-graph-fact-bridge.js";
import { shadowCompareSoftwareGraphs } from "../../../shared/scan-detector/application/shadow-compare-graphs.js";
import type { RawBlueprintScan } from "../types/api.types.js";

function minimalScan(): RawBlueprintScan {
  return {
    providerId: "legacy-blueprint-runner",
    projectId: "p1",
    localPath: "/tmp/p1",
    analyzedAt: "2026-10-01T00:00:00.000Z",
    routes: [
      {
        id: "GET /users",
        method: "GET",
        path: "/users",
        filePath: "src/routes/users.route.ts",
        line: 1,
        pipeline: [],
        concepts: {},
      },
    ],
    facts: [
      {
        id: "f1",
        kind: "ast-import",
        filePath: "src/routes/users.route.ts",
        line: 2,
        snippet: "import { db } from '../db'",
        metadata: { resolvedPath: "src/db.ts" },
      },
    ],
    filesAnalyzed: 2,
  };
}

describe("createStaticBlueprintDetector", () => {
  it("adapts legacy buildSoftwareGraph into engine facts with shadow parity", async () => {
    const scan = minimalScan();
    const legacy = buildLegacySoftwareGraph(scan);
    const detector = createStaticBlueprintDetector({ getScan: async () => scan });
    const result = await detector.run({
      projectId: "p1",
      enrichment: "off",
      requestedCapabilityIds: ["static-blueprint-graph"],
      budget: { timeoutMs: 5_000 },
    });
    expect(result.detectorId).toBe(STATIC_BLUEPRINT_DETECTOR_ID);
    expect(result.status).toBe("success");
    expect(result.facts.length).toBeGreaterThan(0);

    const engine = scanFactsToSoftwareGraph("p1", scan.analyzedAt, result.facts);
    const parity = shadowCompareSoftwareGraphs({
      projectId: "p1",
      legacy,
      engine,
      enrichment: "off",
      routes: scan.routes,
    });
    expect(parity.status).toBe("pass");
  });
});
