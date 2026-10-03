/**
 * SDE-13 snapshot key, cache, incremental invalidation, historical read tests.
 */

import { describe, expect, it } from "vitest";
import { MemoryScanCacheStore } from "./application/memory-cache-store.js";
import { readHistoricalSnapshots } from "./application/historical-snapshot-read.js";
import { runWithCache } from "./application/run-with-cache.js";
import { InMemoryDetectorRegistry } from "./application/detector-registry.js";
import { isSnapshotCompatible } from "./domain/snapshot/compatibility.js";
import { planIncrementalScan } from "./domain/snapshot/invalidation.js";
import {
  buildSnapshotKey,
  dirtyFingerprintForCleanTree,
  fingerprintFromPathDigests,
  projectIdFromSnapshotKey,
} from "./domain/snapshot/snapshot-key.js";
import type { ScanCacheEntry } from "./domain/snapshot/types.js";
import type { DetectorCapability, ScanFact, ScanSnapshot, ScanVersionManifest } from "./types.js";
import type { ScanDetector } from "./domain/detector.js";

function versions(
  engine = "1.0.0",
  detectors: Record<string, string> = { "static-blueprint": "1.0.0" },
): ScanVersionManifest {
  return {
    engineVersion: engine,
    modelVersions: { softwareGraph: "1.0.0", semanticSystemModel: "1.0.0" },
    detectorVersions: detectors,
  };
}

function makeSnapshot(
  projectId: string,
  commitSha: string,
  analyzedAt: string,
  detectorId: string,
): ScanSnapshot {
  const fact: ScanFact = {
    id: `fact:${commitSha}:${detectorId}`,
    kind: "test-node",
    status: "detected",
    confidence: 1,
    provenance: { originKind: "static", detectorId },
    subjectId: `node:${commitSha}`,
    evidenceIds: [],
  };
  return {
    version: 1,
    projectId,
    analyzedAt,
    enrichment: "off",
    repo: { commitSha, branch: "main", dirty: false },
    versions: versions(),
    capabilities: [],
    facts: [fact],
    evidence: [],
  };
}

function makeEntry(
  projectId: string,
  commitSha: string,
  analyzedAt: string,
  fingerprints: Record<string, string>,
): ScanCacheEntry {
  const v = versions();
  const key = buildSnapshotKey({
    projectId,
    applicationScopeId: "app-a",
    commitSha,
    ref: "main",
    dirtyFingerprint: dirtyFingerprintForCleanTree(),
    engineVersion: v.engineVersion,
    modelVersions: v.modelVersions,
    detectorVersions: v.detectorVersions,
  });
  return {
    key,
    projectId,
    applicationScopeId: "app-a",
    createdAt: analyzedAt,
    versions: v,
    repo: {
      commitSha,
      branch: "main",
      dirty: false,
      dirtyFingerprint: dirtyFingerprintForCleanTree(),
    },
    detectorInputFingerprints: fingerprints,
    snapshot: makeSnapshot(projectId, commitSha, analyzedAt, "static-blueprint"),
  };
}

describe("buildSnapshotKey", () => {
  it("includes scope, commit, dirty fingerprint, and versions", () => {
    const key = buildSnapshotKey({
      projectId: "proj-1",
      applicationScopeId: "web",
      commitSha: "abc123",
      ref: "main",
      dirtyFingerprint: "clean",
      engineVersion: "1.2.3",
      modelVersions: { softwareGraph: "2.0.0", dataGraph: "1.0.0" },
      detectorVersions: { "static-blueprint": "1.0.0", "schema-data": "1.1.0" },
    });
    expect(key.startsWith("sde-snap:v1|")).toBe(true);
    expect(key).toContain("|proj-1|");
    expect(key).toContain("|web|");
    expect(key).toContain("|abc123|");
    expect(key).toContain("|main|");
    expect(key).toContain("|clean|");
    expect(key).toContain("|1.2.3|");
    expect(key).toContain("softwareGraph=2.0.0");
    expect(key).toContain("schema-data=1.1.0");
    expect(projectIdFromSnapshotKey(key)).toBe("proj-1");
  });

  it("differs when dirty fingerprint changes", () => {
    const base = {
      projectId: "p",
      applicationScopeId: "_",
      commitSha: "c1",
      ref: "main",
      engineVersion: "1.0.0",
      modelVersions: {},
      detectorVersions: { d: "1" },
    };
    const clean = buildSnapshotKey({ ...base, dirtyFingerprint: "clean" });
    const dirty = buildSnapshotKey({
      ...base,
      dirtyFingerprint: fingerprintFromPathDigests([{ path: "src/a.ts", digest: "x" }]),
    });
    expect(clean).not.toBe(dirty);
  });
});

describe("isSnapshotCompatible", () => {
  it("rejects engine major bumps and detector version drift", () => {
    const stored = versions("1.0.0", { "static-blueprint": "1.0.0" });
    expect(isSnapshotCompatible(stored, versions("1.5.0", { "static-blueprint": "1.0.0" }))).toBe(
      true,
    );
    expect(isSnapshotCompatible(stored, versions("2.0.0", { "static-blueprint": "1.0.0" }))).toBe(
      false,
    );
    expect(isSnapshotCompatible(stored, versions("1.0.0", { "static-blueprint": "1.1.0" }))).toBe(
      false,
    );
  });

  it("rejects model version mismatch", () => {
    const stored = versions();
    const requested = versions();
    requested.modelVersions = { ...requested.modelVersions, softwareGraph: "9.9.9" };
    expect(isSnapshotCompatible(stored, requested)).toBe(false);
  });
});

