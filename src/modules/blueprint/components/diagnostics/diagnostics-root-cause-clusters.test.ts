/**
 * Unit tests for RVP-10 Diagnostics root-cause clustering.
 */

import { describe, expect, it } from "vitest";
import type { BlueprintFinding } from "../../types";
import {
  clusterFindingsByRootCause,
  findingsForCluster,
  isUnknownFindingState,
  maxSeverity,
} from "./diagnostics-root-cause-clusters.js";

function finding(
  partial: Partial<BlueprintFinding> & Pick<BlueprintFinding, "id">,
): BlueprintFinding {
  return {
    ruleId: "auth.missing",
    category: "security",
    severity: "high",
    scopeId: "route:a",
    message: "Auth fehlt",
    expectedState: "present",
    actualState: "missing",
    evidenceFactIds: ["f1"],
    confidence: 0.8,
    ...partial,
  };
}

describe("diagnostics-root-cause-clusters", () => {
  it("clusters same rule/category/expected/actual together", () => {
    const findings = [
      finding({ id: "1", scopeId: "route:a" }),
      finding({ id: "2", scopeId: "route:b" }),
      finding({
        id: "3",
        ruleId: "cors.open",
        message: "CORS offen",
        expectedState: "restricted",
        actualState: "open",
        scopeId: "route:c",
      }),
    ];

    const clusters = clusterFindingsByRootCause({ findings });
    expect(clusters).toHaveLength(2);
    const auth = clusters.find((cluster) => cluster.ruleId === "auth.missing");
    expect(auth?.findingCount).toBe(2);
    expect(auth?.routeCount).toBe(2);
    expect(auth?.severity).toBe("high");
  });

  it("does not inflate severity beyond member max", () => {
    expect(maxSeverity(["low", "medium", "info"])).toBe("medium");
    const clusters = clusterFindingsByRootCause({
      findings: [
        finding({ id: "1", severity: "low" }),
        finding({ id: "2", severity: "medium", scopeId: "route:b" }),
      ],
    });
    expect(clusters[0]?.severity).toBe("medium");
  });

  it("counts unknown confidence/state without claiming certainty", () => {
    const low = finding({ id: "1", confidence: 0.2, actualState: "unknown" });
    expect(isUnknownFindingState(low)).toBe(true);

    const clusters = clusterFindingsByRootCause({
      findings: [
        low,
        finding({ id: "2", confidence: 0.9, scopeId: "route:b", actualState: "unknown" }),
      ],
    });
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.unknownCount).toBe(2);
    expect(clusters[0]?.averageConfidence).toBeCloseTo(0.55, 5);
  });

  it("drill-down returns original findings for a cluster", () => {
    const findings = [
      finding({ id: "1" }),
      finding({ id: "2", scopeId: "route:b" }),
      finding({ id: "3", ruleId: "other", expectedState: "a", actualState: "b" }),
    ];
    const clusters = clusterFindingsByRootCause({ findings });
    const auth = clusters.find((cluster) => cluster.ruleId === "auth.missing")!;
    const drilled = findingsForCluster(findings, auth);
    expect(drilled.map((item) => item.id).sort()).toEqual(["1", "2"]);
  });
});
