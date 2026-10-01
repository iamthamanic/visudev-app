/**
 * Orchestrator + registry unit tests (SDE-03).
 */

import { describe, expect, it } from "vitest";
import { InMemoryDetectorRegistry } from "./application/detector-registry.js";
import { ScanDetectorOrchestrator } from "./application/orchestrator.js";
import type { DetectorRunResult, ScanDetector } from "./domain/detector.js";
import type { DetectorCapability } from "./types.js";

function capability(id: string, version = "1.0.0"): DetectorCapability {
  return { id, label: id, family: "test", version };
}

function makeDetector(
  id: string,
  priority: number,
  capabilityId: string,
  run: ScanDetector["run"],
): ScanDetector {
  return {
    id,
    priority,
    capability: capability(capabilityId),
    run,
  };
}

describe("InMemoryDetectorRegistry", () => {
  it("rejects duplicate detector ids", () => {
    const registry = new InMemoryDetectorRegistry();
    registry.register(makeDetector("a", 1, "cap-a", () => emptySuccess("a")));
    expect(() => registry.register(makeDetector("a", 2, "cap-a", () => emptySuccess("a")))).toThrow(
      /Duplicate detector id/,
    );
  });

  it("selects by capability and sorts by priority then id", () => {
    const registry = new InMemoryDetectorRegistry();
    registry.register(makeDetector("z", 2, "cap-x", () => emptySuccess("z")));
    registry.register(makeDetector("a", 1, "cap-x", () => emptySuccess("a")));
    registry.register(makeDetector("b", 1, "cap-y", () => emptySuccess("b")));
    expect(registry.select(["cap-x"]).map((detector) => detector.id)).toEqual(["a", "z"]);
  });
});

describe("ScanDetectorOrchestrator", () => {
  it("isolates detector failures and keeps sibling results", async () => {
    const registry = new InMemoryDetectorRegistry();
    registry.register(
      makeDetector("ok", 1, "cap", async () => ({
        detectorId: "ok",
        status: "success",
        facts: [
          {
            id: "fact-ok",
            kind: "test",
            status: "detected",
            confidence: 1,
            provenance: { originKind: "static", detectorId: "ok" },
            subjectId: "node:1",
            evidenceIds: [],
          },
        ],
        evidence: [],
      })),
    );
    registry.register(
      makeDetector("boom", 2, "cap", () => {
        throw new Error("boom");
      }),
    );

    const orchestrator = new ScanDetectorOrchestrator(registry);
    const { snapshot, detectorResults } = await orchestrator.run({
      projectId: "p",
      analyzedAt: "2026-10-01T00:00:00.000Z",
      enrichment: "off",
      engineVersion: "0.1.0-sde",
      requestedCapabilityIds: ["cap"],
    });

    expect(detectorResults.map((result) => result.status)).toEqual(["success", "failed"]);
    expect(snapshot.facts.map((fact) => fact.id)).toEqual(["fact-ok"]);
    expect(snapshot.capabilities.map((item) => item.id)).toEqual(["cap", "cap"]);
  });

  it("is deterministic for the same registry and capability request", async () => {
    const registry = new InMemoryDetectorRegistry();
    registry.register(makeDetector("b", 1, "cap", () => emptySuccess("b")));
    registry.register(makeDetector("a", 1, "cap", () => emptySuccess("a")));
    const orchestrator = new ScanDetectorOrchestrator(registry);
    const input = {
      projectId: "p",
      analyzedAt: "2026-10-01T00:00:00.000Z",
      enrichment: "off" as const,
      engineVersion: "0.1.0-sde",
      requestedCapabilityIds: ["cap"],
    };
    const first = await orchestrator.run(input);
    const second = await orchestrator.run(input);
    expect(first.detectorResults.map((result) => result.detectorId)).toEqual(["a", "b"]);
    expect(second.detectorResults.map((result) => result.detectorId)).toEqual(["a", "b"]);
  });
});

function emptySuccess(detectorId: string): DetectorRunResult {
  return { detectorId, status: "success", facts: [], evidence: [] };
}