describe("planIncrementalScan", () => {
  it("cache-hits unchanged detector inputs and invalidates changed ones", () => {
    const previous = makeEntry("p", "c1", "2026-01-01T00:00:00.000Z", {
      "static-blueprint": "fp-static",
      "schema-data": "fp-schema",
    });
    previous.versions.detectorVersions = {
      "static-blueprint": "1.0.0",
      "schema-data": "1.0.0",
    };

    const plan = planIncrementalScan({
      previous,
      requestedDetectorIds: ["static-blueprint", "schema-data"],
      currentInputFingerprints: {
        "static-blueprint": "fp-static",
        "schema-data": "fp-schema-CHANGED",
      },
      currentVersions: versions("1.0.0", {
        "static-blueprint": "1.0.0",
        "schema-data": "1.0.0",
      }),
    });

    expect(plan.cacheHitDetectorIds).toEqual(["static-blueprint"]);
    expect(plan.rerunDetectorIds).toEqual(["schema-data"]);
    expect(plan.reasonByDetector["schema-data"]).toBe("rerun-input-changed");
  });

  it("cascades dependency reruns", () => {
    const previous = makeEntry("p", "c1", "2026-01-01T00:00:00.000Z", {
      "static-blueprint": "a",
      "web-ui": "b",
    });
    previous.versions.detectorVersions = {
      "static-blueprint": "1.0.0",
      "web-ui": "1.0.0",
    };

    const plan = planIncrementalScan({
      previous,
      requestedDetectorIds: ["static-blueprint", "web-ui"],
      currentInputFingerprints: {
        "static-blueprint": "a-CHANGED",
        "web-ui": "b",
      },
      currentVersions: versions("1.0.0", {
        "static-blueprint": "1.0.0",
        "web-ui": "1.0.0",
      }),
    });

    expect(plan.rerunDetectorIds).toContain("static-blueprint");
    expect(plan.rerunDetectorIds).toContain("web-ui");
    expect(plan.reasonByDetector["web-ui"]).toBe("rerun-dependency");
  });
});

describe("readHistoricalSnapshots", () => {
  it("returns at least two historical engine snapshots for #327", async () => {
    const store = new MemoryScanCacheStore();
    const a = makeEntry("proj", "sha-aaa", "2026-01-01T00:00:00.000Z", {
      "static-blueprint": "1",
    });
    const b = makeEntry("proj", "sha-bbb", "2026-01-02T00:00:00.000Z", {
      "static-blueprint": "1",
    });
    // Different commits → different keys
    expect(a.key).not.toBe(b.key);
    await store.put(a);
    await store.put(b);

    const records = await readHistoricalSnapshots(store, {
      projectId: "proj",
      commitShas: ["sha-aaa", "sha-bbb"],
    });
    expect(records).toHaveLength(2);
    expect(records[0]?.commitSha).toBe("sha-aaa");
    expect(records[1]?.commitSha).toBe("sha-bbb");
    expect(records[0]?.snapshot.facts[0]?.subjectId).toBe("node:sha-aaa");
  });

  it("does not leak other projects", async () => {
    const store = new MemoryScanCacheStore();
    await store.put(makeEntry("other", "x", "2026-01-01T00:00:00.000Z", { d: "1" }));
    const records = await readHistoricalSnapshots(store, { projectId: "proj" });
    expect(records).toEqual([]);
  });
});

describe("runWithCache", () => {
  function capability(id: string): DetectorCapability {
    return { id, label: id, family: "test", version: "1.0.0" };
  }

  function detector(id: string, capabilityId: string, subject: string): ScanDetector {
    return {
      id,
      priority: 1,
      capability: capability(capabilityId),
      run: () => ({
        detectorId: id,
        status: "success",
        facts: [
          {
            id: `fact:${id}:${subject}`,
            kind: "node",
            status: "detected",
            confidence: 1,
            provenance: { originKind: "static", detectorId: id },
            subjectId: subject,
            evidenceIds: [],
            attributes: { token: "sk-abcdefghijklmnopqrstuvwxyz" },
          },
        ],
        evidence: [],
      }),
    };
  }

  it("reuses unchanged detector slice on second run and redacts secrets", async () => {
    const registry = new InMemoryDetectorRegistry();
    registry.register(detector("static-blueprint", "cap-static", "n1"));
    registry.register(detector("schema-data", "cap-schema", "t1"));
    const store = new MemoryScanCacheStore();

    const baseInput = {
      projectId: "p",
      analyzedAt: "2026-03-01T00:00:00.000Z",
      enrichment: "off" as const,
      engineVersion: "1.0.0",
      requestedCapabilityIds: ["cap-static", "cap-schema"],
      repo: { commitSha: "c1", branch: "main" },
      applicationScopeId: "app",
      dirtyFingerprint: dirtyFingerprintForCleanTree(),
      detectorInputFingerprints: {
        "static-blueprint": "fp-s",
        "schema-data": "fp-d",
      },
      modelVersions: { softwareGraph: "1.0.0", semanticSystemModel: "1.0.0" },
    };

    const first = await runWithCache(registry, store, baseInput);
    expect(first.cacheMisses.sort()).toEqual(["schema-data", "static-blueprint"]);
    const redacted = first.snapshot.facts.find((fact) => fact.attributes?.token !== undefined);
    expect(redacted?.attributes?.token).toBe("[redacted]");

    const second = await runWithCache(registry, store, {
      ...baseInput,
      analyzedAt: "2026-03-01T01:00:00.000Z",
      detectorInputFingerprints: {
        "static-blueprint": "fp-s",
        "schema-data": "fp-d-NEW",
      },
    });
    expect(second.cacheHits).toContain("static-blueprint");
    expect(second.cacheMisses).toContain("schema-data");
    expect(second.reusedFromKey).toBe(first.cacheKey);
  });
});
