/**
 * AppFlow coverage COMPLETE/PARTIAL tests (PR-13).
 */

import { describe, expect, it } from "vitest";
import type { AnalysisGraph } from "../../../lib/visudev/analysis-graph";
import type { RuntimeCrawlResult } from "../../../lib/visudev/runtime-crawl";
import { buildAppFlowCoverageReport } from "./appflow-coverage";

function runtime(reason: string): RuntimeCrawlResult {
  return {
    baseUrl: "http://localhost",
    crawledAt: "2026-01-01T00:00:00.000Z",
    terminationReason: reason,
    summary: {
      visitedScreens: 2,
      attemptedClicks: 3,
      verifiedEdges: 1,
      stateCaptures: 1,
      mismatchCount: 0,
      issueCount: 0,
      terminationReason: reason,
      frontierSeedCount: 2,
      blockedMutations: 1,
    } as RuntimeCrawlResult["summary"],
    snapshots: [],
    verifiedEdges: [],
    stateScreens: [],
    issues: [],
  } as RuntimeCrawlResult;
}

describe("buildAppFlowCoverageReport", () => {
  it("marks COMPLETE only for frontier-exhausted", () => {
    expect(buildAppFlowCoverageReport(undefined, runtime("frontier-exhausted")).status).toBe(
      "COMPLETE",
    );
    expect(buildAppFlowCoverageReport(undefined, runtime("budget")).status).toBe("PARTIAL");
    expect(buildAppFlowCoverageReport(undefined, runtime("auth-barrier")).status).toBe("PARTIAL");
    expect(buildAppFlowCoverageReport(undefined, runtime("timeout")).status).toBe("PARTIAL");
  });

  it("counts static / runtime-verified / conflicted screens", () => {
    const graph = {
      nodes: [
        {
          id: "node:a",
          sourceScreenId: "a",
          status: "static",
          origin: "static",
          confidence: 0.5,
          uncertaintyReasons: [],
        },
        {
          id: "node:b",
          sourceScreenId: "b",
          status: "verified",
          origin: "runtime-verified",
          confidence: 0.9,
          uncertaintyReasons: [],
        },
        {
          id: "node:c",
          sourceScreenId: "c",
          status: "conflicted",
          origin: "heuristic",
          confidence: 0.2,
          uncertaintyReasons: [],
        },
      ],
      edges: [],
      evidence: [],
      issues: [],
    } as unknown as AnalysisGraph;

    const report = buildAppFlowCoverageReport(graph, runtime("frontier-exhausted"));
    expect(report.screenVerification).toEqual({
      staticOnly: 1,
      runtimeVerified: 1,
      conflicted: 1,
    });
    expect(report.frontierSeedCount).toBe(2);
    expect(report.blockedMutations).toBe(1);
  });
});
