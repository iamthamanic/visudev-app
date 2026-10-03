/**
 * RVP-11 semantic history + diff tests.
 */

import { describe, expect, it } from "vitest";
import {
  attachHistoricalEngineSnapshots,
  buildSemanticHistoryFromHistoricalRecord,
  buildSemanticHistoryFromSoftwareGraph,
  diffSemanticHistory,
  hasSemanticHistoryCompare,
  semanticHistoryToGraphSnapshot,
} from "./semantic-history.js";
import { buildSnapshotKey, dirtyFingerprintForCleanTree } from "./scan-detector/index.js";
import type { HistoricalSnapshotRecord } from "./scan-detector/domain/snapshot/types.js";
import type { ScanSnapshot } from "./scan-detector/types.js";
import type { SoftwareGraph } from "./software-graph.types.js";

function makeGraph(
  projectId: string,
  analyzedAt: string,
  nodes: { id: string; kind: "service" | "table" | "file"; label: string }[],
): SoftwareGraph {
  return {
    version: 1,
    projectId,
    analyzedAt,
    scopes: [],
    nodes: nodes.map((node) => ({ ...node, metadata: {} })),
    edges: [],
    evidence: [],
    groups: [],
    metrics: [],
    condensed: false,
    limits: { maxNodes: 2500, maxEdges: 5000 },
  };
}

function makeScan(
  projectId: string,
  commitSha: string,
  analyzedAt: string,
  nodes: { id: string; kind: string; label: string }[],
): ScanSnapshot {
  return {
    version: 1,
    projectId,
    analyzedAt,
    enrichment: "off",
    repo: { commitSha, branch: "main", dirty: false },
    versions: {
      engineVersion: "1.0.0",
      modelVersions: { softwareGraph: "1.0.0", semanticSystemModel: "1.0.0" },
      detectorVersions: { "static-blueprint": "1.0.0" },
    },
    capabilities: [],
    facts: nodes.map((node) => ({
      id: `fact:node:${node.id}`,
      kind: `graph-node:${node.kind}`,
      status: "detected" as const,
      confidence: 1,
      provenance: { originKind: "static" as const, detectorId: "static-blueprint" },
      subjectId: node.id,
      evidenceIds: [],
      attributes: { label: node.label, nodeKind: node.kind },
    })),
    evidence: [],
  };
}

function makeRecord(scan: ScanSnapshot): HistoricalSnapshotRecord {
  const key = buildSnapshotKey({
    projectId: scan.projectId,
    applicationScopeId: "_",
    commitSha: scan.repo.commitSha ?? "",
    ref: scan.repo.branch ?? "main",
    dirtyFingerprint: dirtyFingerprintForCleanTree(),
    engineVersion: scan.versions.engineVersion,
    modelVersions: scan.versions.modelVersions,
    detectorVersions: scan.versions.detectorVersions,
  });
  return {
    key,
    projectId: scan.projectId,
    applicationScopeId: "_",
    commitSha: scan.repo.commitSha ?? "",
    ref: scan.repo.branch ?? "main",
    dirtyFingerprint: dirtyFingerprintForCleanTree(),
    analyzedAt: scan.analyzedAt,
    versions: scan.versions,
    snapshot: scan,
  };
}

describe("semantic history", () => {
  it("builds #348 keys and diffs entity/relation changes across two commits", () => {
    const older = makeRecord(
      makeScan("p1", "sha-old", "2026-01-01T00:00:00.000Z", [
        { id: "svc-a", kind: "service", label: "Auth" },
        { id: "tbl-u", kind: "table", label: "users" },
      ]),
    );
    const newer = makeRecord(
      makeScan("p1", "sha-new", "2026-01-02T00:00:00.000Z", [
        { id: "svc-a", kind: "service", label: "AuthService" },
        { id: "svc-b", kind: "service", label: "Billing" },
      ]),
    );

    expect(older.key).toContain("|sha-old|");
    expect(newer.key).toContain("|sha-new|");
    expect(older.key).not.toBe(newer.key);

    const base = buildSemanticHistoryFromHistoricalRecord(older);
    const target = buildSemanticHistoryFromHistoricalRecord(newer);
    const diff = diffSemanticHistory(base, target);

    expect(diff.identical).toBe(false);
    expect(diff.addedEntityIds.some((id) => id.includes("svc-b"))).toBe(true);
    expect(diff.removedEntityIds.some((id) => id.includes("tbl-u"))).toBe(true);
    expect(diff.changedEntityIds.some((id) => id.includes("svc-a"))).toBe(true);
  });

  it("marks identical semantic snapshots", () => {
    const graph = makeGraph("p1", "2026-01-01T00:00:00.000Z", [
      { id: "svc-a", kind: "service", label: "Auth" },
    ]);
    const snap = buildSemanticHistoryFromSoftwareGraph(graph, {
      key: "k1",
      commitSha: "abc",
      ref: "main",
      engineVersion: "1.0.0",
    });
    expect(diffSemanticHistory(snap, snap).identical).toBe(true);
  });

  it("attaches at least two historical engine snapshots onto a graph", () => {
    const graph = makeGraph("p1", "2026-01-03T00:00:00.000Z", [
      { id: "svc-a", kind: "service", label: "Auth" },
    ]);
    const records = [
      makeRecord(
        makeScan("p1", "c1", "2026-01-01T00:00:00.000Z", [
          { id: "svc-a", kind: "service", label: "Auth" },
        ]),
      ),
      makeRecord(
        makeScan("p1", "c2", "2026-01-02T00:00:00.000Z", [
          { id: "svc-a", kind: "service", label: "Auth" },
          { id: "svc-b", kind: "service", label: "Billing" },
        ]),
      ),
    ];
    const next = attachHistoricalEngineSnapshots(graph, records);
    expect(hasSemanticHistoryCompare(next.snapshots ?? [])).toBe(true);
    expect(next.snapshots).toHaveLength(2);
    const uiSnap = semanticHistoryToGraphSnapshot(
      buildSemanticHistoryFromHistoricalRecord(records[1]!),
    );
    expect(uiSnap.commitSha).toBe("c2");
    expect(uiSnap.nodeIds.length).toBeGreaterThan(0);
  });
});
